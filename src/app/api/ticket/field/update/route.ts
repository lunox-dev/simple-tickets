import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'

export async function PATCH(req: NextRequest) {
    // 1. Authenticate
    const session = await getServerSession(authOptions)
    let permSet = new Set<string>()

    if (session) {
        const userPerms = (session.user as any).permissions as string[]
        userPerms.forEach(p => permSet.add(p))
    }

    try {
        verifyPermission(permSet, 'ticketcategory:manage:any', 'ticket_category')
    } catch (err) {
        return handlePermissionError(err)
    }

    // 2. Parse Payload
    const body = await req.json()
    const { id, label, key, type, requiredAtCreation, multiSelect, apiConfig, ticketFieldGroupId, activeInCreate, activeInRead, priority, displayOnList } = body

    if (!id) return NextResponse.json({ error: 'Field ID is required' }, { status: 400 })

    // DisplayOnList Validation
    if (displayOnList) {
        if (type !== 'API_SELECT') {
            return NextResponse.json({ error: 'DisplayOnList is only allowed for API Fetched fields (Dropdowns)' }, { status: 400 })
        }
        // Check dependency
        if (apiConfig && apiConfig.dependsOnFieldKey) {
            // Find parent field
            const parent = await prisma.ticketFieldDefinition.findFirst({
                where: { key: apiConfig.dependsOnFieldKey }
            })
            if (!parent) {
                return NextResponse.json({ error: `Parent field ${apiConfig.dependsOnFieldKey} not found` }, { status: 400 })
            }
            if (!parent.displayOnList) {
                return NextResponse.json({ error: `Parent field ${parent.label} must also have DisplayOnList enabled` }, { status: 400 })
            }
        }
    }

    try {
        // 3. Update Field
        const field = await prisma.ticketFieldDefinition.update({
            where: { id },
            data: {
                label,
                key,
                type,
                requiredAtCreation,
                multiSelect,
                apiConfig: apiConfig ?? undefined,
                ticketFieldGroupId,
                activeInCreate,
                activeInRead,
                priority,
                displayOnList: displayOnList || false
            }
        })

        return NextResponse.json(field)
    } catch (err: any) {
        console.error('Error updating field:', err)
        return NextResponse.json({ error: 'Failed to update field' }, { status: 500 })
    }
}
