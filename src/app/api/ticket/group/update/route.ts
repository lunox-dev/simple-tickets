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
    } else {
        // API-key flow (optional, for consistency)
        const key = req.headers.get('x-api-key')
        if (key) {
            const ak = await prisma.apiKey.findUnique({
                where: { key },
                select: { permissions: true }
            })
            if (ak) ak.permissions.forEach(p => permSet.add(p))
        }
    }

    // 2. Permission check
    try {
        verifyPermission(permSet, 'ticketcategory:manage:any', 'ticket_category')
        // Reusing category manage permission for groups as they are closely related
    } catch (err) {
        return handlePermissionError(err)
    }

    // 3. Parse Payload
    const body = await req.json()
    const { id, name, description, categoryIds } = body as {
        id: number
        name?: string
        description?: string
        categoryIds?: number[]
    }

    if (!id) {
        return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })
    }

    try {
        // 4. Update Group
        // If categoryIds is provided, we need to handle the relation update.
        // Simplest way: delete all existing for this group and insert new ones (Transaction).

        // Check if group exists
        const existing = await prisma.ticketFieldGroup.findUnique({ where: { id } })
        if (!existing) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

        const updateData: any = {}
        if (name !== undefined) updateData.name = name.trim()
        if (description !== undefined) updateData.description = description.trim()

        await prisma.$transaction(async (tx) => {
            // Update basic fields
            if (Object.keys(updateData).length > 0) {
                await tx.ticketFieldGroup.update({
                    where: { id },
                    data: updateData
                })
            }

            // Update Categories if provided
            if (categoryIds !== undefined) {
                // Delete existing relations
                await tx.ticketFieldGroupCategory.deleteMany({
                    where: { ticketFieldGroupId: id }
                })

                // Create new relations
                if (categoryIds.length > 0) {
                    await tx.ticketFieldGroupCategory.createMany({
                        data: categoryIds.map(catId => ({
                            ticketFieldGroupId: id,
                            ticketCategoryId: catId
                        }))
                    })
                }
            }
        })

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('Error updating group:', err)
        return NextResponse.json({ error: 'Failed to update group' }, { status: 500 })
    }
}
