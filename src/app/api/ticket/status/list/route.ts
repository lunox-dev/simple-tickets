// src/app/api/ticket/status/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'

export async function GET(req: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Gather all permissions from user, team and userTeam
  const userPerms = (session.user as any).permissions as string[] || [];
  const userTeams = (session.user as any).teams as Array<{
    permissions: string[]
    userTeamPermissions: string[]
  }>
  const allPerms = [
    ...userPerms,
    ...userTeams.flatMap(t => [...t.permissions, ...t.userTeamPermissions])
  ];

  // 3. Enforce ticketstatus:view:any
  // 3. Enforce ticketstatus:view:any
  try {
    verifyPermission(allPerms, 'ticketstatus:view:any', 'ticket_status')
  } catch (err) {
    return handlePermissionError(err)
  }

  // 4. Fetch statuses sorted by their priority (low→high)
  const statuses = await prisma.ticketStatus.findMany({
    select: { id: true, name: true, priority: true, color: true },
    orderBy: { priority: 'asc' },
  })

  // 5. Return JSON array
  return NextResponse.json(statuses)
}
