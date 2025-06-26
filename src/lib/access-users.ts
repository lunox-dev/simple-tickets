import { prisma } from '@/lib/prisma'

export interface TicketAccessUser {
  userId: number
  userTeams: Array<{
    userTeamId: number
    userTeamEntity: {
      userTeamEntityId: string
      permissions: string[]
    }
    teamId: number
    teamEntity: {
      teamEntityId: string
      permissions: string[]
    }
  }>
}

export interface TicketAccessResponse {
  ticketId: number
  users: TicketAccessUser[]
}

export async function getTicketAccessUsers(ticketId: number): Promise<TicketAccessResponse> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      currentAssignedTo: { select: { teamId: true, userTeamId: true } },
      createdBy: { select: { teamId: true, userTeamId: true } }
    }
  })
  if (!ticket) return { ticketId, users: [] }

  const asgTeamId = ticket.currentAssignedTo?.teamId
  const asgUserTeamId = ticket.currentAssignedTo?.userTeamId
  const cbTeamId = ticket.createdBy?.teamId
  const cbUserTeamId = ticket.createdBy?.userTeamId

  let assignUTs: Array<{ id: number; userId: number; teamId: number; permissions: string[] }> = []
  if (asgTeamId) {
    assignUTs = await prisma.userTeam.findMany({
      where: { teamId: asgTeamId, Active: true },
      select: { id: true, userId: true, teamId: true, permissions: true }
    })
  } else if (asgUserTeamId) {
    const me = await prisma.userTeam.findUnique({
      where: { id: asgUserTeamId },
      select: { userId: true, Active: true }
    })
    if (me?.Active) {
      assignUTs = await prisma.userTeam.findMany({
        where: { userId: me.userId, Active: true },
        select: { id: true, userId: true, teamId: true, permissions: true }
      })
    }
  }

  const creationUTs = await prisma.userTeam.findMany({
    where: { Active: true },
    select: { id: true, userId: true, teamId: true, permissions: true }
  })

  const allTeamIds = Array.from(new Set([...assignUTs, ...creationUTs].map(u => u.teamId)))
  const teams = await prisma.team.findMany({
    where: { id: { in: allTeamIds }, Active: true },
    select: { id: true, permissions: true }
  })
  const teamPermMap = new Map<number, string[]>()
  teams.forEach(t => teamPermMap.set(t.id, t.permissions))

  const [teamEntities, utEntities] = await Promise.all([
    prisma.entity.findMany({
      where: { teamId: { in: allTeamIds } },
      select: { id: true, teamId: true }
    }),
    prisma.entity.findMany({
      where: { userTeamId: { in: [...assignUTs, ...creationUTs].map(u => u.id) } },
      select: { id: true, userTeamId: true }
    })
  ])
  const teamEntityMap = new Map<number, string>()
  teamEntities.forEach(e => e.teamId && teamEntityMap.set(e.teamId, String(e.id)))
  const utEntityMap = new Map<number, string>()
  utEntities.forEach(e => e.userTeamId && utEntityMap.set(e.userTeamId, String(e.id)))

  const utInfoMap = new Map<number, { userId: number; teamId: number }>()
  assignUTs.forEach(u => utInfoMap.set(u.id, { userId: u.userId, teamId: u.teamId }))
  creationUTs.forEach(u => utInfoMap.set(u.id, { userId: u.userId, teamId: u.teamId }))

  const utAccess = new Map<number, Map<number, {
    assignmentPerms: Set<string>
    creationPerms: Set<string>
  }>>()

  const ASSIGN_PREFIX = 'ticket:read:assigned'
  const CREATE_PREFIX = 'ticket:read:createdby'

  // Universal match = allow all tickets
  const universalAssignPerms = new Set(['ticket:read:assigned:any'])
  const universalCreatePerms = new Set(['ticket:read:createdby:any'])

  for (const ut of [...assignUTs, ...creationUTs]) {
    const allPerms = new Set([
      ...ut.permissions,
      ...(teamPermMap.get(ut.teamId) ?? [])
    ])

    const assignmentPerms = new Set<string>()
    const creationPerms = new Set<string>()

    for (const perm of allPerms) {
      if (perm.startsWith(ASSIGN_PREFIX)) {
        if (perm === 'ticket:read:assigned:any') {
          assignmentPerms.add(perm)
        } else if (perm === 'ticket:read:assigned:team:any' && ut.teamId === asgTeamId) {
          assignmentPerms.add(perm)
        } else if (perm === 'ticket:read:assigned:self' && ut.id === asgUserTeamId) {
          assignmentPerms.add(perm)
        } else if (perm === 'ticket:read:assigned:team:unclaimed' && asgUserTeamId == null && ut.teamId === asgTeamId) {
          assignmentPerms.add(perm)
        }
      }

      if (perm.startsWith(CREATE_PREFIX)) {
        if (perm === 'ticket:read:createdby:any') {
          creationPerms.add(perm)
        } else if (perm === 'ticket:read:createdby:team:any' && ut.teamId === cbTeamId) {
          creationPerms.add(perm)
        } else if (perm === 'ticket:read:createdby:self' && ut.id === cbUserTeamId) {
          creationPerms.add(perm)
        }
      }
    }

    if (assignmentPerms.size || creationPerms.size) {
      const { userId } = utInfoMap.get(ut.id)!
      let userMap = utAccess.get(userId)
      if (!userMap) {
        userMap = new Map()
        utAccess.set(userId, userMap)
      }
      userMap.set(ut.id, {
        assignmentPerms,
        creationPerms
      })
    }
  }

  const users: TicketAccessUser[] = []
  for (const [userId, userMap] of utAccess) {
    const userTeams = []
    for (const [utId, permsObj] of userMap) {
      const info = utInfoMap.get(utId)!
      userTeams.push({
        userTeamId: utId,
        userTeamEntity: {
          userTeamEntityId: utEntityMap.get(utId)!,
          permissions: Array.from(permsObj.assignmentPerms)
        },
        teamId: info.teamId,
        teamEntity: {
          teamEntityId: teamEntityMap.get(info.teamId)!,
          permissions: Array.from(permsObj.creationPerms)
        }
      })
    }
    users.push({ userId, userTeams })
  }

  return { ticketId, users }
}
