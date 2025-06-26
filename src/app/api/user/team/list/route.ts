import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
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
  if (!permSet.has('team:list')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Fetch teams, sort by priority (asc), then name (asc)
  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      priority: true,
      permissions: true,
      Active: true
    },
    orderBy: [
      { priority: 'asc' },
      { name: 'asc' }
    ]
  })

  return NextResponse.json(teams)
}
