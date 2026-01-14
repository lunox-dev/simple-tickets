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

const worker = new Worker(
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
          onPriorityChange: { select: { ticketId: true } },
          onStatusChange: { select: { ticketId: true } },
          onCategoryChange: { select: { ticketId: true } },
          onThread: { select: { ticketId: true, id: true } },
        }
      })
      if (!event) throw new Error(`Event ${eventId} not found`)

      console.log(`[notification-init] Event ${eventId} type: ${event.type}`)

      // 2) Figure out the ticketId for this event
      let ticketId: number | undefined
      if (event.onAssignmentChange) ticketId = event.onAssignmentChange.ticketId
      else if (event.onPriorityChange) ticketId = event.onPriorityChange.ticketId
      else if (event.onStatusChange) ticketId = event.onStatusChange.ticketId
      else if (event.onCategoryChange) ticketId = event.onCategoryChange.ticketId
      else if (event.onThread) ticketId = event.onThread.ticketId
      else throw new Error(`Event ${eventId} has no associated change or thread`)

      console.log(`[notification-init] Event ${eventId} ticketId: ${ticketId}`)

      // --- Patch: If this is a TICKET_THREAD_NEW, check if it's the first thread for the ticket ---
      if (event.type === 'TICKET_THREAD_NEW' && event.onThread) {
        const threadCount = await prisma.ticketThread.count({ where: { ticketId: event.onThread.ticketId } })
        console.log(`[notification-init] Thread count for ticketId=${event.onThread.ticketId}: ${threadCount}`)
        if (threadCount === 1) {
          // Update the event type to TICKET_CREATED
          await prisma.notificationEvent.update({
            where: { id: eventId },
            data: { type: 'TICKET_CREATED' }
          })
          console.log(`[notification-init] Treating event as TICKET_CREATED for ticketId=${event.onThread.ticketId}`)
        }
      }

      // 3) Lookup who needs to be notified for this ticket
      const { users } = await getTicketAccessUsers(ticketId)
      console.log(`[notification-init] Recipients for event ${eventId}:`, users.map(u => u.userId))

      // 4) In a single transaction: create all recipients
      if (users.length) {
        await prisma.notificationRecipient.createMany({
          data: users.map(u => ({
            eventId: event.id,
            userId: u.userId,
          })),
          skipDuplicates: true,
        })
      }

      // 5) Kick off the delivery stage
      await notificationQueue.add('notification-delivery', { eventId: event.id })

      console.log(`[notification-init] ${users.length} recipients created for event ${eventId} on ticket ${ticketId}`)
    } catch (err) {
      console.error(`[notification-init] error processing job for event ${eventId}:`, err)
      throw err // Rethrow to mark job as failed
    }
  },
  { connection }
)

worker.on('ready', () => {
  console.log('[notification-init] Worker connected and ready!')
})

worker.on('active', job => {
  console.log(`[notification-init] Job ${job.id} started (name: ${job.name})`)
})

worker.on('completed', job => {
  console.log(`[notification-init] Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[notification-init] Job ${job?.id} failed:`, err)
})

worker.on('error', err => {
  console.error(`[notification-init] Worker error:`, err)
})

