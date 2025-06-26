import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse & validate payload
  const { userTeamId } = await req.json() as { userTeamId?: number }
  if (typeof userTeamId !== 'number') {
    return NextResponse.json({ error: 'userTeamId (number) is required' }, { status: 400 })
  }

  // 3. Find the userTeam and check ownership
  const user = session.user as any
  const userTeams = user.teams as Array<{ userTeamId: number, userTeamPermissions: string[] }>
  const actingUT = userTeams.find(ut => ut.userTeamId === userTeamId)
  if (!actingUT) {
    return NextResponse.json({ error: 'You do not belong to this UserTeam' }, { status: 403 })
  }
  if (!actingUT.userTeamPermissions.includes('userteam:resignuser:own')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 4. Set Active to false
  try {
    const updated = await prisma.userTeam.update({
      where: { id: userTeamId },
      data: { Active: false }
    })
    return NextResponse.json({ userTeam: updated }, { status: 200 })
  } catch (err: any) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'UserTeam not found' }, { status: 404 })
    }
    console.error('Error resigning from team:', err)
    return NextResponse.json({ error: 'Failed to resign from team' }, { status: 500 })
  }
}
