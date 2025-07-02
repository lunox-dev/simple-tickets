// workers/notification-sender.ts
import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'
import { evaluateNotificationRules } from '@/notifications/evaluateRules'
import type { NotificationPreferences } from '@/notifications/evaluateRules'
import { resolvePlaceholders } from '@/notifications/resolvePlaceholders'
import { sendEmail, sendSMS } from '@/notifications/send'

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
})

new Worker('notifications', async job => {
  if (job.name !== 'notification-delivery') return
  const { eventId } = job.data

  const event = await prisma.notificationEvent.findUnique({
    where: { id: eventId },
    include: {
      recipients: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              mobile: true,
              emailNotificationPreferences: true,
              smsNotificationPreferences: true,
              userTeams: {
                include: {
                  team: true
                }
              }
            }
          }
        }
      },
      onAssignmentChange: true,
      onPriorityChange: true,
      onStatusChange: true,
      onCategoryChange: true,
      onThread: true
    }
  })

  if (!event) return

  for (const r of event.recipients) {
    const user = r.user
    const context = buildContext(user, event)

    // Parse notification preferences if needed
    let emailPrefs: NotificationPreferences | null = null
    let smsPrefs: NotificationPreferences | null = null
    try {
      emailPrefs = typeof user.emailNotificationPreferences === 'string' ? JSON.parse(user.emailNotificationPreferences) : user.emailNotificationPreferences
    } catch { emailPrefs = null }
    try {
      smsPrefs = typeof user.smsNotificationPreferences === 'string' ? JSON.parse(user.smsNotificationPreferences) : user.smsNotificationPreferences
    } catch { smsPrefs = null }

    // EMAIL
    if (!r.emailNotified && emailPrefs) {
      const shouldEmail = evaluateNotificationRules(
        emailPrefs,
        event.type,
        context
      )

      if (shouldEmail && user.email) {
        const html = await loadTemplate('email', event.type, context)
        await sendEmail(user.email, `Notification: ${event.type}`, html)
        await prisma.notificationRecipient.update({
          where: { eventId_userId: { eventId, userId: user.id } },
          data: { emailNotified: true }
        })
      }
    }

    // SMS
    if (!r.smsNotified && smsPrefs) {
      const shouldSMS = evaluateNotificationRules(
        smsPrefs,
        event.type,
        context
      )

      if (shouldSMS && user.mobile) {
        const text = await loadTemplate('sms', event.type, context)
        await sendSMS(user.mobile, text)
        await prisma.notificationRecipient.update({
          where: { eventId_userId: { eventId, userId: user.id } },
          data: { smsNotified: true }
        })
      }
    }
  }
}, { connection })

async function loadTemplate(type: 'email' | 'sms', eventType: string, context: any) {
  const ext = type === 'email' ? 'html' : 'txt'
  const basePath = path.join(process.cwd(), 'src/notifications/templates', type)
  const filePath = path.join(basePath, `${eventType}.${ext}`)
  const template = await fs.readFile(filePath, 'utf8')
  return resolvePlaceholders(template, context)
}

// Simple context builder for notification templates
function buildContext(user: any, event: any) {
  // You can expand this as needed for your templates
  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      mobile: user.mobile,
      teams: user.userTeams?.map((ut: any) => ut.team?.name).filter(Boolean) || [],
    },
    event: {
      id: event.id,
      type: event.type,
      onAssignmentChange: event.onAssignmentChange,
      onPriorityChange: event.onPriorityChange,
      onStatusChange: event.onStatusChange,
      onCategoryChange: event.onCategoryChange,
      onThread: event.onThread,
    }
  }
}
