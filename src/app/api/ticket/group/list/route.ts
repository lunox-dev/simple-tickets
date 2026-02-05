import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { PermissionError, handlePermissionError } from '@/lib/permission-error'

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Permission check: View access to categories implies view access to groups?
    // Let's enforce basic view permissions
    const userTeams = (session.user as any).teams as Array<{ permissions: string[], userTeamPermissions: string[] }>
    const allPerms = userTeams.flatMap(t => [...t.permissions, ...t.userTeamPermissions])
    if (!allPerms.includes('ticketcategory:view:any') && !allPerms.includes('ticketcategory:view:own')) {
        return handlePermissionError(new PermissionError('ticketcategory:view', 'ticket_category'))
    }

    const groups = await prisma.ticketFieldGroup.findMany({
        include: {
            categories: {
                include: {
                    ticketCategory: { select: { id: true, name: true } }
                }
            },
            _count: {
                select: { fields: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(groups)
}
