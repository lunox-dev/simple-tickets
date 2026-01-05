// src/app/api/ticket/field/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { PermissionError, handlePermissionError } from '@/lib/permission-error'

export async function GET(req: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Permissions from session.user.teams
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
    return handlePermissionError(new PermissionError('ticketcategory:view:any OR ticketcategory:view:own', 'ticket_category'))
  }

  // 3. Parse and validate categoryId query param
  const catParam = req.nextUrl.searchParams.get('categoryId')
  const categoryId = catParam ? parseInt(catParam, 10) : NaN
  if (isNaN(categoryId)) {
    return NextResponse.json({ error: 'categoryId (numeric) is required' }, { status: 400 })
  }

  // 4. If only "own", verify access to this category (including descendants)
  if (!canViewAny) {
    // a) load all categories for tree
    const allCats = await prisma.ticketCategory.findMany({
      select: { id: true, parentId: true }
    })
    // b) build parent→children map
    const childrenMap: Record<number, number[]> = {}
    allCats.forEach(c => {
      const pid = c.parentId ?? 0
        ; (childrenMap[pid] ||= []).push(c.id)
    })
    // c) find direct roots user has via availabilityTeams
    const teamIds = userTeams.map(t => t.teamId).filter(id => id !== undefined && id !== null)
    const direct = await prisma.ticketCategoryAvailabilityTeam.findMany({
      where: { teamId: { in: teamIds } },
      select: { ticketCategoryId: true }
    })
    const allowed = new Set<number>(direct.map(r => r.ticketCategoryId))
    // d) DFS to include all descendants
    const stack = [...allowed]
    while (stack.length) {
      const cur = stack.pop()!
      for (const child of childrenMap[cur] || []) {
        if (!allowed.has(child)) {
          allowed.add(child)
          stack.push(child)
        }
      }
    }
    // e) if requested categoryId not in allowed set → forbidden
    if (!allowed.has(categoryId)) {
      return handlePermissionError(new PermissionError('ticketcategory:view:own', 'ticket_category', { categoryId, allowed: Array.from(allowed) }))
    }
  }

  // 5. Gather this category + all its ancestors
  const ancestors = new Set<number>()
  {
    const allCats = await prisma.ticketCategory.findMany({
      select: { id: true, parentId: true }
    })
    const parentMap = Object.fromEntries(allCats.map(c => [c.id, c.parentId]))
    let cur: number | null = categoryId
    while (cur != null) {
      ancestors.add(cur)
      cur = parentMap[cur] ?? null
    }
  }

  // 6. Fetch unique field definitions for those categories
  const defs = await prisma.ticketFieldDefinition.findMany({
    where: { applicableCategoryId: { in: Array.from(ancestors) } },
    select: { id: true, label: true, regex: true, requiredAtCreation: true },
    orderBy: [
      { priority: 'asc' },
      { label: 'asc' }
    ]
  })

  // Map requiredAtCreation to required for API consumers
  return NextResponse.json(defs.map(def => ({
    ...def,
    required: def.requiredAtCreation,
    requiredAtCreation: undefined // Optionally remove the original field
  })))
}
