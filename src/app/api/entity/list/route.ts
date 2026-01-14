// src/app/api/entity/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { PermissionError, handlePermissionError } from '@/lib/permission-error'

export async function getEntitiesForUser(userId: number | null, apiKeyPerms: string[] = []) {
  // 2) Build permissions set
  const permSet = new Set(apiKeyPerms)
  if (userId !== null) {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        permissions: true,
        userTeams: {
          where: { Active: true },
          select: { permissions: true, team: { select: { permissions: true } } }
        }
      }
    })
    if (!me) throw new Error('Unauthorized')
    me.permissions.forEach(p => permSet.add(p))
    me.userTeams.forEach(ut => {
      ut.permissions.forEach(p => permSet.add(p))
      ut.team.permissions.forEach(p => permSet.add(p))
    })
  }

  const canAny = permSet.has('entity:list:any')
  const canOwn = permSet.has('entity:list:own') // Legacy "Own + Related"
  const canTeamAny = permSet.has('entity:list:team:any') || permSet.has('team:list')

  // New Granular Permissions
  const canListUserAny = permSet.has('entity:list:user:any')
  const canListUserOwn = permSet.has('entity:list:user:own')

  const specificUserTeamIds = new Set<number>()
  permSet.forEach(p => {
    if (p.startsWith('entity:list:user:team:')) {
      const parts = p.split(':')
      if (parts.length === 5) {
        const tid = Number(parts[4])
        if (!isNaN(tid)) specificUserTeamIds.add(tid)
      }
    }
  })

  // Start with restrictive check. 
  // If no global permissions, check if we have ANY granular permissions.
  // Note: canTeamAny only grants TEAM visibility.
  if (!canAny && !canOwn && !canTeamAny && !canListUserAny && !canListUserOwn && specificUserTeamIds.size === 0) {
    throw new PermissionError('entity:list:any OR entity:list:own OR entity:list:team:any', 'entity')
  }

  // 3) Build filter
  let whereClause: any = {}

  if (!canAny && !canListUserAny) {
    const orConditions: any[] = []

    // -- TEAM VISIBILITY --
    // If canAny (handled above) -> All.
    // If canTeamAny -> All Teams.
    if (canTeamAny) {
      orConditions.push({ teamId: { not: null } })
    }

    // -- USER VISIBILITY --

    // 1. Specific Teams' Users
    if (specificUserTeamIds.size > 0) {
      orConditions.push({ userTeam: { teamId: { in: Array.from(specificUserTeamIds) } } })
    }

    // 2. Own Team Users (Strict)
    if (canListUserOwn && userId !== null) {
      const ownTeams = await prisma.userTeam.findMany({
        where: { userId, Active: true },
        select: { teamId: true }
      })
      const ownTeamIds = ownTeams.map(r => r.teamId)
      orConditions.push({ userTeam: { teamId: { in: ownTeamIds } } })
    }

    // 3. Legacy "Own" (Own + Related) - Applies to both Teams and Users if strict flags aren't used?
    // User requested explicit separate logic.
    // If we rely purely on new flags for users, we might ignore canOwn for users.
    // But to maintain backward compatibility, `canOwn` should probably still work?
    // The user's new requirements seem to supersede "related" logic for USER visibility.
    // But "canOwn" was "related teams".
    if (canOwn && userId !== null) {
      const ownTeams = await prisma.userTeam.findMany({
        where: { userId, Active: true },
        select: { teamId: true }
      })
      const ownTeamIds = ownTeams.map(r => r.teamId)
      const catIds = (await prisma.ticketCategoryAvailabilityTeam.findMany({
        where: { teamId: { in: ownTeamIds } },
        select: { ticketCategoryId: true }
      })).map(r => r.ticketCategoryId)
      const related = (await prisma.ticketCategoryAvailabilityTeam.findMany({
        where: { ticketCategoryId: { in: catIds } },
        select: { teamId: true }
      })).map(r => r.teamId)
      const allTeamIds = Array.from(new Set([...ownTeamIds, ...related]))

      // canOwn grants visibility to TEAMS and USERS of related teams?
      // Based on previous code: Yes.
      // But user wants to restrict GIC from seeing ICTA users even if related.
      // So effectively, for the new Roles, we should NOT give them `entity:list:own`.
      // We should give them `entity:list:team:any` + `entity:list:user:own` (strict).
      // So this block is fine to stay for legacy/other roles, but we won't assign `entity:list:own` to GIC.

      orConditions.push({ teamId: { in: allTeamIds } })
      orConditions.push({ userTeam: { teamId: { in: allTeamIds } } })
    }

    if (orConditions.length > 0) {
      whereClause = { OR: orConditions }
    } else {
      whereClause = { id: -1 }
    }
  }

  // 4) Fetch all matching entities
  const entities = await prisma.entity.findMany({
    where: whereClause,
    select: {
      id: true,
      teamId: true,
      userTeamId: true,
      team: { select: { name: true, priority: true, id: true } },
      userTeam: { select: { teamId: true, user: { select: { displayName: true } } } }
    }
  })

  // 5) Build tree: teams as roots, users as children
  const teamMap = new Map<number, { entityId: string; type: 'team'; name: string; priority: number; children: any[] }>()
  for (const e of entities) {
    if (e.teamId) {
      teamMap.set(e.teamId, {
        entityId: e.id.toString(),
        type: 'team',
        name: e.team!.name,
        priority: e.team!.priority,
        children: []
      })
    }
  }
  for (const e of entities) {
    if (e.userTeamId && e.userTeam) {
      const parent = teamMap.get(e.userTeam.teamId)
      if (parent) {
        parent.children.push({
          entityId: e.id.toString(),
          type: 'user',
          name: e.userTeam.user.displayName
        })
      }
    }
  }

  // 6) Sort children alphabetically and roots by priority
  for (const node of teamMap.values()) {
    node.children.sort((a, b) => a.name.localeCompare(b.name))
  }
  const tree = Array.from(teamMap.values()).sort((a, b) =>
    a.priority - b.priority || a.name.localeCompare(b.name)
  )

  return tree
}

export async function GET(req: NextRequest) {
  // 1) Authenticate (session or x-api-key)
  const session = await getServerSession(authOptions)
  let userId: number | null = null
  let apiKeyPerms: string[] = []

  if (session) {
    userId = Number((session.user as any).id)
  } else {
    const key = req.headers.get('x-api-key')
    if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ak = await prisma.apiKey.findUnique({
      where: { key },
      select: { permissions: true }
    })
    if (!ak) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    apiKeyPerms = ak.permissions
  }

  try {
    const tree = await getEntitiesForUser(userId, apiKeyPerms)
    return NextResponse.json(tree)
  } catch (err) {
    return handlePermissionError(err)
  }
}
