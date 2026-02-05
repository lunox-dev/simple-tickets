import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'

export async function DELETE(req: NextRequest) {
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
    const { id } = body

    if (!id) return NextResponse.json({ error: 'Field ID is required' }, { status: 400 })

    try {
        // 3. Check for existing values
        const valueCount = await prisma.ticketFieldValue.count({
            where: { ticketFieldDefinitionId: id }
        })

        if (valueCount > 0) {
            // Optional: Allow force delete? Or return error?
            // For now, let's just warn or allow deletion if user really wants (usually bad practice to delete data).
            // But user asked for "delete".
            // Safer to delete the definition and cascade delete values?
            // Prisma schema doesn't specify cascade on `TicketFieldValue`.
            // We should delete values first.
            await prisma.ticketFieldValue.deleteMany({
                where: { ticketFieldDefinitionId: id }
            })
        }

        try {
            await prisma.ticketFieldDefinition.delete({
                where: { id }
            })
        } catch (e: any) {
            if (e.code === 'P2025') {
                // Already deleted
            } else {
                throw e
            }
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('Error deleting field:', err)
        return NextResponse.json({ error: 'Failed to delete field' }, { status: 500 })
    }
}
