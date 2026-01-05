import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'

export async function GET(req: NextRequest) {
  // 1. Authenticate (session or x-api-key)
  const session = await getServerSession(authOptions)
  let permSet = new Set<string>()

  if (session) {
    // User-level permission only (not team/userteam)
    const userPerms = (session.user as any).permissions as string[]
    userPerms.forEach(p => permSet.add(p))
  } else {
    // API-key flow
    const key = req.headers.get('x-api-key')
    if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ak = await prisma.apiKey.findUnique({
      where: { key },
      select: { permissions: true }
    })
    if (!ak) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    ak.permissions.forEach(p => permSet.add(p))
  }

  // 2. Permission check
  // 2. Permission check
  try {
    verifyPermission(permSet, 'user:account:list', 'user_account')
  } catch (err) {
    return handlePermissionError(err)
  }

  // 3. Fetch users with their teams
  const users = await prisma.user.findMany({
    select: {
      id: true,
      displayName: true,
      email: true,
      mobile: true,
      permissions: true,
      userTeams: {
        select: {
          id: true,
          team: {
            select: {
              name: true
            }
          }
        }
      }
    }
  })

  // 4. Format response
  const result = users.map(u => ({
    id: u.id,
    displayName: u.displayName,
    email: u.email,
    mobile: u.mobile,
    permissions: u.permissions || [],
    teams: u.userTeams.map(ut => ({
      userTeamId: ut.id,
      teamName: ut.team?.name ?? null
    }))
  }))

  return NextResponse.json(result)
}
