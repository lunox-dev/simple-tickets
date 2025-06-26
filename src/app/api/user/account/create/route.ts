import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'

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
  if (!permSet.has('user:account:create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Parse & validate payload
  const { email, displayName, permissions } = await req.json() as {
    email?: string
    displayName?: string
    permissions?: string[]
  }
  if (typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }
  if (typeof displayName !== 'string' || !displayName.trim()) {
    return NextResponse.json({ error: 'Display name is required' }, { status: 400 })
  }
  if (permissions && (!Array.isArray(permissions) || permissions.some(p => typeof p !== 'string'))) {
    return NextResponse.json({ error: 'Permissions must be string[]' }, { status: 400 })
  }

  // 4. Create user
  try {
    const user = await prisma.user.create({
      data: {
        email: email.trim(),
        displayName: displayName.trim(),
        permissions: permissions ?? [],
        Active: true,
      }
    })
    return NextResponse.json({ user }, { status: 201 })
  } catch (err: any) {
    if (err.code === 'P2002') {
      // Unique constraint failed
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }
    console.error('Error creating user:', err)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
