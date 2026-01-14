import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { enqueueNotificationInit } from '@/lib/notification-queue'
import { verifyChangePermission } from '@/lib/access-ticket-change'
import { handlePermissionError } from '@/lib/permission-error'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = Number((session.user as any).id)
  const actingAs = (session.user as any).actingAs
  const userPermissions = (session.user as any).permissions || []

  const { ticketId, entityId } = await req.json()
  if (!ticketId || !entityId) {
    return NextResponse.json({ error: 'Missing ticketId or entityId' }, { status: 400 })
  }

  // Get ticket details
  const ticketQuery = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      currentAssignedTo: { select: { id: true, userTeamId: true, teamId: true } },
      createdBy: {
        select: {
          id: true,
          userTeamId: true,
          teamId: true,
          userTeam: { select: { teamId: true } } // Fetch resolved team ID via userTeam
        }
      }
    }
  })
  if (!ticketQuery) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  // Patch ticket createdBy teamId if null (for User entities)
  const ticket: any = ticketQuery
  if (ticket.createdBy && !ticket.createdBy.teamId && ticket.createdBy.userTeam?.teamId) {
    ticket.createdBy.teamId = ticket.createdBy.userTeam.teamId
  }

  // Get target entity
  const toEntity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!toEntity) {
    return NextResponse.json({ error: 'Target entity not found' }, { status: 404 })
  }

  // Determine effective permissions and access context
  let actionPermissions = userPermissions
  const accessVia: any[] = []

  if (actingAs) {
    const activeTeam = (session.user as any).teams.find((t: any) => t.userTeamId === actingAs.userTeamId)

    // Get team permissions
    if (activeTeam && activeTeam.permissions) {
      actionPermissions = activeTeam.permissions
    }

    // Add membership access via context
    accessVia.push({
      type: 'membership',
      userTeamId: actingAs.userTeamId,
      teamId: activeTeam?.teamId ?? actingAs.teamId,
      permission: 'membership:active'
    })
  }

  // Use Entity IDs for permission check
  const fromEntityId = ticket.currentAssignedTo?.id ?? 0 // Entity ID
  const toEntityId = toEntity.id // Entity ID

  const access = {
    actionPermissions,
    accessVia
  }

  try {
    // Cast ticket to any because verifyChangePermission expects headers that might differ slightly in optionality but structure matches
    verifyChangePermission(access as any, ticket as any, 'assigned', fromEntityId, toEntityId)
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
