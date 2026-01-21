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

  // 5. Filter for Creation if requested
  const { searchParams } = new URL(req.url)
  const createTicket = searchParams.get('createTicket') === 'true'

  if (createTicket) {
    const user = session.user as any
    const effectivePerms = new Set<string>(user.permissions || [])

    // Add active team permissions if acting as a team
    if (user.actingAs) {
      const activeTeam = (user.teams as any[]).find((t: any) => t.userTeamId === user.actingAs.userTeamId)
      if (activeTeam) {
        if (activeTeam.permissions) activeTeam.permissions.forEach((p: string) => effectivePerms.add(p))
        if (activeTeam.userTeamPermissions) activeTeam.userTeamPermissions.forEach((p: string) => effectivePerms.add(p))
      }
    }

    // Filter statuses
    const filteredStatuses = statuses.filter(s =>
      effectivePerms.has('ticket:create:status:any') ||
      effectivePerms.has(`ticket:create:status:${s.id}`)
    )

    return NextResponse.json(filteredStatuses)
  }

  // 6. Return all for normal view
  return NextResponse.json(statuses)
}
