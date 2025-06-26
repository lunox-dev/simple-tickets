import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user || typeof session.user.id !== 'number') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let userTeamId: number | undefined;
  try {
    const body = await req.json();
    userTeamId = body.userTeamId;
  } catch (e) {
    return NextResponse.json({ error: 'Invalid or missing JSON body' }, { status: 400 });
  }

  if (!userTeamId || typeof userTeamId !== 'number') {
    return NextResponse.json({ error: 'Invalid or missing userTeamId' }, { status: 400 })
  }

  const userTeam = await prisma.userTeam.findUnique({
    where: { id: userTeamId },
    include: {
      user:  true,
      team:  true,
    },
  })

  // Check if it exists and belongs to the current user
  if (
    !userTeam ||
    userTeam.userId !== session.user.id ||
    !userTeam.Active ||
    !userTeam.team.Active
  ) {
    return NextResponse.json({ error: 'Invalid or inactive userTeam' }, { status: 403 })
  }

  // Update user's actionUserTeam
  await prisma.user.update({
    where: { id: session.user.id },
    data: { actionUserTeamId: userTeamId },
  })

  return NextResponse.json({ success: true })
}
