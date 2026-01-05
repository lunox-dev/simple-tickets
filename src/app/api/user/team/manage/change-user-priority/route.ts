import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'

export async function PATCH(req: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse & validate payload
  const { userTeamId, displayPriority } = await req.json() as {
    userTeamId?: number
    displayPriority?: number
  }
  if (typeof userTeamId !== 'number') {
    return NextResponse.json({ error: 'userTeamId (number) is required' }, { status: 400 })
  }
  if (typeof displayPriority !== 'number') {
    return NextResponse.json({ error: 'displayPriority (number) is required' }, { status: 400 })
  }

  // 3. Check acting user's permissions on this UserTeam
  const user = session.user as any
  const userTeams = user.teams as Array<{ userTeamId: number, userTeamPermissions: string[] }>
  const actingUT = userTeams.find(ut => ut.userTeamId === userTeamId)
  if (!actingUT) {
    return NextResponse.json({ error: 'You do not belong to this UserTeam' }, { status: 403 })
  }
  try {
    verifyPermission(actingUT.userTeamPermissions, 'userteam:manage:priority', 'user_team', { userTeamId })
  } catch (err) {
    return handlePermissionError(err)
  }

  // 4. Update displayPriority
  try {
    const updated = await prisma.userTeam.update({
      where: { id: userTeamId },
      data: { displayPriority }
    })
    return NextResponse.json({ userTeam: updated }, { status: 200 })
  } catch (err: any) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'UserTeam not found' }, { status: 404 })
    }
    console.error('Error updating user display priority:', err)
    return NextResponse.json({ error: 'Failed to update user display priority' }, { status: 500 })
  }
}
