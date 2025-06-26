// src/app/api/ticket/priority/list/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET() {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 2. Fetch all ticket priorities
    const priorities = await prisma.ticketPriority.findMany({
      orderBy: { priority: 'asc' }
    })

    return NextResponse.json({ priorities }, { status: 200 })
  } catch (err) {
    console.error('Error fetching ticket priorities:', err)
    return NextResponse.json({ error: 'Failed to fetch priorities' }, { status: 500 })
  }
}
