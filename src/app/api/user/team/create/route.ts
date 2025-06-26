// src/app/api/team/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = Number((session.user as any).id)
  
  // 2. Load the user’s own permissions
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { permissions: true }
  })
  if (!me?.permissions.includes('team:create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Parse & validate payload
  const { name, priority, permissions } = await req.json() as {
    name?: string
    priority?: number
    permissions?: string[]
  }
  if (typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
  }
  if (priority !== undefined && typeof priority !== 'number') {
    return NextResponse.json({ error: 'Priority must be a number' }, { status: 400 })
  }
  if (!Array.isArray(permissions) || permissions.some(p => typeof p !== 'string')) {
    return NextResponse.json({ error: 'Permissions must be string[]' }, { status: 400 })
  }

  try {
    // 4. Create the Team
    const newTeam = await prisma.team.create({
      data: {
        name: name.trim(),
        priority: priority ?? 0,
        permissions,
        Active: true,
      }
    })

    // 5. Create the associated Entity
    const newEntity = await prisma.entity.create({
      data: {
        teamId: newTeam.id
      }
    })

    // 6. Return the created records
    return NextResponse.json(
      { team: newTeam, entity: newEntity },
      { status: 201 }
    )
  } catch (err: any) {
    console.error('Error creating team:', err)
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    )
  }
}
