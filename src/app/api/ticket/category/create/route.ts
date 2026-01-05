// src/app/api/ticket/category/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'

export async function POST(req: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Check user‐level permission
  const userPerms = (session.user as any).permissions as string[]
  try {
    verifyPermission(userPerms, 'ticketcategory:create', 'ticketcategory')
  } catch (err) {
    return handlePermissionError(err)
  }

  // 3. Parse & validate payload
  const {
    name,
    childDropdownLabel,
    parentId,
    priority
  } = await req.json() as {
    name?: string
    childDropdownLabel?: string | null
    parentId?: number | null
    priority?: number
  }

  if (typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // 4. Create the category
  try {
    const category = await prisma.ticketCategory.create({
      data: {
        name: name.trim(),
        childDropdownLabel: childDropdownLabel ?? null,
        parentId: parentId ?? null,
        priority: typeof priority === 'number' ? priority : 0,
      }
    })
    return NextResponse.json(category, { status: 201 })
  } catch (err) {
    console.error('Error creating ticket category:', err)
    return NextResponse.json({ error: 'Could not create category' }, { status: 500 })
  }
}
