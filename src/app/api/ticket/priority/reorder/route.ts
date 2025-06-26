import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

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
  if (!permSet.has('ticket:properties:manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Parse & validate payload
  const { updates } = await req.json() as {
    updates?: Array<{ id: number, priority: number }>
  }
  if (!Array.isArray(updates) || updates.some(u => typeof u.id !== 'number' || typeof u.priority !== 'number')) {
    return NextResponse.json({ error: 'updates must be an array of { id: number, priority: number }' }, { status: 400 })
  }

  // 4. Update all priorities in a transaction
  try {
    const updated = await prisma.$transaction(
      updates.map(u =>
        prisma.ticketPriority.update({
          where: { id: u.id },
          data: { priority: u.priority }
        })
      )
    )
    return NextResponse.json({ updated }, { status: 200 })
  } catch (err: any) {
    console.error('Error reordering ticket priorities:', err)
    return NextResponse.json({ error: 'Failed to reorder ticket priorities' }, { status: 500 })
  }
} 