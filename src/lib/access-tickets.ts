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
  limit: number = 100
): Promise<UserAccessibleTicketsResponse> {
  const userTeams = await prisma.userTeam.findMany({
    where: { userId, Active: true },
    select: {
      id: true,
      teamId: true,
      permissions: true
    }
  })

  const teamIds = Array.from(new Set(userTeams.map(ut => ut.teamId)))
  const teamPerms = await prisma.team.findMany({
    where: { id: { in: teamIds }, Active: true },
    select: {
      id: true,
      permissions: true
    }
  })

  const teamPermMap = new Map<number, string[]>()
  teamPerms.forEach(t => teamPermMap.set(t.id, t.permissions))

  const userTeamPerms: Array<{
    userTeamId: number
    teamId: number
    source: 'userTeam' | 'team'
    type: 'assignment' | 'creation'
    permission: string
  }> = []

  for (const ut of userTeams) {
    const combinedPerms = [
      ...ut.permissions.map(p => ({ from: 'userTeam' as const, value: p })),
      ...(teamPermMap.get(ut.teamId) || []).map(p => ({ from: 'team' as const, value: p }))
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

  if (userTeamPerms.length === 0) return { userId, tickets: [] }

  // Get relevant ticket matches
  const tickets = await prisma.ticket.findMany({
    where: {
      OR: userTeamPerms.flatMap(p => {
        const conds: any[] = []
        if (p.type === 'assignment') {
          if (p.permission === 'ticket:read:assigned:any') {
            conds.push({})
          } else if (p.permission === 'ticket:read:assigned:team:any') {
            conds.push({ currentAssignedTo: { teamId: p.teamId } })
          } else if (p.permission === 'ticket:read:assigned:team:unclaimed') {
            conds.push({
              currentAssignedTo: {
                teamId: p.teamId,
                userTeamId: null
              }
            })
          } else if (p.permission === 'ticket:read:assigned:self') {
            conds.push({ currentAssignedTo: { userTeamId: p.userTeamId } })
          }
        } else if (p.type === 'creation') {
          if (p.permission === 'ticket:read:createdby:any') {
            conds.push({})
          } else if (p.permission === 'ticket:read:createdby:team:any') {
            conds.push({ createdBy: { teamId: p.teamId } })
          } else if (p.permission === 'ticket:read:createdby:self') {
            conds.push({ createdBy: { userTeamId: p.userTeamId } })
          }
        }
        return conds
      })
    },
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
