// src/app/api/ticket/change/status/route.ts
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

  const { ticketId, statusId } = await req.json()
  if (!ticketId || !statusId) {
    return NextResponse.json({ error: 'Missing ticketId or statusId' }, { status: 400 })
  }

  const access = await getTicketAccessForUser(userId, ticketId)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  const newStatus = await prisma.ticketStatus.findUnique({ where: { id: statusId } })
  if (!newStatus) {
    return NextResponse.json({ error: 'Status not found' }, { status: 404 })
  }

  const canChange = hasChangePermission(access, ticket, 'status', ticket.currentStatusId, statusId)
  if (!canChange) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const change = await prisma.ticketChangeStatus.create({
      data: {
        ticketId,
        statusFromId: ticket.currentStatusId,
        statusToId: statusId,
        changedById: actingAs.userTeamEntityId,
        changedAt: new Date(),
      },
    })

    const [updatedTicket, _] = await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticketId },
        data: {
          currentStatusId: statusId,
          updatedAt: new Date(),
        },
      }),
      prisma.notificationEvent.create({
        data: {
          type: 'TICKET_STATUS_CHANGED',
          onStatusChangeId: change.id,
        },
      }),
    ])

    const event = await prisma.notificationEvent.findUnique({ where: { onStatusChangeId: change.id }})
    if(event) await enqueueNotificationInit(event.id)

    return NextResponse.json(updatedTicket)
  } catch (error) {
    console.error('Error changing ticket status:', error)
    return NextResponse.json({ error: 'Failed to change status' }, { status: 500 })
  }
}
