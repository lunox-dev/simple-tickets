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
    verifyPermission(permSet, 'ticket:properties:manage', 'ticket:properties')
  } catch (err) {
    return handlePermissionError(err)
  }

  // 3. Parse & validate payload
  const { name, priority, color } = await req.json() as {
    name?: string
    priority?: number
    color?: string
  }
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (typeof priority !== 'number') {
    return NextResponse.json({ error: 'priority (number) is required' }, { status: 400 })
  }
  if (typeof color !== 'string' || !color.trim()) {
    return NextResponse.json({ error: 'color is required' }, { status: 400 })
  }

  // 4. Create the priority
  try {
    const ticketPriority = await prisma.ticketPriority.create({
      data: {
        name: name.trim(),
        priority,
        color: color.trim()
      }
    })
    return NextResponse.json({ ticketPriority }, { status: 201 })
  } catch (err: any) {
    console.error('Error creating ticket priority:', err)
    return NextResponse.json({ error: 'Failed to create ticket priority' }, { status: 500 })
  }
}
