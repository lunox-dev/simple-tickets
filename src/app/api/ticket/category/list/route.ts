// src/app/api/ticket/category/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Permissions
  const userTeams = (session.user as any).teams as Array<{
    userTeamId: number
    teamId: number
    name: string
    permissions: string[]
    userTeamPermissions: string[]
    entities?: number[]
  }>
  const allPerms = userTeams.flatMap(t => [...t.permissions, ...t.userTeamPermissions])
  const canViewAny = allPerms.includes('ticketcategory:view:any')
  const canViewOwn = allPerms.includes('ticketcategory:view:own')
  if (!canViewAny && !canViewOwn) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Fetch all categories (we'll filter down if needed)
  const allCats = await prisma.ticketCategory.findMany({
    select: { id: true, name: true, childDropdownLabel: true, parentId: true, priority: true },
    orderBy: { priority: 'asc' }
  })

  let cats = allCats

  // 4. If only "own", expand allowed roots to include all their descendants
  if (!canViewAny) {
    // a) get the categories user has direct access to
    const teamIds = userTeams.map(t => t.teamId).filter(id => id !== undefined && id !== null)
    const allowedRoots = await prisma.ticketCategoryAvailabilityTeam.findMany({
      where: { teamId: { in: teamIds } },
      select: { ticketCategoryId: true }
    })
    const allowedSet = new Set<number>(allowedRoots.map(r => r.ticketCategoryId))

    // b) build parent→children map for all categories
    const childrenMap: Record<number, number[]> = {}
    allCats.forEach(c => {
      const pid = c.parentId ?? 0
      ;(childrenMap[pid] ||= []).push(c.id)
    })

    // c) DFS to include all descendants
    const stack = [...allowedSet]
    while (stack.length) {
      const cur = stack.pop()!
      const kids = childrenMap[cur] || []
      for (const childId of kids) {
        if (!allowedSet.has(childId)) {
          allowedSet.add(childId)
          stack.push(childId)
        }
      }
    }

    // d) filter categories
    cats = allCats.filter(c => allowedSet.has(c.id))
  }

  // 5. Assemble tree from cats
  const nodeMap: Record<number, any> = {}
  cats.forEach(c => {
    nodeMap[c.id] = {
      id: c.id,
      name: c.name,
      childDropdownLabel: c.childDropdownLabel,
      children: []
    }
  })
  const tree: any[] = []
  cats.forEach(c => {
    if (c.parentId && nodeMap[c.parentId]) {
      nodeMap[c.parentId].children.push(nodeMap[c.id])
    } else {
      tree.push(nodeMap[c.id])
    }
  })

  // 6. Return
  return NextResponse.json(tree)
}
