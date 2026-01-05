import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'

export async function POST(req: NextRequest) {
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
    verifyPermission(permSet, 'ticketcategory:manage:any', 'ticket_category')
  } catch (err) {
    return handlePermissionError(err)
  }

  // 3. Parse & validate payload
  const { label, applicableCategoryId, requiredAtCreation, priority, regex } = await req.json() as {
    label?: string
    applicableCategoryId?: number
    requiredAtCreation?: boolean
    priority?: number
    regex?: string
  }
  if (typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 })
  }
  if (typeof applicableCategoryId !== 'number') {
    return NextResponse.json({ error: 'applicableCategoryId (number) is required' }, { status: 400 })
  }
  if (typeof requiredAtCreation !== 'boolean') {
    return NextResponse.json({ error: 'requiredAtCreation (boolean) is required' }, { status: 400 })
  }
  if (typeof priority !== 'number') {
    return NextResponse.json({ error: 'priority (number) is required' }, { status: 400 })
  }
  if (typeof regex !== 'string' || !regex.trim()) {
    return NextResponse.json({ error: 'regex is required' }, { status: 400 })
  }

  // 4. Create the custom field
  try {
    const field = await prisma.ticketFieldDefinition.create({
      data: {
        label: label.trim(),
        applicableCategoryId,
        requiredAtCreation,
        priority,
        regex: regex.trim()
      }
    })
    return NextResponse.json({ field }, { status: 201 })
  } catch (err: any) {
    console.error('Error creating custom field:', err)
    return NextResponse.json({ error: 'Failed to create custom field' }, { status: 500 })
  }
}
