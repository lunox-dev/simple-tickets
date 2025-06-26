import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse & validate payload
  const { userTeamId, permissions } = await req.json() as {
    userTeamId?: number
    permissions?: string[]
  }
  if (typeof userTeamId !== 'number') {
    return NextResponse.json({ error: 'userTeamId (number) is required' }, { status: 400 })
  }
  if (!Array.isArray(permissions) || permissions.some(p => typeof p !== 'string')) {
    return NextResponse.json({ error: 'permissions must be string[]' }, { status: 400 })
  }

  // 3. Check acting user's permissions on this UserTeam
  const user = session.user as any
  const userTeams = user.teams as Array<{ userTeamId: number, userTeamPermissions: string[] }>
  const actingUT = userTeams.find(ut => ut.userTeamId === userTeamId)
  if (!actingUT) {
    return NextResponse.json({ error: 'You do not belong to this UserTeam' }, { status: 403 })
  }
  if (!actingUT.userTeamPermissions.includes('userteam:manage:permission')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 4. Update permissions
  try {
    const updated = await prisma.userTeam.update({
      where: { id: userTeamId },
      data: { permissions }
    })
    return NextResponse.json({ userTeam: updated }, { status: 200 })
  } catch (err: any) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'UserTeam not found' }, { status: 404 })
    }
    console.error('Error updating user team permissions:', err)
    return NextResponse.json({ error: 'Failed to update user team permissions' }, { status: 500 })
  }
}
