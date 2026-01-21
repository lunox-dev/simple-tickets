
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check generic view permissions or specific manage permission
    // For simplicity, let's require 'team:modify' or basic admin view
    // But strictly, UI likely calls this with teamId

    const { searchParams } = new URL(req.url)
    const teamId = searchParams.get('teamId')

    if (teamId) {
        // List categories for a specific team
        const tid = Number(teamId)
        if (isNaN(tid)) return NextResponse.json({ error: 'Invalid teamId' }, { status: 400 })

        const avails = await prisma.ticketCategoryAvailabilityTeam.findMany({
            where: { teamId: tid },
            select: { ticketCategoryId: true }
        })

        const allCats = await prisma.ticketCategory.findMany({
            select: { id: true, name: true, parentId: true, priority: true },
            orderBy: { priority: 'asc' }
        })

        return NextResponse.json({
            allowedIds: avails.map(a => a.ticketCategoryId),
            allCategories: allCats
        })
    }

    // If no teamId, standard listing logic not really needed for this specific UI feature yet
    return NextResponse.json({ error: 'teamId query param required' }, { status: 400 })
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check permission
    const userPerms = (session.user as any).permissions || []
    try {
        verifyPermission(userPerms, 'team:modify', 'team') // Reusing team:modify permission
    } catch (err) {
        return handlePermissionError(err)
    }

    const body = await req.json()
    const { teamId, categoryIds } = body

    if (typeof teamId !== 'number' || !Array.isArray(categoryIds)) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    try {
        // Replace all availabilities for this team
        await prisma.$transaction(async tx => {
            await tx.ticketCategoryAvailabilityTeam.deleteMany({
                where: { teamId }
            })

            if (categoryIds.length > 0) {
                await tx.ticketCategoryAvailabilityTeam.createMany({
                    data: categoryIds.map((cid: number) => ({
                        teamId,
                        ticketCategoryId: cid
                    }))
                })
            }
        })

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Error updating team categories:', err)
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}
