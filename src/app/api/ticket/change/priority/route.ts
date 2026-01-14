import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { getTicketAccessForUser } from '@/lib/access-ticket-user'
import { verifyChangePermission } from '@/lib/access-ticket-change'
import { enqueueNotificationInit } from '@/lib/notification-queue'
import { handlePermissionError } from '@/lib/permission-error'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = Number((session.user as any).id)
  const actingAs = (session.user as any).actingAs

  const { ticketId, priorityId } = await req.json()
  if (!ticketId || !priorityId) {
    return NextResponse.json({ error: 'Missing ticketId or priorityId' }, { status: 400 })
  }

  const access = await getTicketAccessForUser(userId, ticketId)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      currentAssignedTo: {
        select: {
          id: true,
          userTeamId: true,
          teamId: true,
          userTeam: { select: { teamId: true } }
        }
      },
      createdBy: {
        select: {
          id: true,
          userTeamId: true,
          teamId: true,
          userTeam: { select: { teamId: true } }
        }
      }
    }
  })
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  const newPriority = await prisma.ticketPriority.findUnique({ where: { id: priorityId } })
  if (!newPriority) {
    return NextResponse.json({ error: 'Priority not found' }, { status: 404 })
  }

  // Convert nulls to undefined for type compatibility and patch teamId
  const safeTicket = {
    ...ticket,
    currentAssignedTo: ticket.currentAssignedTo
      ? {
        ...ticket.currentAssignedTo,
        userTeamId: ticket.currentAssignedTo.userTeamId ?? undefined,
        teamId: (ticket.currentAssignedTo.teamId ?? ticket.currentAssignedTo.userTeam?.teamId) ?? undefined,
      }
      : undefined,
    createdBy: ticket.createdBy
      ? {
        ...ticket.createdBy,
        userTeamId: ticket.createdBy.userTeamId ?? undefined,
        teamId: (ticket.createdBy.teamId ?? ticket.createdBy.userTeam?.teamId) ?? undefined,
      }
      : undefined,
  }

  try {
    verifyChangePermission(access, safeTicket, 'priority', ticket.currentPriorityId, priorityId)
  } catch (err) {
    return handlePermissionError(err)
  }

  try {
    const change = await prisma.ticketChangePriority.create({
      data: {
        ticketId,
        priorityFromId: ticket.currentPriorityId,
        priorityToId: priorityId,
        changedById: actingAs.userTeamEntityId,
        changedAt: new Date(),
      },
    })

    const [updatedTicket, _] = await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticketId },
        data: {
          currentPriorityId: priorityId,
          updatedAt: new Date(),
        },
      }),
      prisma.notificationEvent.create({
        data: {
          type: 'TICKET_PRIORITY_CHANGED',
          onPriorityChangeId: change.id,
        },
      }),
    ])

    const event = await prisma.notificationEvent.findUnique({ where: { onPriorityChangeId: change.id } })
    if (event) await enqueueNotificationInit(event.id)

    return NextResponse.json(updatedTicket)
  } catch (error) {
    console.error('Error changing ticket priority:', error)
    return NextResponse.json({ error: 'Failed to change priority' }, { status: 500 })
  }
}
