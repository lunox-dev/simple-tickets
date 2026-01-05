import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'

export async function PATCH(req: NextRequest) {
  // 1. Authenticate (session or x-api-key)
  const session = await getServerSession(authOptions)
  let permSet = new Set<string>()

  if (session) {
    // User-level permission only (not team/userteam)
    const userPerms = (session.user as any).permissions as string[]
    userPerms.forEach(p => permSet.add(p))
  } else {
    // API-key flow
    const key = req.headers.get('x-api-key')
    if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ak = await prisma.apiKey.findUnique({
      where: { key },
      select: { permissions: true }
    })
    if (!ak) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    ak.permissions.forEach(p => permSet.add(p))
  }

  // 2. Permission check
  // 2. Permission check
  try {
    verifyPermission(permSet, 'ticket:properties:manage', 'ticket:properties')
  } catch (err) {
    return handlePermissionError(err)
  }

  // 3. Parse & validate payload
  const { id, name, childDropdownLabel, parentId, priority } = await req.json() as {
    id?: number
    name?: string
    childDropdownLabel?: string | null
    parentId?: number | null
    priority?: number
  }
  if (typeof id !== 'number') {
    return NextResponse.json({ error: 'id (number) is required' }, { status: 400 })
  }
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 })
  }
  if (childDropdownLabel !== undefined && childDropdownLabel !== null && typeof childDropdownLabel !== 'string') {
    return NextResponse.json({ error: 'childDropdownLabel must be a string or null' }, { status: 400 })
  }
  if (parentId !== undefined && parentId !== null && typeof parentId !== 'number') {
    return NextResponse.json({ error: 'parentId must be a number or null' }, { status: 400 })
  }
  if (priority !== undefined && typeof priority !== 'number') {
    return NextResponse.json({ error: 'priority must be a number' }, { status: 400 })
  }

  // 4. Update the category
  try {
    const data: any = {}
    if (name !== undefined) data.name = name.trim()
    if (childDropdownLabel !== undefined) data.childDropdownLabel = childDropdownLabel
    if (parentId !== undefined) data.parentId = parentId
    if (priority !== undefined) data.priority = priority

    const ticketCategory = await prisma.ticketCategory.update({
      where: { id },
      data
    })
    return NextResponse.json({ ticketCategory }, { status: 200 })
  } catch (err: any) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'TicketCategory not found' }, { status: 404 })
    }
    console.error('Error updating ticket category:', err)
    return NextResponse.json({ error: 'Failed to update ticket category' }, { status: 500 })
  }
} 