import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { enqueueNotificationInit } from '@/lib/notification-queue'

// Function to check if user has assignment change permission
function hasAssignmentChangePermission(
  userTeams: any[],
  fromUserTeamId: number,
  toUserTeamId: number
): boolean {
  for (const team of userTeams) {
    const combinedPerms = [
      ...team.userTeamPermissions.map((p: any) => ({ from: 'userTeam' as const, value: p })),
      ...team.permissions.map((p: any) => ({ from: 'team' as const, value: p }))
    ]
    
    for (const perm of combinedPerms) {
      const parts = perm.value.split(':')
      
      // Check for ticket:action:change:assigned:any
      if (parts[0] === 'ticket' && parts[1] === 'action' && parts[2] === 'change' && parts[3] === 'assigned') {
        if (parts[4] === 'any') {
          return true // Can assign to anyone
        }
        
        // Check for specific assignment permissions like ticket:action:change:assigned:from:own:to:any:assigned:own
        if (parts[4] === 'from' && parts[6] === 'to') {
          const pFrom = parts[5]
          const pTo = parts[7]
          const pContext = parts[8]
          const pScope = parts[9]
          
          // Check if from condition matches
          if (pFrom === 'any' || (pFrom === 'own' && fromUserTeamId === team.userTeamId)) {
            // Check if to condition matches
            if (pTo === 'any' || (pTo === 'own' && toUserTeamId === team.userTeamId)) {
              // Check context and scope
              if (pContext === 'assigned' && (pScope === 'any' || pScope === 'own')) {
                return true
              }
            }
          }
        }
      }
    }
  }
  
  return false
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = Number((session.user as any).id)
  const actingAs = (session.user as any).actingAs

  const { ticketId, entityId } = await req.json()
  if (!ticketId || !entityId) {
    return NextResponse.json({ error: 'Missing ticketId or entityId' }, { status: 400 })
  }

  // Get ticket details
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      currentAssignedTo: { select: { id: true, userTeamId: true, teamId: true } },
      createdBy: { select: { id: true, userTeamId: true, teamId: true } }
    }
  })
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  // Get target entity
  const toEntity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!toEntity) {
    return NextResponse.json({ error: 'Target entity not found' }, { status: 404 })
  }

  // Get from and to userTeamIds
  const fromUserTeamId = ticket.currentAssignedTo?.userTeamId ?? 0
  const toUserTeamId = toEntity.userTeamId ?? 0

  // Check assignment change permission
  const userTeams = session.user.teams.map((t: any) => ({
    userTeamId: t.userTeamId,
    userTeamPermissions: t.userTeamPermissions,
    permissions: t.permissions
  }))
  
  const canChange = hasAssignmentChangePermission(userTeams, fromUserTeamId, toUserTeamId)
  
  console.log('=== ASSIGNMENT CHANGE DEBUG ===')
  console.log('FromUserTeamId:', fromUserTeamId)
  console.log('ToUserTeamId:', toUserTeamId)
  console.log('UserTeams:', JSON.stringify(userTeams, null, 2))
  console.log('CanChange:', canChange)
  console.log('=== END DEBUG ===')
  
  if (!canChange) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const change = await prisma.ticketChangeAssignment.create({
      data: {
        ticketId,
        assignedFromId: ticket.currentAssignedToId,
        assignedToId: toEntity.id,
        assignedById: actingAs.userTeamEntityId,
        assignedAt: new Date(),
      },
    })

    const [updatedTicket, _] = await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticketId },
        data: {
          currentAssignedToId: toEntity.id,
          updatedAt: new Date(),
        },
      }),
      prisma.notificationEvent.create({
        data: {
          type: 'TICKET_ASSIGNMENT_CHANGED',
          onAssignmentChangeId: change.id,
        },
      }),
    ])

    const event = await prisma.notificationEvent.findUnique({ where: { onAssignmentChangeId: change.id }})
    if(event) await enqueueNotificationInit(event.id)

    return NextResponse.json(updatedTicket)
  } catch (error) {
    console.error('Error changing ticket assignment:', error)
    return NextResponse.json({ error: 'Failed to change assignment' }, { status: 500 })
  }
}
