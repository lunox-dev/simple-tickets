// src/app/api/entity/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { PermissionError, handlePermissionError } from '@/lib/permission-error'
import { getEntitiesForUser } from '@/lib/entity-list'

// Local definition removed, using import instead.

export async function GET(req: NextRequest) {
  // 1) Authenticate (session or x-api-key)
  const session = await getServerSession(authOptions)
  let userId: number | null = null
  let apiKeyPerms: string[] = []

  if (session) {
    userId = Number((session.user as any).id)
  } else {
    const key = req.headers.get('x-api-key')
    if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ak = await prisma.apiKey.findUnique({
      where: { key },
      select: { permissions: true }
    })
    if (!ak) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    apiKeyPerms = ak.permissions
  }

  try {
    const tree = await getEntitiesForUser(userId, apiKeyPerms)
    return NextResponse.json(tree)
  } catch (err) {
    return handlePermissionError(err)
  }
}
