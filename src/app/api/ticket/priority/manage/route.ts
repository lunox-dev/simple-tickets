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
  const { id, name, priority, color } = await req.json() as {
    id?: number
    name?: string
    priority?: number
    color?: string
  }
  if (typeof id !== 'number') {
    return NextResponse.json({ error: 'id (number) is required' }, { status: 400 })
  }
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 })
  }
  if (priority !== undefined && typeof priority !== 'number') {
    return NextResponse.json({ error: 'priority must be a number' }, { status: 400 })
  }
  if (color !== undefined && (typeof color !== 'string' || !color.trim())) {
    return NextResponse.json({ error: 'color must be a non-empty string' }, { status: 400 })
  }

  // 4. Update the priority
  try {
    const data: any = {}
    if (name !== undefined) data.name = name.trim()
    if (priority !== undefined) data.priority = priority
    if (color !== undefined) data.color = color.trim()

    const ticketPriority = await prisma.ticketPriority.update({
      where: { id },
      data
    })
    return NextResponse.json({ ticketPriority }, { status: 200 })
  } catch (err: any) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'TicketPriority not found' }, { status: 404 })
    }
    console.error('Error updating ticket priority:', err)
    return NextResponse.json({ error: 'Failed to update ticket priority' }, { status: 500 })
  }
}
