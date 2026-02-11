import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { DashboardFilterState, DashboardStats } from '@/components/dashboard/types'

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    // Extract User's Entity ID and Team Entity IDs for "My/Team Assignments"
    // Assuming user.entityId exists or we need to find it.
    // In create route: `user.actingAs` has `userTeamEntityId`.
    // We need the User's personal Entity ID (type 'user') and Team Entity IDs.
    // Let's look at `User` model. `User` has `actionUserTeam`.
    // But assignments are to *Entities*.
    // A User corresponds to one Entity (type 'user')? Or multiple?
    // Model `Entity` has `userTeamId`. `UserTeam` links User and Team.
    // So an assignment to a user is actually assignment to a `UserTeam` entity?
    // Let's check `UserTeam` model. It has `entities`.

    // Actually, let's fetch the User's associated Entity IDs.
    // The user might be assigned tickets via their `UserTeam` entries.

    // Let's get all Entity IDs where this user is the user.
    // `UserTeam` -> `userId` = user.id.
    // Each `UserTeam` has a list of `entities` (relation "EntityUserTeam").
    // So we fetch all Entity IDs linked to UserTeams where userId = session.user.id.

    // Wait, `Entity` has `userTeamId` and `teamId`.
    // If assigned to a Team, `Entity.teamId` is set.
    // If assigned to a User (in a team context), `Entity.userTeamId` is set.

    // So "My Assignments" = Tickets where `currentAssignedTo.userTeam.userId` = my userId.
    // "Team Assignments" = Tickets where `currentAssignedTo.team.userTeams` includes my userId (i.e. I am in that team).
    // AND `currentAssignedTo.teamId` is not null (assigned to the team as a whole).

    const userId = parseInt(user.id)

    const body = await req.json()
    const filters = body as DashboardFilterState

    // Build Where Clause
    const where: any = {}

    if (filters.statusIds && filters.statusIds.length > 0) {
        where.currentStatusId = { in: filters.statusIds }
    }

    if (filters.priorityIds && filters.priorityIds.length > 0) {
        where.currentPriorityId = { in: filters.priorityIds }
    }

    // Execute Queries in Parallel
    try {
        const [statusCounts, priorityCounts, myAssignments, teamAssignments, latestTickets] = await Promise.all([
            // 1. Status Distribution
            prisma.ticket.groupBy({
                by: ['currentStatusId'],
                where,
                _count: {
                    currentStatusId: true
                }
            }),

            // 2. Priority Distribution
            prisma.ticket.groupBy({
                by: ['currentPriorityId'],
                where,
                _count: {
                    currentPriorityId: true
                }
            }),

            // 3. My Assignments
            prisma.ticket.count({
                where: {
                    ...where,
                    currentAssignedTo: {
                        userTeam: {
                            userId: userId
                        }
                    }
                }
            }),

            // 4. Team Assignments (Assigned to a Team I am part of, but not arguably to me personally?)
            // Usually "Team Assignments" means assigned to the *Team Entity*, not a specific user in the team.
            // So `currentAssignedTo.teamId` is set, and I am in that team.
            prisma.ticket.count({
                where: {
                    ...where,
                    currentAssignedTo: {
                        team: {
                            userTeams: {
                                some: { userId: userId }
                            }
                        }
                    }
                }
            }),

            // 5. Latest Tickets
            prisma.ticket.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    currentStatus: true,
                    currentPriority: true,
                    currentAssignedTo: {
                        include: {
                            userTeam: { include: { user: true } },
                            team: true
                        }
                    }
                }
            })
        ])

        // Format Response
        const response: DashboardStats = {
            statusCounts: statusCounts.map(item => ({
                statusId: item.currentStatusId,
                count: item._count.currentStatusId
            })),
            priorityCounts: priorityCounts.map(item => ({
                priorityId: item.currentPriorityId,
                count: item._count.currentPriorityId
            })),
            myAssignmentsCount: myAssignments,
            teamAssignmentsCount: teamAssignments,
            latestTickets: latestTickets.map(t => {
                let assignedName = 'Unassigned'
                if (t.currentAssignedTo) {
                    if (t.currentAssignedTo.userTeam) {
                        assignedName = t.currentAssignedTo.userTeam.user.displayName
                    } else if (t.currentAssignedTo.team) {
                        assignedName = t.currentAssignedTo.team.name
                    }
                }

                return {
                    id: t.id,
                    title: t.title,
                    status: {
                        id: t.currentStatus.id,
                        name: t.currentStatus.name,
                        color: t.currentStatus.color
                    },
                    priority: {
                        id: t.currentPriority.id,
                        name: t.currentPriority.name,
                        color: t.currentPriority.color
                    },
                    assignedTo: t.currentAssignedTo ? { name: assignedName } : null,
                    createdAt: t.createdAt.toISOString()
                }
            })
        }

        return NextResponse.json(response)
    } catch (error) {
        console.error('Dashboard Stats Error:', error)
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }
}
