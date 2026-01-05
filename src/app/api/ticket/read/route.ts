// src/app/api/ticket/read/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyTicketAccess } from '@/lib/access-ticket-user'
import { handlePermissionError } from '@/lib/permission-error'

// Helper to format a Team/UserTeam entity into a display object
function formatEntity(e: {
  id: number
  teamId?: number | null
  userTeamId?: number | null
  team: { id: number, name: string } | null
  userTeam: {
    id: number
    teamId: number
    user: { displayName: string }
    team: { name: string }
  } | null
} | null) {
  if (!e) return null;

  if (e.team) {
    return {
      entityId: e.id,
      name: e.team.name,
      type: 'team',
      teamId: e.team.id,
      userTeamId: null
    }
  }
  if (e.userTeam) {
    return {
      entityId: e.id,
      name: `${e.userTeam.user.displayName} (${e.userTeam.team.name})`,
      type: 'user',
      teamId: e.userTeam.teamId,
      userTeamId: e.userTeam.id
    }
  }
  return { entityId: e.id, name: 'Unknown', type: 'unknown', teamId: null, userTeamId: null }
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
  let access
  try {
    access = await verifyTicketAccess(userId, ticketId)
  } catch (err) {
    return handlePermissionError(err)
  }
  // access.accessVia contains the rules that matched.
  // We also want all the user's teams to check "team" scope for other actions.
  const userTeams = await prisma.userTeam.findMany({
    where: { userId, Active: true },
    select: { id: true, teamId: true }
  })

  const { accessVia, actionPermissions } = access

  // 2) fetch main ticket info
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      title: true,
      currentStatus: { select: { id: true, name: true, color: true } },
      currentPriority: { select: { id: true, name: true, color: true } },
      currentCategory: { select: { id: true, name: true, parentId: true } },
      currentAssignedTo: {
        select: {
          id: true,
          teamId: true,
          userTeamId: true,
          team: { select: { id: true, name: true } },
          userTeam: {
            select: {
              id: true,
              teamId: true,
              user: { select: { displayName: true } },
              team: { select: { name: true } }
            }
          }
        }
      },
      createdBy: {
        select: {
          id: true,
          teamId: true,
          userTeamId: true,
          team: { select: { id: true, name: true } },
          userTeam: {
            select: {
              id: true,
              teamId: true,
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

  // Fetch all categories for parent chain resolution
  const allCategories = await prisma.ticketCategory.findMany({ select: { id: true, name: true, parentId: true } })
  const categoryMap = new Map(allCategories.map(c => [c.id, c]))

  // Helper to build parent chain string
  function buildCategoryChain(catId: number | null | undefined): string | null {
    if (!catId) return null;
    const chain: string[] = [];
    let current = categoryMap.get(catId);
    while (current) {
      chain.unshift(current.name);
      if (!current.parentId) break;
      current = categoryMap.get(current.parentId);
    }
    return chain.join(' > ');
  }

  // 3) load all threads and change events (assignment/status/priority)
  const [threads, assigns, prios, stats, cats] = await Promise.all([
    prisma.ticketThread.findMany({
      where: { ticketId },
      select: {
        id: true,
        createdAt: true,
        body: true, // already decrypted by Prisma middleware
        createdBy: {
          select: {
            id: true,
            teamId: true,
            userTeamId: true,
            team: { select: { id: true, name: true } },
            userTeam: {
              select: {
                id: true,
                teamId: true,
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
            teamId: true,
            userTeamId: true,
            team: { select: { id: true, name: true } },
            userTeam: {
              select: {
                id: true,
                teamId: true,
                user: { select: { displayName: true } },
                team: { select: { name: true } }
              }
            }
          }
        },
        assignedTo: {
          select: {
            id: true,
            teamId: true,
            userTeamId: true,
            team: { select: { id: true, name: true } },
            userTeam: {
              select: {
                id: true,
                teamId: true,
                user: { select: { displayName: true } },
                team: { select: { name: true } }
              }
            }
          }
        },
        assignedBy: {
          select: {
            id: true,
            teamId: true,
            userTeamId: true,
            team: { select: { id: true, name: true } },
            userTeam: {
              select: {
                id: true,
                teamId: true,
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
        priorityTo: { select: { id: true, name: true } },
        changedBy: {
          select: {
            id: true,
            teamId: true,
            userTeamId: true,
            team: { select: { id: true, name: true } },
            userTeam: {
              select: {
                id: true,
                teamId: true,
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
        statusTo: { select: { id: true, name: true } },
        changedBy: {
          select: {
            id: true,
            teamId: true,
            userTeamId: true,
            team: { select: { id: true, name: true } },
            userTeam: {
              select: {
                id: true,
                teamId: true,
                user: { select: { displayName: true } },
                team: { select: { name: true } }
              }
            }
          }
        },
        notificationEvent: { select: { id: true } }
      }
    }),
    prisma.ticketChangeCategory.findMany({
      where: { ticketId },
      select: {
        id: true,
        changedAt: true,
        categoryFrom: { select: { id: true, name: true } },
        categoryTo: { select: { id: true, name: true } },
        changedBy: {
          select: {
            id: true,
            teamId: true,
            userTeamId: true,
            team: { select: { id: true, name: true } },
            userTeam: {
              select: {
                id: true,
                teamId: true,
                user: { select: { displayName: true } },
                team: { select: { name: true } }
              }
            }
          }
        },
        notificationEvent: { select: { id: true } }
      }
    })
  ])

  // 4) collect NotificationEvent IDs
  const eventIds = [
    ...threads.flatMap(t => t.notificationEvent?.id ?? []),
    ...assigns.flatMap(a => a.notificationEvent?.id ?? []),
    ...prios.flatMap(p => p.notificationEvent?.id ?? []),
    ...stats.flatMap(s => s.notificationEvent?.id ?? []),
    ...cats.flatMap(c => c.notificationEvent?.id ?? []),
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
      type: 'THREAD',
      id: t.id,
      at: t.createdAt,
      body: t.body,
      createdBy: formatEntity(t.createdBy),
      attachments: t.attachments,
      read: t.notificationEvent ? (readMap.get(t.notificationEvent.id) ?? false) : false
    })
  }

  for (const a of assigns) {
    activityLog.push({
      type: 'ASSIGN_CHANGE',
      id: a.id,
      at: a.assignedAt,
      from: a.assignedFrom ? formatEntity(a.assignedFrom) : null,
      to: a.assignedTo ? formatEntity(a.assignedTo) : null,
      by: a.assignedBy ? formatEntity(a.assignedBy) : null,
      read: a.notificationEvent ? (readMap.get(a.notificationEvent.id) ?? false) : false
    })
  }

  for (const p of prios) {
    activityLog.push({
      type: 'PRIORITY_CHANGE',
      id: p.id,
      at: p.changedAt,
      from: p.priorityFrom,
      to: p.priorityTo,
      by: formatEntity(p.changedBy),
      read: p.notificationEvent ? (readMap.get(p.notificationEvent.id) ?? false) : false
    })
  }

  for (const s of stats) {
    activityLog.push({
      type: 'STATUS_CHANGE',
      id: s.id,
      at: s.changedAt,
      from: s.statusFrom,
      to: s.statusTo,
      by: formatEntity(s.changedBy),
      read: s.notificationEvent ? (readMap.get(s.notificationEvent.id) ?? false) : false
    })
  }

  for (const c of cats) {
    activityLog.push({
      type: 'CATEGORY_CHANGE',
      id: c.id,
      at: c.changedAt,
      from: c.categoryFrom,
      to: c.categoryTo,
      by: formatEntity(c.changedBy),
      read: c.notificationEvent ? (readMap.get(c.notificationEvent.id) ?? false) : false
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
        read: true,
        readAt: new Date()
      }
    })
  }

  // 10) return permissions and user info
  const allPermissions = [
    ...accessVia.map(v => v.permission),
    ...actionPermissions
  ]

  return NextResponse.json({
    user: {
      id: userId,
      permissions: Array.from(new Set(allPermissions)),
      teams: userTeams
    },
    ticket: {
      id: ticket.id,
      title: ticket.title,
      currentStatus: ticket.currentStatus ? { ...ticket.currentStatus, color: ticket.currentStatus.color } : null,
      currentPriority: ticket.currentPriority ? { ...ticket.currentPriority, color: ticket.currentPriority.color } : null,
      currentCategory: ticket.currentCategory ? { ...ticket.currentCategory, name: buildCategoryChain(ticket.currentCategory.id) } : null,
      currentAssignedTo: ticket.currentAssignedTo ? formatEntity(ticket.currentAssignedTo) : null,
      createdBy: formatEntity(ticket.createdBy),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt
    },
    lastReadEvent: lastRead ? { type: lastRead.type, id: lastRead.id } : null,
    activityLog
  })
}
