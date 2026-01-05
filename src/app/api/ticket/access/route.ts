import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'

import { verifyTicketAccess } from '@/lib/access-ticket-user'
import { getTicketAccessUsers } from '@/lib/access-users'
import { PermissionError, handlePermissionError } from '@/lib/permission-error'

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = Number((session.user as any).id)
    if (!userId || isNaN(userId)) {
        return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
    }

    const ticketId = Number(req.nextUrl.searchParams.get('ticketId'))
    if (isNaN(ticketId)) {
        return NextResponse.json({ error: 'Missing or invalid ticketId' }, { status: 400 })
    }

    // 1) Verify the user can see the ticket AND has the specific action permission
    // 1) Verify the user can see the ticket AND has the specific action permission
    let access
    try {
        access = await verifyTicketAccess(userId, ticketId)

        // Check for the specific permission node required to view the access list
        // The 'actionPermissions' array from getTicketAccessForUser contains all ticket:action:* permissions
        const hasViewAccessPermission = access.actionPermissions.includes('ticket:action:view_access')

        if (!hasViewAccessPermission) {
            throw new PermissionError('ticket:action:view_access', 'ticket:access', { ticketId })
        }
    } catch (err) {
        return handlePermissionError(err)
    }

    // 2) Fetch the list of users who can see the ticket
    const result = await getTicketAccessUsers(ticketId)

    return NextResponse.json(result)
}
