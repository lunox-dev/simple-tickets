
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'

export async function POST(req: NextRequest) {
    // 1. Authenticate & Permission
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Basic check: must be able to manage categories to test config
    const permSet = new Set<string>()
    const userPerms = (session.user as any).permissions as string[]
    userPerms.forEach(p => permSet.add(p))
    try {
        verifyPermission(permSet, 'ticketcategory:manage:any', 'ticket_category')
    } catch (err) {
        return handlePermissionError(err)
    }

    // 2. Parse Config
    const { url, method, headers } = await req.json() as {
        url: string
        method: string
        headers: Record<string, string>
    }

    if (!url || !url.startsWith('http')) {
        return NextResponse.json({ error: 'Valid URL required' }, { status: 400 })
    }

    try {
        // 3. Execute Request
        const response = await fetch(url, {
            method: method || 'GET',
            headers: headers || {},
        })

        // 4. Return Raw JSON
        const data = await response.json()
        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json({
            error: 'Request Failed',
            details: err.message
        }, { status: 502 })
    }
}
