// src/app/api/ticket/read/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyTicketAccess, TicketAccessForUserResponse } from '@/lib/access-ticket-user'
import { handlePermissionError } from '@/lib/permission-error'
import { verifyChangePermission, hasThreadCreatePermission } from '@/lib/access-ticket-change'
import { getEntitiesForUser } from '@/app/api/entity/list/route'

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
  let access: TicketAccessForUserResponse
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
      currentStatusId: true,
      currentPriorityId: true,
      currentCategoryId: true,
      currentAssignedToId: true,
      createdById: true,
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
  const allCategories = await prisma.ticketCategory.findMany({ select: { id: true, name: true, parentId: true, childDropdownLabel: true } })
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

  // --- NEW: Calculate Allowed Actions and Metadata ---

  // A. Fetch all metadata
  const [statuses, priorities, categories, entities] = await Promise.all([
    prisma.ticketStatus.findMany({ select: { id: true, name: true, color: true } }),
    prisma.ticketPriority.findMany({ select: { id: true, name: true, color: true } }),
    getEntitiesForUser(userId), // Assuming we want ALL entities (but filtered by user's list permission inside the helper)
    // Actually the helper gets entities *for the user*, so it's already filtered.
    // However, the helper returns a tree. We might want flat lists for filtering?
    // The previous frontend fetched entities/list which is the tree.
    // So we can return that directly.
    Promise.resolve(null) // placeholder, logic below
  ])

  // Need to call getEntitiesForUser with potential API key perms if we were using API key, but we are session based here.
  // The helper expects apiKeyPerms as second arg, defaults to empty.
  const entityTree = await getEntitiesForUser(userId)

  // Collect visible IDs
  const visibleEntityIds = new Set<string>()
  function collectIds(nodes: any[]) {
    for (const node of nodes) {
      visibleEntityIds.add(String(node.entityId))
      if (node.children) collectIds(node.children)
    }
  }
  collectIds(entityTree)

  // Helper to sanitize/fallback hidden entities
  function sanitizeEntity(ent: any) {
    if (!ent) return null
    if (visibleEntityIds.has(String(ent.entityId))) {
      return ent
    }

    if (ent.type === 'user' && ent.teamId) {
      // Try to extract team name from "DisplayName (TeamName)" format
      let teamName = "Team"
      const match = /\(([^)]+)\)$/.exec(ent.name)
      if (match) teamName = match[1]

      return {
        ...ent,
        entityId: 0, // Generic ID
        name: `Member of ${teamName}`,
        type: 'user_hidden',
        userTeamId: null
      }
    }

    return {
      ...ent,
      entityId: 0,
      name: "Unknown Entity",
      type: 'unknown'
    }
  }

  // B. Pre-calculate allowed transitions

  // Ticket shadow object for permission check (needs to match what verifyChangePermission expects)
  // verifyChangePermission expects currentAssignedTo as { id, userTeamId, teamId }
  const ticketForPerm = {
    ...ticket,
    currentAssignedTo: ticket.currentAssignedTo ? {
      id: ticket.currentAssignedTo.id,
      userTeamId: ticket.currentAssignedTo.userTeamId ?? undefined,
      teamId: ticket.currentAssignedTo.teamId ?? ticket.currentAssignedTo.userTeam?.teamId ?? undefined
    } : null,
    createdBy: ticket.createdBy ? {
      id: ticket.createdBy.id,
      userTeamId: ticket.createdBy.userTeamId ?? undefined,
      teamId: ticket.createdBy.teamId ?? ticket.createdBy.userTeam?.teamId ?? undefined
    } : null
  }

  const allowedStatuses = statuses.filter(s => {
    try {
      verifyChangePermission(access, ticketForPerm, 'status', ticket.currentStatusId, s.id)
      return true
    } catch { return false }
  }).map(s => s.id)

  const allowedPriorities = priorities.filter(p => {
    try {
      verifyChangePermission(access, ticketForPerm, 'priority', ticket.currentPriorityId, p.id)
      return true
    } catch { return false }
  }).map(p => p.id)

  const allowedCategories = allCategories.filter(c => {
    try {
      verifyChangePermission(access, ticketForPerm, 'category', ticket.currentCategoryId, c.id)
      return true
    } catch { return false }
  }).map(c => c.id)

  // Allowed Assignees
  // We need to flatten the entity tree to check perms against each "leaf" (users) or "node" (teams)
  // Or just check rules.
  // Actually, verifyChangePermission for 'assigned' expects a specific entity ID TO check.
  // But permission rules for assignment are usually generic (assigned:any or assigned:team).
  // Checking every single entity might be expensive if there are thousands.
  // However, traditionally, if you have 'ticket:action:change:assigned:any', you can assign to ANY valid entity.
  // If 'ticket:action:change:assigned:team', you can assign to YOUR teams.
  // Let's iterate the tree and check.
  // The entity/list returns a tree structure.
  // We need to return which IDs are valid.

  const validEntityIds: string[] = []
  function traverse(nodes: any[]) {
    for (const node of nodes) {
      // Node is { entityId, type, ... children }
      // entityId is String in the tree response from route, but verifyChangePermission expects number for 'toId' (which is the Entity.id)
      const eId = Number(node.entityId)
      try {
        // Checking assignment TO this entity
        // Note: verifyChangePermission checks "from" (current assigned) and "to" (new assigned).
        // Using 'any' for fromId? No, fromId is currentAssignedTo.entityId (or null/0)
        // But wait, access-ticket-change.ts: verifyChangePermission(..., fromId, toId)
        // fromId is the ID of current assigned *Entity*? Or *UserTeam*?
        // Actually looking at verifyChangePermission implementation:
        // if (pFrom !== 'any' && Number(pFrom) !== fromId) continue
        // So fromId is expected to match the rule's from-clause.
        // And `ticket:action:change:assigned:from:any:to:any`
        // So yes, fromId is the Entity ID of current assignee.
        const currentEntityId = ticket.currentAssignedTo?.id ?? 0
        verifyChangePermission(access, ticketForPerm, 'assigned', currentEntityId, eId)
        validEntityIds.push(node.entityId)
      } catch { }

      if (node.children) traverse(node.children)
    }
  }
  traverse(entityTree)

  // Can Claim?
  let canClaim = false
  if (ticket.currentAssignedTo) {
    // Claim means assigning to start working on it.
    // Usually means changing assignment from "Team (Unassigned)" to "Me (UserTeam)".
    // The specific permission ticket:action:claim check is handled in `verifyTicketAccess` or custom logic?
    // In `verifyChangePermission` there is a block: } else if (parts[2] === 'claim' && type === 'assigned') {
    // It checks if we are assigning to self.
    // So "Can Claim" is basically: Can I assign this ticket to MYSELF?
    // We can check if any of the user's MyUserTeam IDs are in the validEntityIds list.
    // But `validEntityIds` are Entity IDs (UserTeam.entityId or Team.entityId).
    // We need to know the Entity ID of the current user's UserTeams.
    // We fetched userTeams at the top: `select: { id: true, teamId: true }`.
    // We didn't fetch their Entity ID.
    // Let's resolve that.
  }

  // To check if "claim" is allowed, we specifically look for 'ticket:action:claim:*' permissions
  // OR just rely on normal assignment rules being able to assign to self.
  // The frontend currently has `canClaimTicket` logic which looks for `ticket:action:claim:...`.
  // Let's replicate strict claim permission check.
  try {
    // verifyChangePermission handles 'claim' logic if we pass type='assigned' and check specific claim rules?
    // Actually `verifyChangePermission` has a special block for 'claim'.
    // `else if (parts[2] === 'claim' && type === 'assigned')`
    // It triggers if we iterate permissions and find a claim rule.
    // It verifies if `fromId` is unassigned (0 or 'any') and `toId` is self.
    // So to check if "Claim button" should be enabled, we assume user wants to assign to self.
    // We don't know which UserTeam they will use (if they have multiple).
    // But if ANY of their UserTeams is a valid target, then yes.
    // OR we just check if they have the claim permission valid for this ticket.
    // Simplest: Check if `ticket:action:claim:...` perms exist and match scope.
    const claimPerms = allPermissions.filter(p => p.startsWith('ticket:action:claim:'))
    if (claimPerms.length > 0) {
      // Just basic check as per frontend logic:
      // ticket:action:claim:any or ticket:action:claim:team:unclaimed
      // and checking scope against ticket state.
      // We can interpret this here or just pass the boolean.
      // Let's try to interpret "Can I claim this?"
      // Claiming is only valid if currently assigned to a Team but NOT a user (Unclaimed).
      const isUnclaimed = ticket.currentAssignedTo?.teamId && !ticket.currentAssignedTo.userTeamId
      if (isUnclaimed) {
        // Check scopes
        canClaim = claimPerms.some(p => {
          const parts = p.split(':')
          const scope = parts[3]
          // Scope: any, team:unclaimed (which implies team check)
          if (scope === 'any') return true
          if (scope === 'team:unclaimed') {
            // Must be assigned to one of my teams
            return userTeams.some(ut => ut.teamId === ticket.currentAssignedTo?.teamId)
          }
          return false
        })
      }
    }
  } catch { }

  // Can Reply?
  // 1. Ticket must not be Closed (4)
  // 2. User must have permission
  const canReply = ticket.currentStatusId !== 4 && hasThreadCreatePermission(access, ticket.currentAssignedTo?.id)

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
      currentAssignedTo: ticket.currentAssignedTo ? sanitizeEntity(formatEntity(ticket.currentAssignedTo)) : null,
      createdBy: sanitizeEntity(formatEntity(ticket.createdBy)),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt
    },
    lastReadEvent: lastRead ? { type: lastRead.type, id: lastRead.id } : null,
    activityLog,
    // New Metadata & Permissions
    meta: {
      statuses,
      priorities,
      categories: allCategories, // Or flatten? Frontend expects tree or flat?
      // Sidebar uses flat but also tree. It flattens it itself.
      // But wait sidebar fetched /api/ticket/category/list which returns tree.
      // Here `allCategories` is flat list from `prisma.findMany`.
      // We should probably return the tree structure for categories if that's what frontend wants,
      // or just return all and let frontend flatten/build tree.
      // Given `allCategories` contains parentId, frontend can build tree.
      // BUT sidebar logic used `flattenCategories` on a tree.
      // Let's reconstruct the category tree to be consistent with what sidebar expects.
      // Or simplify sidebar to take flat list.
      // Existing /api/ticket/category/list returns tree.
      // Let's build tree here to match.
      categoryTree: buildCategoryTree(allCategories),
      entities: entityTree
    },
    allowedActions: {
      allowedStatuses,
      allowedPriorities,
      allowedCategories,
      allowedAssignees: validEntityIds,
      canClaim,
      canReply
    }
  })
}

function buildCategoryTree(flatCats: any[]) {
  const map = new Map(flatCats.map(c => [c.id, { ...c, children: [] }]))
  const roots: any[] = []
  for (const c of flatCats) {
    const node = map.get(c.id)
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId).children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

