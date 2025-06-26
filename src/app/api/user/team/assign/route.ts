// src/app/api/user/team/assign/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Check userteam:assign:own permission (user-level or userTeam-level perms)
  const userPerms = (session.user as any).permissions as string[] || [];
  const userTeams = (session.user as any).teams as Array<{
    userTeamPermissions: string[]
  }>;
  const canAssign = userPerms.includes('userteam:assign:own') ||
    userTeams.flatMap(t => t.userTeamPermissions).includes('userteam:assign:own');

  if (!canAssign) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Parse and validate payload
  const { userId, teamId } = await req.json() as {
    userId?: number
    teamId?: number
  }
  if (typeof userId !== 'number' || typeof teamId !== 'number') {
    return NextResponse.json(
      { error: 'Payload must include numeric userId and teamId' },
      { status: 400 }
    )
  }

  try {
    // 4. Check if UserTeam already exists
    const existingUserTeam = await prisma.userTeam.findFirst({
      where: {
        userId,
        teamId,
      },
    });
    if (existingUserTeam) {
      return NextResponse.json(
        { error: 'User is already assigned to this team.' },
        { status: 409 }
      );
    }

    // 5. Create UserTeam record
    const newUserTeam = await prisma.userTeam.create({
      data: {
        userId,
        teamId,
        displayPriority: 0,      // adjust defaults as needed
        permissions: [],         // initial perms array
        Active: true,
      },
    })

    // 6. Create corresponding Entity record
    const newEntity = await prisma.entity.create({
      data: {
        userTeamId: newUserTeam.id,
      },
    })

    // 7. Return success with both records
    return NextResponse.json(
      { userTeam: newUserTeam, entity: newEntity },
      { status: 201 }
    )
  } catch (err: any) {
    // Handle unique constraint error from Prisma
    if (err.code === 'P2002' && err.meta?.target?.includes('userId_teamId')) {
      return NextResponse.json(
        { error: 'User is already assigned to this team.' },
        { status: 409 }
      );
    }
    console.error('Error assigning user to team:', err)
    return NextResponse.json(
      { error: 'Failed to assign user to team' },
      { status: 500 }
    )
  }
}
