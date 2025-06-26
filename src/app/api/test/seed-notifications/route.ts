// src/app/api/test/seed-notifications/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma }                   from '@/lib/prisma'
import { notificationQueue }        from '@/lib/queues'

// Mirror your enum here too
type NotificationType =
  | 'NEW_THREAD'
  | 'ASSIGN_CHANGE'
  | 'PRIORITY_CHANGE'
  | 'STATUS_CHANGE'

const validTypes: NotificationType[] = [
  'NEW_THREAD',
  'ASSIGN_CHANGE',
  'PRIORITY_CHANGE',
  'STATUS_CHANGE',
]

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, value } = body

  // 1) Validate type
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    )
  }

  // 2) Validate value
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    return NextResponse.json(
      { error: 'value must be a positive integer' },
      { status: 400 }
    )
  }

  // 3) Ensure the referenced record really exists
  try {
    let exists = false
    switch (type) {
      case 'NEW_THREAD':
        exists = !!(await prisma.ticketThread.findUnique({ where: { id: value } }))
        break
      case 'ASSIGN_CHANGE':
        exists = !!(await prisma.ticketChangeAssignment.findUnique({ where: { id: value } }))
        break
      case 'PRIORITY_CHANGE':
        exists = !!(await prisma.ticketChangePriority.findUnique({ where: { id: value } }))
        break
      case 'STATUS_CHANGE':
        exists = !!(await prisma.ticketChangeStatus.findUnique({ where: { id: value } }))
        break
    }
    if (!exists) {
      return NextResponse.json(
        { error: `${type} with id ${value} not found` },
        { status: 404 }
      )
    }
  } catch (err) {
    console.error('[seed-notifications] existence check error:', err)
    return NextResponse.json(
      { error: 'Error validating record' },
      { status: 500 }
    )
  }

  // 4) Enqueue exactly one init job
  try {
    const job = await notificationQueue.add('notification-init', { type, value })
    console.log(`[seed-notifications] queued notification-init job ${job.id}`)
    return NextResponse.json(
      { status: 'queued', jobId: job.id, type, value },
      { status: 202 }
    )
  } catch (err) {
    console.error('[seed-notifications] enqueue error:', err)
    return NextResponse.json(
      { error: 'Failed to enqueue job' },
      { status: 500 }
    )
  }
}
