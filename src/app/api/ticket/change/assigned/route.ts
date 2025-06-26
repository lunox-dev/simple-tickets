import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { getTicketAccessForUser } from '@/lib/access-ticket-user'
import { hasChangePermission } from '@/lib/access-ticket-change'
import { enqueueNotificationInit } from '@/lib/notification-queue'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = Number((session.user as any).id)
  const actingAs = (session.user as any).actingAs

  const { ticketId, userTeamId, teamId } = await req.json()
  if (!ticketId || !teamId) {
    return NextResponse.json({ error: 'Missing ticketId or teamId' }, { status: 400 })
  }

  const access = await getTicketAccessForUser(userId, ticketId)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { currentAssignedTo: true },
  })
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  const fromUserTeamId = ticket.currentAssignedTo?.userTeamId ?? 0
  const canChange = hasChangePermission(access, ticket, 'assigned', fromUserTeamId, userTeamId ?? 0)
  if (!canChange) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const toEntity = await prisma.entity.findFirst({
    where: { OR: [{ userTeamId }, { teamId }] },
  })
  if (!toEntity) {
    return NextResponse.json({ error: 'Target entity not found' }, { status: 404 })
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
