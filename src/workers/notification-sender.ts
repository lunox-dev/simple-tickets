// workers/notification-sender.ts
import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'
import { evaluateNotificationRules, evaluateCondition } from '@/notifications/evaluateRules'
import type { NotificationPreferences } from '@/notifications/evaluateRules'
import { resolvePlaceholders } from '@/notifications/resolvePlaceholders'
import { sendEmail, sendSMS } from '@/notifications/send'

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
})

new Worker('notifications', async job => {
  if (job.name !== 'notification-delivery') return
  const { eventId } = job.data

  console.log(`[NotificationWorker] Processing job for eventId=${eventId}`)

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

  if (!event) {
    console.log(`[NotificationWorker] No event found for eventId=${eventId}`)
    return
  }

  for (const r of event.recipients) {
    const user = r.user
    const contextBase = buildContext(user, event)

    // --- Patch: If this is a TICKET_THREAD_NEW, check if it's the first thread for the ticket ---
    let effectiveEventType = event.type
    if (event.type === 'TICKET_THREAD_NEW' && event.onThread) {
      const threadCount = await prisma.ticketThread.count({ where: { ticketId: event.onThread.ticketId } })
      console.log(`[NotificationWorker] Thread count for ticketId=${event.onThread.ticketId}: ${threadCount}`)
      if (threadCount === 1) {
        effectiveEventType = 'TICKET_CREATED'
        console.log(`[NotificationWorker] Treating event as TICKET_CREATED for ticketId=${event.onThread.ticketId}`)
      }
    }

    // Normalize event type for rule matching (strip TICKET_ prefix)
    const eventKey = effectiveEventType.startsWith('TICKET_')
      ? effectiveEventType.replace(/^TICKET_/, '')
      : effectiveEventType

    // Parse notification preferences if needed
    let emailPrefs: NotificationPreferences | null = null
    let smsPrefs: NotificationPreferences | null = null
    try {
      emailPrefs = typeof user.emailNotificationPreferences === 'string' ? JSON.parse(user.emailNotificationPreferences) : user.emailNotificationPreferences
    } catch { emailPrefs = null }
    try {
      smsPrefs = typeof user.smsNotificationPreferences === 'string' ? JSON.parse(user.smsNotificationPreferences) : user.smsNotificationPreferences
    } catch { smsPrefs = null }

    console.log(`[NotificationWorker] User ${user.id} emailPrefs:`, JSON.stringify(emailPrefs))
    console.log(`[NotificationWorker] User ${user.id} smsPrefs:`, JSON.stringify(smsPrefs))

    // EMAIL
    if (!r.emailNotified && emailPrefs) {
      console.log(`[NotificationWorker] Checking email rules for user ${user.email} (userId=${user.id}) and eventType=${eventKey}`)
      const matchedRules = getMatchingRules(emailPrefs, eventKey, contextBase)
      if (matchedRules.length > 0 && user.email) {
        const rule = matchedRules[0]
        console.log(`[NotificationWorker] Sending EMAIL to ${user.email} for eventType=${eventKey} (ruleId=${rule.id})`)
        const context = {
          ...contextBase,
          rule: {
            id: rule.id,
            description: rule.description || '',
            eventTypes: rule.eventTypes
          },
          notification: {
            body: contextBase.event?.onThread?.content || '',
            content: contextBase.event?.onThread?.content || '',
            ruleDescription: rule.description || ''
          }
        }
        const html = await loadTemplate('email', effectiveEventType, context)
        const subject = `Ticket #${contextBase.event?.onThread?.ticketId || contextBase.event?.onAssignmentChange?.ticketId || contextBase.event?.onPriorityChange?.ticketId || contextBase.event?.onStatusChange?.ticketId || contextBase.event?.onCategoryChange?.ticketId || ''} - ${contextBase.event?.onThread?.ticketSubject || contextBase.event?.onAssignmentChange?.ticketSubject || contextBase.event?.onPriorityChange?.ticketSubject || contextBase.event?.onStatusChange?.ticketSubject || contextBase.event?.onCategoryChange?.ticketSubject || ''}`
        await sendEmail(user.email, subject, html)
        await prisma.notificationRecipient.update({
          where: { eventId_userId: { eventId, userId: user.id } },
          data: { emailNotified: true }
        })
      } else {
        console.log(`[NotificationWorker] No matching EMAIL rules for user ${user.email} (userId=${user.id}) and eventType=${eventKey}`)
      }
    }

    // SMS
    if (!r.smsNotified && smsPrefs) {
      console.log(`[NotificationWorker] Checking SMS rules for user ${user.mobile} (userId=${user.id}) and eventType=${eventKey}`)
      const matchedRules = getMatchingRules(smsPrefs, eventKey, contextBase)
      if (matchedRules.length > 0 && user.mobile) {
        const rule = matchedRules[0]
        console.log(`[NotificationWorker] Sending SMS to ${user.mobile} for eventType=${eventKey} (ruleId=${rule.id})`)
        const context = {
          ...contextBase,
          rule: {
            id: rule.id,
            description: rule.description || '',
            eventTypes: rule.eventTypes
          },
          notification: {
            body: contextBase.event?.onThread?.content || '',
            content: contextBase.event?.onThread?.content || '',
            ruleDescription: rule.description || ''
          }
        }
        const text = await loadTemplate('sms', effectiveEventType, context)
        await sendSMS(user.mobile, text)
        await prisma.notificationRecipient.update({
          where: { eventId_userId: { eventId, userId: user.id } },
          data: { smsNotified: true }
        })
      } else {
        console.log(`[NotificationWorker] No matching SMS rules for user ${user.mobile} (userId=${user.id}) and eventType=${eventKey}`)
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
  // Extract ticket and thread info from event
  let ticket = {};
  let thread = {};
  if (event.onThread) {
    ticket = {
      id: event.onThread.ticketId,
      subject: event.onThread.ticketSubject,
    };
    thread = {
      id: event.onThread.id,
      content: event.onThread.content,
    };
  } else if (event.onAssignmentChange) {
    ticket = {
      id: event.onAssignmentChange.ticketId,
      subject: event.onAssignmentChange.ticketSubject,
    };
  } else if (event.onPriorityChange) {
    ticket = {
      id: event.onPriorityChange.ticketId,
      subject: event.onPriorityChange.ticketSubject,
    };
  } else if (event.onStatusChange) {
    ticket = {
      id: event.onStatusChange.ticketId,
      subject: event.onStatusChange.ticketSubject,
    };
  } else if (event.onCategoryChange) {
    ticket = {
      id: event.onCategoryChange.ticketId,
      subject: event.onCategoryChange.ticketSubject,
    };
  }
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
    },
    ticket,
    thread,
  };
}

// Add helper to get all matching rules for deduplication and context
function getMatchingRules(preferences: NotificationPreferences, eventType: string, context: any) {
  if (!preferences?.rules) return []
  return preferences.rules.filter(rule => {
    if (!rule.enabled) return false
    if (!rule.eventTypes.includes(eventType)) return false
    // Evaluate rule conditions
    return evaluateCondition(rule.conditions, context)
  })
}
