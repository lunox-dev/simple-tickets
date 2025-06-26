// src/workers/notification-init.ts

import { Worker, Queue } from 'bullmq'
import IORedis from 'ioredis'
import { prisma } from '@/lib/prisma'
import { getTicketAccessUsers } from '@/lib/access-users'

// Redis connection must set maxRetriesPerRequest = null
const connection = new IORedis(process.env.REDIS_URL as string, {
  maxRetriesPerRequest: null,
})
export const notificationQueue = new Queue('notifications', { connection })

new Worker(
  'notifications',
  async job => {
    if (job.name !== 'notification-init') return
    const { eventId } = job.data as { eventId: number }

    try {
      // 1) Get the event
      const event = await prisma.notificationEvent.findUnique({
        where: { id: eventId },
        include: {
          onAssignmentChange: { select: { ticketId: true } },
          onPriorityChange:   { select: { ticketId: true } },
          onStatusChange:     { select: { ticketId: true } },
          onCategoryChange:   { select: { ticketId: true } },
          onThread:           { select: { ticketId: true } },
        }
      })
      if (!event) throw new Error(`Event ${eventId} not found`)

      // 2) Figure out the ticketId for this event
      let ticketId: number | undefined
      if (event.onAssignmentChange) ticketId = event.onAssignmentChange.ticketId
      else if (event.onPriorityChange) ticketId = event.onPriorityChange.ticketId
      else if (event.onStatusChange) ticketId = event.onStatusChange.ticketId
      else if (event.onCategoryChange) ticketId = event.onCategoryChange.ticketId
      else if (event.onThread) ticketId = event.onThread.ticketId
      else throw new Error(`Event ${eventId} has no associated change or thread`)

      // 3) Lookup who needs to be notified for this ticket
      const { users } = await getTicketAccessUsers(ticketId)

      // 4) In a single transaction: create all recipients
      if (users.length) {
        await prisma.notificationRecipient.createMany({
          data: users.map(u => ({
            eventId: event.id,
            userId:  u.userId,
          })),
          skipDuplicates: true,
        })
      }

      // 5) Kick off the delivery stage
      await notificationQueue.add('notification-delivery', { eventId: event.id })

      console.log(`[notification-init] ${users.length} recipients created for event ${eventId} on ticket ${ticketId}`)
    } catch (err) {
      console.error(`[notification-init] error processing job for event ${eventId}:`, err)
    }
  },
  { connection }
)
