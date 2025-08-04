import { prisma } from '@/lib/prisma'

interface AccessibleTicket {
  ticketId: number
  accessVia: {
    userTeamId: number
    teamId: number
    from: 'userTeam' | 'team'
    permission: string
    type: 'assignment' | 'creation'
  }[]
}

interface UserAccessibleTicketsResponse {
  userId: number
  tickets: AccessibleTicket[]
}

export async function getAccessibleTicketsByUser(
  userId: number,
  sessionUser: any,
  limit: number = 100
): Promise<UserAccessibleTicketsResponse> {
  const userTeams = sessionUser.teams.map((t: any) => ({
    id: t.userTeamId,
    teamId: t.teamId,
    permissions: t.userTeamPermissions,
    teamPermissions: t.permissions
  }))

  const userTeamPerms: Array<{
    userTeamId: number
    teamId: number
    source: 'userTeam' | 'team'
    type: 'assignment' | 'creation'
    permission: string
  }> = []

  for (const ut of userTeams) {
    const combinedPerms = [
      ...ut.permissions.map((p: any) => ({ from: 'userTeam' as const, value: p })),
      ...ut.teamPermissions.map((p: any) => ({ from: 'team' as const, value: p }))
    ]

    for (const perm of combinedPerms) {
      if (perm.value.startsWith('ticket:read:assigned')) {
        userTeamPerms.push({
          userTeamId: ut.id,
          teamId: ut.teamId,
          source: perm.from,
          type: 'assignment',
          permission: perm.value
        })
      } else if (perm.value.startsWith('ticket:read:createdby')) {
        userTeamPerms.push({
          userTeamId: ut.id,
          teamId: ut.teamId,
          source: perm.from,
          type: 'creation',
          permission: perm.value
        })
      }
    }
  }

  // Check for synthetic access via ticket:action:*:any permissions
  const actionPerms: string[] = []
  for (const ut of userTeams) {
    const combinedPerms = [
      ...ut.permissions.map((p: any) => ({ from: 'userTeam' as const, value: p })),
      ...ut.teamPermissions.map((p: any) => ({ from: 'team' as const, value: p }))
    ]
    
    for (const perm of combinedPerms) {
      if (perm.value.startsWith('ticket:action:') && perm.value.includes(':any')) {
        actionPerms.push(perm.value)
      }
    }
  }

  // If user has any ticket:action:*:any permission, grant access to all tickets
  const hasAnyActionAny = actionPerms.some(p => {
    const parts = p.split(":");
    return parts[0] === 'ticket' && parts[1] === 'action' && parts.includes('any');
  });

  if (userTeamPerms.length === 0 && !hasAnyActionAny) return { userId, tickets: [] }

  // Fetch entity IDs for user's UserTeams and Teams
  const userTeamIds = userTeams.map((ut: any) => ut.id)
  const teamIds = userTeams.map((ut: any) => ut.teamId)
  const [userTeamEntities, teamEntities] = await Promise.all([
    prisma.entity.findMany({ where: { userTeamId: { in: userTeamIds } }, select: { id: true, userTeamId: true } }),
    prisma.entity.findMany({ where: { teamId: { in: teamIds } }, select: { id: true, teamId: true } })
  ])
  const userTeamEntityIds = userTeamEntities.map(e => e.id)
  const teamEntityIds = teamEntities.map(e => e.id)
  const allEntityIds = [...userTeamEntityIds, ...teamEntityIds]

  // Build WHERE clause - if user has synthetic access, get all tickets
  let whereClause: any = {}
  if (hasAnyActionAny) {
    whereClause = {} // Get all tickets
  } else {
    whereClause = {
      OR: userTeamPerms.flatMap(p => {
        const conds: any[] = []
        if (p.type === 'assignment') {
          if (p.permission === 'ticket:read:assigned:any') {
            conds.push({}) // Get ALL tickets assigned to anyone
          } else if (p.permission === 'ticket:read:assigned:team:any') {
            conds.push({ currentAssignedTo: { teamId: p.teamId } })
            // Entity-aware: also allow if currentAssignedToId is the team entity
            const teamEntity = teamEntities.find(e => e.teamId === p.teamId)
            if (teamEntity) conds.push({ currentAssignedToId: teamEntity.id })
          } else if (p.permission === 'ticket:read:assigned:team:unclaimed') {
            conds.push({ currentAssignedTo: { teamId: p.teamId, userTeamId: null } })
            // Entity-aware: also allow if currentAssignedToId is the team entity and unclaimed
            const teamEntity = teamEntities.find(e => e.teamId === p.teamId)
            if (teamEntity) conds.push({ currentAssignedToId: teamEntity.id })
          } else if (p.permission === 'ticket:read:assigned:self') {
            conds.push({ currentAssignedTo: { userTeamId: p.userTeamId } })
            // Entity-aware: also allow if currentAssignedToId is the userTeam entity
            const utEntity = userTeamEntities.find(e => e.userTeamId === p.userTeamId)
            if (utEntity) conds.push({ currentAssignedToId: utEntity.id })
          }
        } else if (p.type === 'creation') {
          if (p.permission === 'ticket:read:createdby:any') {
            conds.push({}) // Get ALL tickets created by anyone
          } else if (p.permission === 'ticket:read:createdby:team:any') {
            conds.push({ createdBy: { teamId: p.teamId } })
            // Entity-aware: also allow if createdById is the team entity
            const teamEntity = teamEntities.find(e => e.teamId === p.teamId)
            if (teamEntity) conds.push({ createdById: teamEntity.id })
          } else if (p.permission === 'ticket:read:createdby:self') {
            conds.push({ createdBy: { userTeamId: p.userTeamId } })
            // Entity-aware: also allow if createdById is the userTeam entity
            const utEntity = userTeamEntities.find(e => e.userTeamId === p.userTeamId)
            if (utEntity) conds.push({ createdById: utEntity.id })
          }
        }
        return conds
      })
    }
  }

  // Get relevant ticket matches
  const tickets = await prisma.ticket.findMany({
    where: whereClause,
    select: {
      id: true,
      currentAssignedTo: { select: { teamId: true, userTeamId: true } },
      createdBy: { select: { teamId: true, userTeamId: true } }
    },
    take: limit
  })

  // Determine how user has access for each ticket
  const ticketMap = new Map<number, AccessibleTicket>()

  for (const ticket of tickets) {
    const ways: AccessibleTicket['accessVia'] = []

    // Check explicit read permissions
    for (const rule of userTeamPerms) {
      const assigned = ticket.currentAssignedTo
      const created = ticket.createdBy

      if (rule.type === 'assignment') {
        if (
          rule.permission === 'ticket:read:assigned:any' ||
          (rule.permission === 'ticket:read:assigned:team:any' && assigned?.teamId === rule.teamId) ||
          (rule.permission === 'ticket:read:assigned:team:unclaimed' && assigned?.teamId === rule.teamId && assigned?.userTeamId == null) ||
          (rule.permission === 'ticket:read:assigned:self' && assigned?.userTeamId === rule.userTeamId)
        ) {
          ways.push({
            userTeamId: rule.userTeamId,
            teamId: rule.teamId,
            from: rule.source,
            permission: rule.permission,
            type: 'assignment'
          })
        }
      } else if (rule.type === 'creation') {
        if (
          rule.permission === 'ticket:read:createdby:any' ||
          (rule.permission === 'ticket:read:createdby:team:any' && created?.teamId === rule.teamId) ||
          (rule.permission === 'ticket:read:createdby:self' && created?.userTeamId === rule.userTeamId)
        ) {
          ways.push({
            userTeamId: rule.userTeamId,
            teamId: rule.teamId,
            from: rule.source,
            permission: rule.permission,
            type: 'creation'
          })
        }
      }
    }

    // Check synthetic access via ticket:action:*:any permissions
    if (ways.length === 0 && hasAnyActionAny) {
      // Add synthetic access for both assignment and creation
      ways.push({
        userTeamId: 0,
        teamId: 0,
        from: 'userTeam',
        permission: 'ticket:action:any',
        type: 'assignment'
      })
      ways.push({
        userTeamId: 0,
        teamId: 0,
        from: 'userTeam',
        permission: 'ticket:action:any',
        type: 'creation'
      })
    }

    if (ways.length > 0) {
      ticketMap.set(ticket.id, {
        ticketId: ticket.id,
        accessVia: ways
      })
    }
  }

  return {
    userId,
    tickets: Array.from(ticketMap.values())
  }
}
