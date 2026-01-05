// src/app/api/team/manage/change-priority/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'

export async function POST(req: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Check user permission "team:modify:changepriority"
  const userId = Number((session.user as any).id)
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { permissions: true }
  })
  try {
    verifyPermission(me?.permissions || [], 'team:modify:changepriority', 'team')
  } catch (err) {
    return handlePermissionError(err)
  }

  // 3. Parse & validate payload
  // Expecting: { updates: Array<{ teamId: number, priority: number }> }
  const body = await req.json()
  if (!body?.updates || !Array.isArray(body.updates)) {
    return NextResponse.json({ error: 'Invalid payload: "updates" array is required' }, { status: 400 })
  }
  const updates: { teamId: number; priority: number }[] = body.updates
  for (const u of updates) {
    if (typeof u.teamId !== 'number' || typeof u.priority !== 'number') {
      return NextResponse.json(
        { error: 'Each update must include numeric "teamId" and "priority"' },
        { status: 400 }
      )
    }
  }

  try {
    // 4. Apply all priority changes in a transaction
    const updatedTeams = await prisma.$transaction(
      updates.map(u =>
        prisma.team.update({
          where: { id: u.teamId },
          data: { priority: u.priority },
        })
      )
    )

    // 5. Return the updated team records
    return NextResponse.json({ updated: updatedTeams }, { status: 200 })
  } catch (err) {
    console.error('Error updating team priorities:', err)
    return NextResponse.json({ error: 'Failed to update priorities' }, { status: 500 })
  }
}
