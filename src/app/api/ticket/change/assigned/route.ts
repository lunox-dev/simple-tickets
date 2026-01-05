import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { enqueueNotificationInit } from '@/lib/notification-queue'
import { verifyAssignmentChangePermission } from '@/lib/access-ticket-assignment'
import { handlePermissionError } from '@/lib/permission-error'



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


  try {
    verifyAssignmentChangePermission(userTeams, fromUserTeamId, toUserTeamId)
  } catch (err) {
    return handlePermissionError(err)
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

    const event = await prisma.notificationEvent.findUnique({ where: { onAssignmentChangeId: change.id } })
    if (event) await enqueueNotificationInit(event.id)

    return NextResponse.json(updatedTicket)
  } catch (error) {
    console.error('Error changing ticket assignment:', error)
    return NextResponse.json({ error: 'Failed to change assignment' }, { status: 500 })
  }
}
