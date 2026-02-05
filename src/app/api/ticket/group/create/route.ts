import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'

export async function POST(req: NextRequest) {
    // 1. Authenticate
    const session = await getServerSession(authOptions)
    const permSet = new Set<string>()

    if (session) {
        const userPerms = (session.user as any).permissions as string[]
        userPerms.forEach(p => permSet.add(p))
    } else {
        // API-key support if needed, consistent with other endpoints
        const key = req.headers.get('x-api-key')
        if (key) {
            const ak = await prisma.apiKey.findUnique({ where: { key }, select: { permissions: true } })
            if (ak) ak.permissions.forEach(p => permSet.add(p))
        }
    }

    // 2. Permission check: Using same perm as category management for now
    try {
        verifyPermission(permSet, 'ticketcategory:manage:any', 'ticket_category')
    } catch (err) {
        return handlePermissionError(err)
    }

    // 3. Validation
    const body = await req.json()
    const { name, description, categoryIds } = body as {
        name: string,
        description?: string,
        categoryIds?: number[]
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    try {
        // 4. Create Group
        const group = await prisma.ticketFieldGroup.create({
            data: {
                name: name.trim(),
                description: description?.trim(),
                categories: categoryIds && categoryIds.length > 0 ? {
                    create: categoryIds.map(cid => ({
                        ticketCategoryId: cid
                    }))
                } : undefined
            },
            include: {
                categories: true
            }
        })

        return NextResponse.json({ group }, { status: 201 })
    } catch (err) {
        console.error('Error creating field group:', err)
        return NextResponse.json({ error: 'Failed to create field group' }, { status: 500 })
    }
}
