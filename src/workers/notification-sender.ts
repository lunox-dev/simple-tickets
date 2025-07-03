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

  // Fetch ticket priority for TICKET_CREATED events
  let ticketPriorityId = undefined;
  if (event.type === 'TICKET_CREATED' && event.onThread) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: event.onThread.ticketId },
      select: { currentPriorityId: true }
    });
    ticketPriorityId = ticket?.currentPriorityId;
    console.log(`[NotificationWorker] Fetched ticket priority for TICKET_CREATED:`, ticketPriorityId);
  }

  for (const r of event.recipients) {
    const user = r.user
    // Pass ticketPriorityId into context for TICKET_CREATED
    const contextBase = await buildContext(user, event, ticketPriorityId)

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

    // Use the full event type for rule matching (do not strip TICKET_ prefix)
    const eventKey = normalizeEventType(effectiveEventType);

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
    console.log(`[NotificationWorker] Context for user ${user.id} and eventType=${eventKey}:`, JSON.stringify(contextBase))

    // EMAIL
    if (!r.emailNotified && emailPrefs) {
      console.log(`[NotificationWorker] Checking email rules for user ${user.email} (userId=${user.id}) and eventType=${eventKey}`)
      const matchedRules = getMatchingRules(emailPrefs, eventKey, contextBase)
      console.log(`[NotificationWorker] Matched EMAIL rules:`, JSON.stringify(matchedRules))
      if (matchedRules.length > 0 && user.email) {
        const rule = matchedRules[0]
        console.log(`[NotificationWorker] Sending EMAIL to ${user.email} for eventType=${eventKey} (ruleId=${rule.id})`)

        // --- Fetch unseen threads/events for notification.content ---
        let notificationContent = '';
        let ticketId = contextBase.ticket?.id;
        if (ticketId) {
          // Find the last eventId for which this user was notified for this ticket
          const lastNotified = await prisma.notificationRecipient.findFirst({
            where: {
              userId: user.id,
              emailNotified: true,
              event: { OR: [
                { onThread: { ticketId } },
                { onAssignmentChange: { ticketId } },
                { onPriorityChange: { ticketId } },
                { onStatusChange: { ticketId } },
                { onCategoryChange: { ticketId } },
              ] }
            },
            orderBy: { eventId: 'desc' },
            include: { event: true }
          });
          // Find all threads for this ticket whose notificationEventId > sinceEventId
          let sinceEventId = lastNotified?.eventId || 0;
          const newThreads = await prisma.ticketThread.findMany({
            where: {
              ticketId,
              notificationEvent: {
                id: { gt: sinceEventId }
              }
            },
            orderBy: { createdAt: 'asc' }
          });
          notificationContent = newThreads.map(t => t.body).join('\n\n');
          if (!notificationContent && contextBase.thread && typeof contextBase.thread === 'object' && 'content' in contextBase.thread) {
            notificationContent = String((contextBase.thread as any).content);
          }
        }

        const context = {
          ...contextBase,
          rule: {
            id: rule.id,
            description: rule.description || '',
            eventTypes: rule.eventTypes
          },
          notification: {
            body: notificationContent,
            content: notificationContent,
            ruleDescription: rule.description || ''
          }
        }
        console.log(`[NotificationWorker] About to load template for eventType=${effectiveEventType}`)
        const html = await loadTemplate('email', effectiveEventType, context)
        console.log(`[NotificationWorker] Template loaded, HTML length: ${html.length}`)
        // Always use ticket number and subject in the email subject
        const subject = `Ticket #${contextBase.ticket?.id || ''} - ${contextBase.ticket?.subject || ''}`

        // --- Email threading headers ---
        let headers: Record<string, string> | undefined = undefined;
        if (contextBase.ticket?.id) {
          const ticketThreadId = `<ticket-${contextBase.ticket.id}@tickets.local>`;
          const messageId = `<notification-${eventId}@tickets.local>`;
          headers = {
            'Message-ID': messageId,
            'In-Reply-To': ticketThreadId,
            'References': ticketThreadId
          };
        }
        console.log(`[NotificationWorker] About to call sendEmail with subject: ${subject} and headers:`, headers)
        await sendEmail(user.email, subject, html, headers)
        console.log(`[NotificationWorker] sendEmail call completed`)
        await prisma.notificationRecipient.update({
          where: { eventId_userId: { eventId, userId: user.id } },
          data: { emailNotified: true }
        })
        console.log(`[NotificationWorker] Updated notification recipient as notified`)
      } else {
        console.log(`[NotificationWorker] No matching EMAIL rules for user ${user.email} (userId=${user.id}) and eventType=${eventKey}`)
      }
    }

    // SMS
    if (!r.smsNotified && smsPrefs) {
      console.log(`[NotificationWorker] Checking SMS rules for user ${user.mobile} (userId=${user.id}) and eventType=${eventKey}`)
      const matchedRules = getMatchingRules(smsPrefs, eventKey, contextBase)
      console.log(`[NotificationWorker] Matched SMS rules:`, JSON.stringify(matchedRules))
      if (matchedRules.length > 0 && user.mobile) {
        const rule = matchedRules[0]
        console.log(`[NotificationWorker] Sending SMS to ${user.mobile} for eventType=${eventKey} (ruleId=${rule.id})`)

        // --- Fetch unseen threads/events for notification.content for SMS ---
        let notificationContent = '';
        let ticketId = contextBase.ticket?.id;
        if (ticketId) {
          // Find the last eventId for which this user was SMS-notified for this ticket
          const lastNotified = await prisma.notificationRecipient.findFirst({
            where: {
              userId: user.id,
              smsNotified: true,
              event: { OR: [
                { onThread: { ticketId } },
                { onAssignmentChange: { ticketId } },
                { onPriorityChange: { ticketId } },
                { onStatusChange: { ticketId } },
                { onCategoryChange: { ticketId } },
              ] }
            },
            orderBy: { eventId: 'desc' },
            include: { event: true }
          });
          // Find all threads for this ticket whose notificationEventId > sinceEventId
          let sinceEventId = lastNotified?.eventId || 0;
          const newThreads = await prisma.ticketThread.findMany({
            where: {
              ticketId,
              notificationEvent: {
                id: { gt: sinceEventId }
              }
            },
            orderBy: { createdAt: 'asc' }
          });
          notificationContent = newThreads.map(t => t.body).join('\n\n');
          if (!notificationContent && contextBase.thread && typeof contextBase.thread === 'object' && 'content' in contextBase.thread) {
            notificationContent = String((contextBase.thread as any).content);
          }
        }

        const context = {
          ...contextBase,
          rule: {
            id: rule.id,
            description: rule.description || '',
            eventTypes: rule.eventTypes
          },
          notification: {
            body: notificationContent,
            content: notificationContent,
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
  console.log(`[loadTemplate] Loading template from: ${filePath}`)
  try {
    const template = await fs.readFile(filePath, 'utf8')
    console.log(`[loadTemplate] Template loaded, length: ${template.length}`)
    const resolved = resolvePlaceholders(template, context)
    console.log(`[loadTemplate] Template resolved, length: ${resolved.length}`)
    return resolved
  } catch (err) {
    console.error(`[loadTemplate] Error loading template from ${filePath}:`, err)
    throw err
  }
}

// Simple context builder for notification templates
async function buildContext(user: any, event: any, ticketPriorityId?: number) {
  // Extract ticket and thread info from event
  let ticket: any = {};
  let thread = {};
  let priority = undefined;
  let ticketId = undefined;
  let threadDetails = undefined;
  let changeDetails = undefined;

  // Get ticket ID from event
  if (event.onThread) {
    ticketId = event.onThread.ticketId;
  } else if (event.onAssignmentChange) {
    ticketId = event.onAssignmentChange.ticketId;
  } else if (event.onPriorityChange) {
    ticketId = event.onPriorityChange.ticketId;
  } else if (event.onStatusChange) {
    ticketId = event.onStatusChange.ticketId;
  } else if (event.onCategoryChange) {
    ticketId = event.onCategoryChange.ticketId;
  }

  // Fetch complete ticket data if we have a ticket ID
  if (ticketId) {
    const ticketData = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        currentAssignedTo: {
          include: {
            userTeam: { include: { user: true, team: true } },
            team: true
          }
        },
        currentPriority: true,
        currentStatus: true,
        currentCategory: true,
        createdBy: {
          include: {
            userTeam: { include: { user: true, team: true } },
            team: true
          }
        }
      }
    });
    if (ticketData) {
      ticket = {
        id: ticketData.id,
        subject: ticketData.title,
        assignedTo: ticketData.currentAssignedTo,
        priority: ticketData.currentPriority,
        status: ticketData.currentStatus,
        category: ticketData.currentCategory,
        createdBy: ticketData.createdBy,
        createdAt: ticketData.createdAt
      };
    }
  }

  // Set priority
  if (typeof ticketPriorityId === 'number') {
    priority = ticketPriorityId;
  } else if (event.onPriorityChange) {
    priority = event.onPriorityChange.priorityToId;
  } else if (ticket?.priority) {
    priority = ticket.priority.id;
  }

  // Set thread info (with author details)
  if (event.onThread) {
    const threadData = await prisma.ticketThread.findUnique({
      where: { id: event.onThread.id },
      include: {
        createdBy: {
          include: {
            userTeam: { include: { user: true, team: true } },
            team: true
          }
        }
      }
    });
    if (threadData) {
      let authorDisplayName = undefined;
      let authorEmail = undefined;
      if (threadData.createdBy.userTeam && threadData.createdBy.userTeam.user) {
        authorDisplayName = threadData.createdBy.userTeam.user.displayName;
        authorEmail = threadData.createdBy.userTeam.user.email;
      } else if (threadData.createdBy.team) {
        authorDisplayName = threadData.createdBy.team.name;
        authorEmail = undefined;
      }
      threadDetails = {
        id: threadData.id,
        body: threadData.body,
        createdAt: threadData.createdAt,
        authorDisplayName,
        authorEmail
      };
    }
  }

  // Set change info (for assignment, priority, status, category changes)
  if (event.onAssignmentChange) {
    const change = await prisma.ticketChangeAssignment.findUnique({
      where: { id: event.onAssignmentChange.id },
      include: {
        assignedFrom: {
          include: {
            userTeam: { include: { user: true, team: true } },
            team: true
          }
        },
        assignedTo: {
          include: {
            userTeam: { include: { user: true, team: true } },
            team: true
          }
        },
        assignedBy: {
          include: {
            userTeam: { include: { user: true, team: true } },
            team: true
          }
        }
      }
    });
    if (change) {
      changeDetails = {
        fromId: change.assignedFromId,
        fromName: change.assignedFrom?.userTeam?.user?.displayName || change.assignedFrom?.team?.name,
        toId: change.assignedToId,
        toName: change.assignedTo?.userTeam?.user?.displayName || change.assignedTo?.team?.name,
        changedByDisplayName: change.assignedBy?.userTeam?.user?.displayName || change.assignedBy?.team?.name,
        changedByEmail: change.assignedBy?.userTeam?.user?.email,
        changedAt: change.assignedAt
      };
    }
  } else if (event.onPriorityChange) {
    const change = await prisma.ticketChangePriority.findUnique({
      where: { id: event.onPriorityChange.id },
      include: {
        priorityFrom: true,
        priorityTo: true,
        changedBy: {
          include: {
            userTeam: { include: { user: true, team: true } },
            team: true
          }
        }
      }
    });
    if (change) {
      changeDetails = {
        fromId: change.priorityFromId,
        fromName: change.priorityFrom?.name,
        toId: change.priorityToId,
        toName: change.priorityTo?.name,
        changedByDisplayName: change.changedBy?.userTeam?.user?.displayName || change.changedBy?.team?.name,
        changedByEmail: change.changedBy?.userTeam?.user?.email,
        changedAt: change.changedAt
      };
    }
  } else if (event.onStatusChange) {
    const change = await prisma.ticketChangeStatus.findUnique({
      where: { id: event.onStatusChange.id },
      include: {
        statusFrom: true,
        statusTo: true,
        changedBy: {
          include: {
            userTeam: { include: { user: true, team: true } },
            team: true
          }
        }
      }
    });
    if (change) {
      changeDetails = {
        fromId: change.statusFromId,
        fromName: change.statusFrom?.name,
        toId: change.statusToId,
        toName: change.statusTo?.name,
        changedByDisplayName: change.changedBy?.userTeam?.user?.displayName || change.changedBy?.team?.name,
        changedByEmail: change.changedBy?.userTeam?.user?.email,
        changedAt: change.changedAt
      };
    }
  } else if (event.onCategoryChange) {
    const change = await prisma.ticketChangeCategory.findUnique({
      where: { id: event.onCategoryChange.id },
      include: {
        categoryFrom: true,
        categoryTo: true,
        changedBy: {
          include: {
            userTeam: { include: { user: true, team: true } },
            team: true
          }
        }
      }
    });
    if (change) {
      changeDetails = {
        fromId: change.categoryFromId,
        fromName: change.categoryFrom?.name,
        toId: change.categoryToId,
        toName: change.categoryTo?.name,
        changedByDisplayName: change.changedBy?.userTeam?.user?.displayName || change.changedBy?.team?.name,
        changedByEmail: change.changedBy?.userTeam?.user?.email,
        changedAt: change.changedAt
      };
    }
  }

  // Get user's entityId and team entityIds
  const userEntityId = user.entityId || user.id; // fallback to id if entityId not present
  // Try to get all team entityIds from user.teams (teamId or entityId)
  let userTeamEntityIds: number[] = [];
  if (user.teams && Array.isArray(user.teams)) {
    userTeamEntityIds = user.teams.map((t: any) => t.entityId || t.teamId).filter(Boolean);
  } else if (user.userTeams && Array.isArray(user.userTeams)) {
    userTeamEntityIds = user.userTeams.map((ut: any) => ut.team?.entityId || ut.teamId).filter(Boolean);
  }

  // Check if ticket is assigned to the user (entity)
  const assignedToMe = ticket?.assignedTo && ticket.assignedTo.id === userEntityId;

  // Check if ticket is assigned to any of the user's teams (entity)
  const assignedToMyTeams = ticket?.assignedTo && userTeamEntityIds.includes(ticket.assignedTo.id);

  return {
    user: {
      id: user.id,
      entityId: userEntityId,
      displayName: user.displayName,
      email: user.email,
      mobile: user.mobile,
      teams: user.teams?.map((t: any) => t.name) || user.userTeams?.map((ut: any) => ut.team?.name).filter(Boolean) || [],
      teamEntityIds: userTeamEntityIds,
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
    ticket: ticket ? {
      id: ticket.id,
      subject: ticket.subject,
      priorityId: ticket.priority?.id,
      priorityName: ticket.priority?.name,
      categoryId: ticket.category?.id,
      categoryName: ticket.category?.name,
      statusId: ticket.status?.id,
      statusName: ticket.status?.name,
      createdByDisplayName: ticket.createdBy?.userTeam?.user?.displayName || ticket.createdBy?.team?.name,
      createdByEmail: ticket.createdBy?.userTeam?.user?.email,
      createdAt: ticket.createdAt
    } : {},
    thread: threadDetails,
    change: changeDetails,
    priority,
    assignedToMyTeams,
    assignedToMe,
  };
}

// Add helper to get all matching rules for deduplication and context
function getMatchingRules(preferences: NotificationPreferences, eventType: string, context: any) {
  if (!preferences?.rules) return []
  console.log(`[getMatchingRules] Checking rules for eventType=${eventType}`);
  preferences.rules.forEach(rule => {
    console.log(`[getMatchingRules] Rule:`, JSON.stringify(rule));
  });
  return preferences.rules.filter(rule => {
    if (!rule.enabled) return false
    if (!rule.eventTypes.includes(eventType)) return false
    // Evaluate rule conditions
    const result = evaluateCondition(rule.conditions, context);
    console.log(`[getMatchingRules] Rule id=${rule.id} evaluated to:`, result);
    return result;
  })
}

// Add event type normalization utility
const eventTypeMapping: Record<string, string> = {
  TICKET_CREATED: "TICKET_CREATED",
  TICKET_PRIORITY_CHANGED: "PRIORITY_CHANGED",
  TICKET_THREAD_NEW: "NEW_THREAD",
  TICKET_ASSIGNMENT_CHANGED: "ASSIGNMENT_CHANGED",
  TICKET_STATUS_CHANGED: "STATUS_CHANGED",
  TICKET_CATEGORY_CHANGED: "CATEGORY_CHANGED"
};

function normalizeEventType(eventType: string): string {
  return eventTypeMapping[eventType] || eventType;
}
