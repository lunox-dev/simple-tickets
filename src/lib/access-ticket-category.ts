import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

type SessionUser = Session['user']

/**
 * Returns a Set of allowed TicketCategory IDs for the given user.
 * 
 * Logic:
 * 1. If user has 'ticketcategory:view:any', they can access all categories.
 * 2. If 'ticketcategory:view:own', we check TicketCategoryAvailabilityTeam for user's teams.
 * 3. We then expand the allowed set to include all descendants (children) of the explicitly allowed categories.
 * 
 * @param user The session user object
 * @returns Set<number> containing all allowed category IDs.
 */
export async function getAccessibleCategoryIds(user: SessionUser): Promise<Set<number>> {
    const userPerms = (user as any).permissions as string[] || []
    const userTeams = (user as any).teams as Array<{
        userTeamId: number
        teamId: number
        name: string
        permissions: string[]
        userTeamPermissions: string[]
    }>

    const allPerms = new Set([
        ...userPerms,
        ...userTeams.flatMap(t => [...t.permissions, ...t.userTeamPermissions])
    ])

    // If user has global view, fetch all IDs
    if (allPerms.has('ticketcategory:view:any')) {
        const allCats = await prisma.ticketCategory.findMany({ select: { id: true } })
        return new Set(allCats.map(c => c.id))
    }

    // Otherwise, if they have 'view:own', calculate allowed tree
    if (allPerms.has('ticketcategory:view:own')) {
        const teamIds = userTeams.map(t => t.teamId).filter(id => id !== undefined && id !== null)

        const allowedRoots = await prisma.ticketCategoryAvailabilityTeam.findMany({
            where: { teamId: { in: teamIds } },
            select: { ticketCategoryId: true }
        })

        // Start with explicitly allowed roots
        const allowedSet = new Set<number>(allowedRoots.map(r => r.ticketCategoryId))

        // Need full hierarchy to expand children
        // TODO: Ideally cache this hierarchy if it becomes performance bottleneck, 
        // strictly speaking we only need parentId/id for all categories.
        const allCats = await prisma.ticketCategory.findMany({
            select: { id: true, parentId: true }
        })

        // Build parent -> children map
        const childrenMap: Record<number, number[]> = {}
        allCats.forEach(c => {
            const pid = c.parentId ?? 0
                ; (childrenMap[pid] ||= []).push(c.id)
        })

        // Expand to include all descendants of allowed roots
        const stack = [...allowedSet]
        while (stack.length) {
            const cur = stack.pop()!
            const kids = childrenMap[cur] || []
            for (const childId of kids) {
                if (!allowedSet.has(childId)) {
                    allowedSet.add(childId)
                    stack.push(childId)
                }
            }
        }

        return allowedSet
    }

    // If neither permission, return empty set (or handle as forbidden effectively)
    return new Set()
}
