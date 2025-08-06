// src/lib/access-ticket-user.ts

import { prisma } from '@/lib/prisma'

export interface AccessVia {
  userTeamId: number
  teamId:     number
  from:       'userTeam' | 'team'
  permission: string
  type:       'assignment' | 'creation'
}

export interface TicketAccessForUserResponse {
  userId:            number
  ticketId:          number
  accessVia:         AccessVia[]
  actionPermissions: string[]
}

/**
 * Determine whether `userId` has read access to `ticketId`,
 * by which rule(s), and collect any ticket:action:* permissions.
 * Returns null if no read access.
 */
export async function getTicketAccessForUser(
  userId:   number,
  ticketId: number
): Promise<TicketAccessForUserResponse | null> {
  // 1) load this user's active UserTeams + permissions
  const userTeams = await prisma.userTeam.findMany({
    where: { userId, Active: true },
    select: { id: true, teamId: true, permissions: true }
  })
  if (userTeams.length === 0) return null

  // 2) load those teams' permissions
  const teamIds = Array.from(new Set(userTeams.map(ut => ut.teamId)))
  const teams   = await prisma.team.findMany({
    where: { id: { in: teamIds }, Active: true },
    select: { id: true, permissions: true }
  })
  const teamPermMap = new Map(teams.map(t => [t.id, t.permissions]))

  // 3) build read‐access rules and collect action perms
  type Rule = {
    userTeamId: number
    teamId:     number
    from:       'userTeam' | 'team'
    type:       'assignment' | 'creation'
    permission: string
  }

  const rules: Rule[] = []
  const actionPermSet = new Set<string>()

  for (const ut of userTeams) {
    // combine userTeam + team perms
    const combined = [
      ...ut.permissions.map(p => ({ from: 'userTeam' as const, value: p })),
      ...(teamPermMap.get(ut.teamId) || []).map(p => ({ from: 'team' as const, value: p }))
    ]

    for (const { from, value } of combined) {
      // collect ticket:action:* permissions
      if (value.startsWith('ticket:action:')) {
        actionPermSet.add(value)
      }

      // collect read:assigned rules
      if (value.startsWith('ticket:read:assigned')) {
        rules.push({
          userTeamId: ut.id,
          teamId:     ut.teamId,
          from,
          type:       'assignment',
          permission: value
        })
      }

      // collect read:createdby rules
      if (value.startsWith('ticket:read:createdby')) {
        rules.push({
          userTeamId: ut.id,
          teamId:     ut.teamId,
          from,
          type:       'creation',
          permission: value
        })
      }
    }
  }
  if (rules.length === 0) return null

  // 4) fetch this ticket's assignment & creator
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      currentAssignedTo: { select: { teamId: true, userTeamId: true } },
      createdBy:         { select: { teamId: true, userTeamId: true } }
    }
  })
  if (!ticket) return null

  // 5) evaluate which rules grant read access
  const via: AccessVia[] = []
  for (const r of rules) {
    const { type, permission, teamId, userTeamId, from } = r

    if (type === 'assignment' && ticket.currentAssignedTo) {
      const a = ticket.currentAssignedTo
      if (
        permission === 'ticket:read:assigned:any' ||
        (permission === 'ticket:read:assigned:team:any'        && a.teamId === teamId) ||
        (permission === 'ticket:read:assigned:team:unclaimed' && a.teamId === teamId && a.userTeamId == null) ||
        (permission === 'ticket:read:assigned:self'           && a.userTeamId === userTeamId)
      ) {
        via.push({ userTeamId, teamId, from, permission, type })
      }
    }

    if (type === 'creation' && ticket.createdBy) {
      const c = ticket.createdBy
      if (
        permission === 'ticket:read:createdby:any' ||
        (permission === 'ticket:read:createdby:team:any' && c.teamId === teamId) ||
        (permission === 'ticket:read:createdby:self'      && c.userTeamId === userTeamId)
      ) {
        via.push({ userTeamId, teamId, from, permission, type })
      }
    }
  }

  // Grant synthetic accessVia for users with any ticket:action:*:any permission
  // (REMOVED: This previously allowed action permissions to grant read access)
  // if (via.length === 0) {
  //   const actionPerms = Array.from(actionPermSet);
  //   const hasAnyActionAny = actionPerms.some(p => {
  //     const parts = p.split(":");
  //     // ticket:action:<action>:...:any or ticket:action:<action>:...:...:any
  //     return parts[0] === 'ticket' && parts[1] === 'action' && parts.includes('any');
  //   });
  //   if (hasAnyActionAny) {
  //     // Add both assignment and creation synthetic access
  //     via.push({
  //       userTeamId: 0,
  //       teamId: 0,
  //       from: 'userTeam',
  //       permission: 'ticket:action:any',
  //       type: 'assignment'
  //     });
  //     via.push({
  //       userTeamId: 0,
  //       teamId: 0,
  //       from: 'userTeam',
  //       permission: 'ticket:action:any',
  //       type: 'creation'
  //     });
  //   }
  // }

  if (via.length === 0) return null

  return {
    userId,
    ticketId,
    accessVia:         via,
    actionPermissions: Array.from(actionPermSet)
  }
}
