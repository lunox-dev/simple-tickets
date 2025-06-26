// src/app/api/notifications/trigger/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { notificationQueue }         from '@/lib/queues'
import { NotificationType }          from '@prisma/client'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, value } = body
  // 1) Validate “type”
  if (!Object.values<string>(NotificationType).includes(type)) {
    return NextResponse.json({ error: `type must be one of ${Object.values(NotificationType).join(', ')}` }, { status: 400 })
  }
  // 2) Validate “value”
  if (typeof value !== 'number' || value <= 0) {
    return NextResponse.json({ error: 'value must be a positive integer' }, { status: 400 })
  }

  // 3) Enqueue the work—fire & forget
  await notificationQueue.add('notificationEvent', { type, value })

  // 4) Return immediately
  return NextResponse.json({ status: 'queued' }, { status: 202 })
}
