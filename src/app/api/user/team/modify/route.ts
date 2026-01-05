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
    verifyPermission(permSet, 'team:modify', 'team')
  } catch (err) {
    return handlePermissionError(err)
  }

  // 3. Parse & validate payload
  const { teamId, name, priority, permissions, Active } = await req.json() as {
    teamId?: number
    name?: string
    priority?: number
    permissions?: string[]
    Active?: boolean
  }
  if (typeof teamId !== 'number') {
    return NextResponse.json({ error: 'teamId (number) is required' }, { status: 400 })
  }
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 })
  }
  if (priority !== undefined && typeof priority !== 'number') {
    return NextResponse.json({ error: 'priority must be a number' }, { status: 400 })
  }
  if (permissions !== undefined && (!Array.isArray(permissions) || permissions.some(p => typeof p !== 'string'))) {
    return NextResponse.json({ error: 'permissions must be string[]' }, { status: 400 })
  }
  if (Active !== undefined && typeof Active !== 'boolean') {
    return NextResponse.json({ error: 'Active must be a boolean' }, { status: 400 })
  }

  // 4. Update team
  try {
    const data: any = {}
    if (name !== undefined) data.name = name.trim()
    if (priority !== undefined) data.priority = priority
    if (permissions !== undefined) data.permissions = permissions
    if (Active !== undefined) data.Active = Active

    const team = await prisma.team.update({
      where: { id: teamId },
      data
    })
    return NextResponse.json({ team }, { status: 200 })
  } catch (err: any) {
    if (err.code === 'P2025') {
      // Record not found
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }
    console.error('Error modifying team:', err)
    return NextResponse.json({ error: 'Failed to modify team' }, { status: 500 })
  }
}
