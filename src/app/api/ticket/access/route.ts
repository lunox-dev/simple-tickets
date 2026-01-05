import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { getTicketAccessForUser } from '@/lib/access-ticket-user'
import { getTicketAccessUsers } from '@/lib/access-users'

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
    const access = await getTicketAccessForUser(userId, ticketId)
    if (!access) {
        // If they can't even see the ticket, return 404 or 403.
        // Standard practice: if they don't know it exists, 404. If they know but can't access, 403.
        // For simplicity, we'll return 403 here as "access denied".
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check for the specific permission node required to view the access list
    // The 'actionPermissions' array from getTicketAccessForUser contains all ticket:action:* permissions
    const hasViewAccessPermission = access.actionPermissions.includes('ticket:action:view_access')

    if (!hasViewAccessPermission) {
        return NextResponse.json({ error: 'Forbidden: Missing ticket:action:view_access permission' }, { status: 403 })
    }

    // 2) Fetch the list of users who can see the ticket
    const result = await getTicketAccessUsers(ticketId)

    return NextResponse.json(result)
}
