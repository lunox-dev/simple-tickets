// src/app/api/entity/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession }      from 'next-auth/next'
import { authOptions }           from '@/app/api/auth/[...nextauth]/route'
import { prisma }                from '@/lib/prisma'

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
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    me.permissions.forEach(p => permSet.add(p))
    me.userTeams.forEach(ut => {
      ut.permissions.forEach(p => permSet.add(p))
      ut.team.permissions.forEach(p => permSet.add(p))
    })
  }

  const canAny = permSet.has('entity:list:any')
  const canOwn = permSet.has('entity:list:own')
  if (!canAny && !canOwn) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3) Build “own” filter if needed
  let whereClause: any = {}
  if (!canAny && userId !== null) {
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
    whereClause = {
      OR: [
        { teamId:    { in: allTeamIds } },
        { userTeamId:{ in: allTeamIds } }
      ]
    }
  }

  // 4) Fetch all matching entities
  const entities = await prisma.entity.findMany({
    where: whereClause,
    select: {
      id:         true,
      teamId:     true,
      userTeamId: true,
      team:       { select: { name: true, priority: true, id: true } },
      userTeam:   { select: { teamId: true, user: { select: { displayName: true } } } }
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

  return NextResponse.json(tree)
}
