// src/app/api/ticket/read/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession }        from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma }                  from '@/lib/prisma'
import { getTicketAccessForUser }  from '@/lib/access-ticket-user'

// Helper to format a Team/UserTeam entity into a display object
function formatEntity(e: {
  id: number
  team: { name: string } | null
  userTeam: {
    user: { displayName: string }
    team: { name: string }
  } | null
} | null) {
  if (!e) return null;
  if (e.team) {
    return { entityId: e.id, name: e.team.name }
  }
  if (e.userTeam) {
    return {
      entityId: e.id,
      name: `${e.userTeam.user.displayName} (${e.userTeam.team.name})`
    }
  }
  return { entityId: e.id, name: 'Unknown' }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = Number((session.user as any).id)
  if (!userId || isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
  }

  const ticketId = Number(req.nextUrl.searchParams.get('ticketId'))
  if (isNaN(ticketId)) {
    return NextResponse.json({ error: 'Missing or invalid ticketId' }, { status: 400 })
  }

  // 1) check access and gather permissions
  const access = await getTicketAccessForUser(userId, ticketId)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { accessVia, actionPermissions } = access

  // 2) fetch main ticket info
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      title: true,
      currentStatus:   { select: { id: true, name: true } },
      currentPriority: { select: { id: true, name: true } },
      currentAssignedTo: {
        select: {
          id: true,
          team:     { select: { name: true } },
          userTeam: {
            select: {
              user: { select: { displayName: true } },
              team: { select: { name: true } }
            }
          }
        }
      },
      createdBy: {
        select: {
          id: true,
          team:     { select: { name: true } },
          userTeam: {
            select: {
              user: { select: { displayName: true } },
              team: { select: { name: true } }
            }
          }
        }
      },
      createdAt: true,
      updatedAt: true
    }
  })
  if (!ticket) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 3) load all threads and change events (assignment/status/priority)
  const [threads, assigns, prios, stats] = await Promise.all([
    prisma.ticketThread.findMany({
      where: { ticketId },
      select: {
        id: true,
        createdAt: true,
        body: true, // already decrypted by Prisma middleware
        createdBy: {
          select: {
            id: true,
            team:     { select: { name: true } },
            userTeam: {
              select: {
                user: { select: { displayName: true } },
                team: { select: { name: true } }
              }
            }
          }
        },
        attachments: {
          select: { fileName: true, filePath: true, fileSize: true, fileType: true }
        },
        notificationEvent: { select: { id: true } }
      }
    }),
    prisma.ticketChangeAssignment.findMany({
      where: { ticketId },
      select: {
        id: true,
        assignedAt: true,
        assignedFrom: {
          select: {
            id: true,
            team:     { select: { name: true } },
            userTeam: {
              select: {
                user: { select: { displayName: true } },
                team: { select: { name: true } }
              }
            }
          }
        },
        assignedTo: {
          select: {
            id: true,
            team:     { select: { name: true } },
            userTeam: {
              select: {
                user: { select: { displayName: true } },
                team: { select: { name: true } }
              }
            }
          }
        },
        assignedBy: {
          select: {
            id: true,
            team:     { select: { name: true } },
            userTeam: {
              select: {
                user: { select: { displayName: true } },
                team: { select: { name: true } }
              }
            }
          }
        },
        notificationEvent: { select: { id: true } }
      }
    }),
    prisma.ticketChangePriority.findMany({
      where: { ticketId },
      select: {
        id: true,
        changedAt: true,
        priorityFrom: { select: { id: true, name: true } },
        priorityTo:   { select: { id: true, name: true } },
        changedBy: {
          select: {
            id: true,
            team:     { select: { name: true } },
            userTeam: {
              select: {
                user: { select: { displayName: true } },
                team: { select: { name: true } }
              }
            }
          }
        },
        notificationEvent: { select: { id: true } }
      }
    }),
    prisma.ticketChangeStatus.findMany({
      where: { ticketId },
      select: {
        id: true,
        changedAt: true,
        statusFrom: { select: { id: true, name: true } },
        statusTo:   { select: { id: true, name: true } },
        changedBy: {
          select: {
            id: true,
            team:     { select: { name: true } },
            userTeam: {
              select: {
                user: { select: { displayName: true } },
                team: { select: { name: true } }
              }
            }
          }
        },
        notificationEvent: { select: { id: true } }
      }
    }),
  ])

  // 4) collect NotificationEvent IDs
  const eventIds = [
    ...threads.flatMap(t => t.notificationEvent?.id ?? []),
    ...assigns.flatMap(a => a.notificationEvent?.id ?? []),
    ...prios.flatMap(p => p.notificationEvent?.id ?? []),
    ...stats.flatMap(s => s.notificationEvent?.id ?? []),
  ]

  // 5) load read flags
  const recs = await prisma.notificationRecipient.findMany({
    where: { userId, eventId: { in: eventIds } },
    select: { eventId: true, read: true }
  })
  const readMap = new Map(recs.map(r => [r.eventId, r.read]))

  // 6) build activityLog
  type Entry = any
  const activityLog: Entry[] = []

  for (const t of threads) {
    activityLog.push({
      type:        'THREAD',
      id:          t.id,
      at:          t.createdAt,
      body:        t.body,
      createdBy:   formatEntity(t.createdBy),
      attachments: t.attachments,
      read:        t.notificationEvent ? (readMap.get(t.notificationEvent.id) ?? false) : false
    })
  }

  for (const a of assigns) {
    activityLog.push({
      type: 'ASSIGN_CHANGE',
      id:   a.id,
      at:   a.assignedAt,
      from: a.assignedFrom ? formatEntity(a.assignedFrom) : null,
      to:   a.assignedTo ? formatEntity(a.assignedTo) : null,
      by:   a.assignedBy ? formatEntity(a.assignedBy) : null,
      read: a.notificationEvent ? (readMap.get(a.notificationEvent.id) ?? false) : false
    })
  }

  for (const p of prios) {
    activityLog.push({
      type: 'PRIORITY_CHANGE',
      id:   p.id,
      at:   p.changedAt,
      from: p.priorityFrom,
      to:   p.priorityTo,
      by:   formatEntity(p.changedBy),
      read: p.notificationEvent ? (readMap.get(p.notificationEvent.id) ?? false) : false
    })
  }

  for (const s of stats) {
    activityLog.push({
      type: 'STATUS_CHANGE',
      id:   s.id,
      at:   s.changedAt,
      from: s.statusFrom,
      to:   s.statusTo,
      by:   formatEntity(s.changedBy),
      read: s.notificationEvent ? (readMap.get(s.notificationEvent.id) ?? false) : false
    })
  }

  // 7) chronological sort
  activityLog.sort((a, b) => a.at.getTime() - b.at.getTime())

  // 8) identify last-read
  const readEntries = activityLog.filter(e => e.read)
  const lastRead = readEntries.length
    ? readEntries.reduce((prev, curr) => (curr.at > prev.at ? curr : prev))
    : null

  // 9) mark remaining unread as read
  if (eventIds.length) {
    await prisma.notificationRecipient.updateMany({
      where: {
        userId,
        read: false,
        eventId: { in: eventIds }
      },
      data: {
        read:   true,
        readAt: new Date()
      }
    })
  }

  // 10) return flat permissions on user object
  const userPermissions = [
    ...accessVia.map(v => v.permission),
    ...actionPermissions
  ]

  return NextResponse.json({
    user: {
      id:          userId,
      permissions: Array.from(new Set(userPermissions))
    },
    ticket: {
      id:                ticket.id,
      title:             ticket.title,
      currentStatus:     ticket.currentStatus,
      currentPriority:   ticket.currentPriority,
      currentAssignedTo: ticket.currentAssignedTo ? formatEntity(ticket.currentAssignedTo) : null,
      createdBy:         formatEntity(ticket.createdBy),
      createdAt:         ticket.createdAt,
      updatedAt:         ticket.updatedAt
    },
    lastReadEvent: lastRead ? { type: lastRead.type, id: lastRead.id } : null,
    activityLog
  })
}
