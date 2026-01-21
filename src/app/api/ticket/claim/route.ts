import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { enqueueNotificationInit } from '@/lib/notification-queue'

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const userId = Number(user.id)
    const actingAs = user.actingAs
    const userPermissions = new Set<string>(user.permissions || [])

    // If acting as a team, add team permissions
    if (actingAs) {
        const activeTeam = (user.teams as any[]).find((t: any) => t.userTeamId === actingAs.userTeamId)
        if (activeTeam && activeTeam.permissions) {
            activeTeam.permissions.forEach((p: string) => userPermissions.add(p))
        }
        if (activeTeam && activeTeam.userTeamPermissions) {
            activeTeam.userTeamPermissions.forEach((p: string) => userPermissions.add(p))
        }
    }

    const { ticketId } = await req.json()
    if (!ticketId) {
        return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 })
    }

    // Get ticket details
    const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
            currentAssignedTo: { select: { id: true, userTeamId: true, teamId: true } }
        }
    })

    if (!ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Determine if user can claim
    // Logic:
    // 1. ticket:action:claim:any:force 
    //    -> can claim ANYTHING

    // 2. ticket:action:claim:any:unclaimed
    //    -> can claim if ticket is Unassigned OR (Assigned to Team BUT NOT user)
    //       "Unclaimed" definitions:
    //       - currentAssignedTo is null
    //       - currentAssignedTo.teamId is set, userTeamId is null

    // 3. ticket:action:claim:team:force
    //    -> can claim if ticket is assigned to ONE OF USER'S TEAMS (regardless of user assignment)

    // 4. ticket:action:claim:team:unclaimed
    //    -> can claim if ticket assigned to ONE OF USER'S TEAMS AND is "Unclaimed" (no user assigned)

    let canClaim = false

    const isUnclaimed = !ticket.currentAssignedTo || (!!ticket.currentAssignedTo.teamId && !ticket.currentAssignedTo.userTeamId)

    // Check user teams
    // We need the list of teamIds the user belongs to.
    // user.teams is available in session.
    const myTeamIds = new Set((user.teams as any[]).map((t: any) => t.teamId))
    const isAssignedToMyTeam = ticket.currentAssignedTo?.teamId ? myTeamIds.has(ticket.currentAssignedTo.teamId) : false

    // Permission Checks
    if (userPermissions.has('ticket:action:claim:any:force')) {
        canClaim = true
    } else if (userPermissions.has('ticket:action:claim:any:unclaimed') && isUnclaimed) {
        canClaim = true
    } else if (userPermissions.has('ticket:action:claim:team:force') && isAssignedToMyTeam) {
        canClaim = true
    } else if (userPermissions.has('ticket:action:claim:team:unclaimed') && isAssignedToMyTeam && isUnclaimed) {
        canClaim = true
    }

    if (!canClaim) {
        return NextResponse.json({ error: 'You do not have permission to claim this ticket.' }, { status: 403 })
    }

    if (!actingAs || !actingAs.userTeamEntityId) {
        return NextResponse.json({ error: 'No active team context to claim assignment.' }, { status: 400 })
    }

    try {
        const toEntityId = actingAs.userTeamEntityId

        const change = await prisma.ticketChangeAssignment.create({
            data: {
                ticketId,
                assignedFromId: ticket.currentAssignedToId,
                assignedToId: toEntityId,
                assignedById: actingAs.userTeamEntityId,
                assignedAt: new Date(),
            },
        })

        const [updatedTicket, _] = await prisma.$transaction([
            prisma.ticket.update({
                where: { id: ticketId },
                data: {
                    currentAssignedToId: toEntityId,
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
        console.error('Error claiming ticket:', error)
        return NextResponse.json({ error: 'Failed to claim ticket' }, { status: 500 })
    }
}
