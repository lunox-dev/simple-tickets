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
  if (!permSet.has('user:account:modify')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Parse & validate payload
  const { userId, email, displayName, permissions, Active } = await req.json() as {
    userId?: number
    email?: string
    displayName?: string
    permissions?: string[]
    Active?: boolean
  }
  if (typeof userId !== 'number') {
    return NextResponse.json({ error: 'userId (number) is required' }, { status: 400 })
  }
  if (email !== undefined && (typeof email !== 'string' || !email.trim())) {
    return NextResponse.json({ error: 'email must be a non-empty string' }, { status: 400 })
  }
  if (displayName !== undefined && (typeof displayName !== 'string' || !displayName.trim())) {
    return NextResponse.json({ error: 'displayName must be a non-empty string' }, { status: 400 })
  }
  if (permissions !== undefined && (!Array.isArray(permissions) || permissions.some(p => typeof p !== 'string'))) {
    return NextResponse.json({ error: 'permissions must be string[]' }, { status: 400 })
  }
  if (Active !== undefined && typeof Active !== 'boolean') {
    return NextResponse.json({ error: 'Active must be a boolean' }, { status: 400 })
  }

  // 4. Update user
  try {
    const data: any = {}
    if (email !== undefined) data.email = email.trim()
    if (displayName !== undefined) data.displayName = displayName.trim()
    if (permissions !== undefined) data.permissions = permissions
    if (Active !== undefined) data.Active = Active

    const user = await prisma.user.update({
      where: { id: userId },
      data
    })
    return NextResponse.json({ user }, { status: 200 })
  } catch (err: any) {
    if (err.code === 'P2025') {
      // Record not found
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (err.code === 'P2002') {
      // Unique constraint failed (email)
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }
    console.error('Error modifying user:', err)
    return NextResponse.json({ error: 'Failed to modify user' }, { status: 500 })
  }
}
