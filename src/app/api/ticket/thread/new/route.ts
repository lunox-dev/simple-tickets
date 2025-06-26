import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { getTicketAccessForUser } from '@/lib/access-ticket-user'
import { hasThreadCreatePermission } from '@/lib/access-ticket-change'
import { enqueueNotificationInit } from '@/lib/notification-queue'

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

  const { ticketId, body } = await req.json()
  if (!ticketId || !body) {
    return NextResponse.json({ error: 'Missing ticketId or body' }, { status: 400 })
  }

  const access = await getTicketAccessForUser(userId, ticketId)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const canCreateThread = hasThreadCreatePermission(access)
  if (!canCreateThread) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
