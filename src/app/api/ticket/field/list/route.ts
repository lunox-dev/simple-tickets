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

  // 3. Parse query params
  const catParam = req.nextUrl.searchParams.get('categoryId')
  const groupParam = req.nextUrl.searchParams.get('groupId')

  const categoryId = catParam ? parseInt(catParam, 10) : NaN
  const groupId = groupParam ? parseInt(groupParam, 10) : NaN

  if (isNaN(categoryId) && isNaN(groupId)) {
    return NextResponse.json({ error: 'categoryId OR groupId (numeric) is required' }, { status: 400 })
  }

  // 4a. If fetching by Group ID (Admin context usually)
  if (!isNaN(groupId)) {
    // Validate permission to manage groups/fields or just view?
    // For now, reuse the generic permission check.
    if (!canViewAny && !canViewOwn) {
      // Strictly speaking, managing fields in a group might require specific permissions, but reusing existing category view perm for list is okay for list.
      return handlePermissionError(new PermissionError('ticketcategory:view:any', 'ticket_category'))
    }

    const defs = await prisma.ticketFieldDefinition.findMany({
      where: { ticketFieldGroupId: groupId },
      orderBy: { priority: 'asc' },
      select: {
        id: true,
        label: true,
        key: true,
        type: true,
        requiredAtCreation: true,
        multiSelect: true,
        regex: true,
        activeInCreate: true,
        activeInRead: true,
        apiConfig: true,
        priority: true,
        ticketFieldGroup: { select: { id: true, name: true } }
      }
    })
    return NextResponse.json(defs)
  }

  // 4b. Fetching by Category (Ticket Create/View context)
  // If only "own", verify access to this category (including descendants)
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

  // 6. Fetch unique field definitions for those categories AND fields linked to groups associated with those categories
  // Wait, schema says GroupCategory link exists.
  // So: Fields -> Group -> Categories.
  // Query: Find Groups where 'categories' contains any of 'ancestors'.
  // Then Find Fields where ticketFieldGroupId is in those Groups OR applicableCategoryId is in ancestors (legacy support).

  const relevantGroups = await prisma.ticketFieldGroupCategory.findMany({
    where: { ticketCategoryId: { in: Array.from(ancestors) } },
    select: { ticketFieldGroupId: true }
  })
  const relevantGroupIds = relevantGroups.map(g => g.ticketFieldGroupId)

  const defs = await prisma.ticketFieldDefinition.findMany({
    where: {
      OR: [
        { applicableCategoryId: { in: Array.from(ancestors) } },
        { ticketFieldGroupId: { in: relevantGroupIds } }
      ],
      activeInCreate: true // Only return fields active in create
    },
    select: {
      id: true,
      label: true,
      key: true,
      regex: true,
      requiredAtCreation: true,
      type: true,
      multiSelect: true,
      apiConfig: true,
      priority: true,
      ticketFieldGroup: {
        select: {
          id: true,
          name: true,
          description: true
        }
      }
    },
    orderBy: [
      { ticketFieldGroupId: 'asc' },
      { priority: 'asc' },
      { label: 'asc' }
    ]
  })

  // Map requiredAtCreation to required and sanitize apiConfig
  return NextResponse.json(defs.map(def => {
    const config = def.apiConfig as any
    return {
      ...def,
      required: def.requiredAtCreation,
      requiredAtCreation: undefined,
      apiConfig: config ? {
        dependsOnFieldKey: config.dependsOnFieldKey,
        dependencyParam: config.dependencyParam,
        dependencyMode: config.dependencyMode,
        nestedPath: config.nestedPath
      } : undefined
    }
  }))
}
