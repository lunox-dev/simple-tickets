import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { getTicketAccessForUser } from '@/lib/access-ticket-user'
import { verifyThreadCreatePermission } from '@/lib/access-ticket-change'
import { enqueueNotificationInit } from '@/lib/notification-queue'
import { handlePermissionError } from '@/lib/permission-error'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = Number((session.user as any).id)
  const actingAs = (session.user as any).actingAs
  if (!actingAs) {
    return NextResponse.json({ error: 'User is not acting as any team' }, { status: 400 })
  }

  const formData = await req.formData()
  const ticketId = Number(formData.get("ticketId"))
  const body = formData.get("body") as string

  if (!ticketId || !body) {
    return NextResponse.json({ error: 'Missing ticketId or body' }, { status: 400 })
  }

  const access = await getTicketAccessForUser(userId, ticketId)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      currentStatusId: true,
      currentAssignedTo: { select: { id: true } }
    }
  })
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  if (ticket.currentStatusId === 4) {
    return NextResponse.json({ error: 'Cannot add thread to a closed ticket' }, { status: 400 })
  }

  try {
    verifyThreadCreatePermission(access, ticket.currentAssignedTo?.id)
  } catch (err) {
    return handlePermissionError(err)
  }

  try {
    const newThread = await prisma.ticketThread.create({
      data: {
        ticketId,
        body,
        createdById: actingAs.userTeamEntityId,
      },
    })

    const [_, event] = await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
      }),
      prisma.notificationEvent.create({
        data: {
          type: 'TICKET_THREAD_NEW',
          onThreadId: newThread.id,
        },
      }),
    ])

    await enqueueNotificationInit(event.id)

    return NextResponse.json(newThread)
  } catch (error) {
    console.error('Error creating ticket thread:', error)
    return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 })
  }
}
