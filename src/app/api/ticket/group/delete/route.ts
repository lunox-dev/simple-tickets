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

    if (!id) return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })

    try {
        // 3. Handle Fields and Categories logic
        // Unlink fields from this group (set groupId to null)
        await prisma.$transaction(async (tx) => {
            // 3. Handle Fields and Categories logic
            // Unlink fields from this group (set groupId to null)
            await tx.ticketFieldDefinition.updateMany({
                where: { ticketFieldGroupId: id },
                data: { ticketFieldGroupId: null }
            })

            // Delete Category relations
            await tx.ticketFieldGroupCategory.deleteMany({
                where: { ticketFieldGroupId: id }
            })

            // Delete Group
            try {
                await tx.ticketFieldGroup.delete({
                    where: { id }
                })
            } catch (e: any) {
                if (e.code === 'P2025') {
                    // Already deleted, ignore (Idempotent)
                } else {
                    throw e
                }
            }
        })

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('Error deleting group:', err)
        return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 })
    }
}
