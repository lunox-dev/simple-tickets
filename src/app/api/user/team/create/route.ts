// src/app/api/team/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'

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


  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    verifyPermission(me.permissions, 'team:create', 'team')
  } catch (err) {
    return handlePermissionError(err)
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

    // 6. Auto-assign the creator to the team with owner permissions
    const ownerPerms = [
      'userteam:assign:own',
      'userteam:manage:priority',
      'userteam:manage:permission',
      'userteam:resignuser:own'
    ]
    const newUserTeam = await prisma.userTeam.create({
      data: {
        userId,
        teamId: newTeam.id,
        displayPriority: 100, // Higher priority for owner
        permissions: ownerPerms,
        Active: true
      }
    })

    // 7. Create entity for the user-team relation
    await prisma.entity.create({
      data: {
        userTeamId: newUserTeam.id
      }
    })

    // 8. Return the created records
    return NextResponse.json(
      { team: newTeam, entity: newEntity, userTeam: newUserTeam },
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
