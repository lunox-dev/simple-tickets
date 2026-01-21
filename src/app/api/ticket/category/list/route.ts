// src/app/api/ticket/category/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { PermissionError, handlePermissionError } from '@/lib/permission-error'
import { getAccessibleCategoryIds } from '@/lib/access-ticket-category'

export async function GET(req: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Permissions
  const userPerms = (session.user as any).permissions as string[] || [];
  const userTeams = (session.user as any).teams as Array<{
    userTeamId: number
    teamId: number
    name: string
    permissions: string[]
    userTeamPermissions: string[]
    entities?: number[]
  }>
  const allPerms = [
    ...userPerms,
    ...userTeams.flatMap(t => [...t.permissions, ...t.userTeamPermissions])
  ];
  const canViewAny = allPerms.includes('ticketcategory:view:any')
  const canViewOwn = allPerms.includes('ticketcategory:view:own')
  if (!canViewAny && !canViewOwn) {
    return handlePermissionError(new PermissionError('ticketcategory:view:any OR ticketcategory:view:own', 'ticket_category'))
  }

  // 3. Get accessible IDs using shared helper
  const accessibleIds = await getAccessibleCategoryIds(session.user)

  // 4. Fetch all categories and filter
  const allCats = await prisma.ticketCategory.findMany({
    select: { id: true, name: true, childDropdownLabel: true, parentId: true, priority: true },
    orderBy: { priority: 'asc' }
  })

  // Filter based on accessibility
  const cats = allCats.filter(c => accessibleIds.has(c.id))

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
