// src/app/api/ticket/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'

import { enqueueNotificationInit } from '@/lib/notification-queue'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'
import { getAccessibleCategoryIds } from '@/lib/access-ticket-category'

type FieldPayload = {
  fieldDefinitionId: number
  value: string
}

type AttachmentPayload = {
  filePath: string
  fileType?: string
  fileSize?: number
}

export async function POST(req: NextRequest) {
  // 1) AUTH: session vs API-key
  const session = await getServerSession(authOptions)
  const permSet = new Set<string>()
  let actorEntityId: number | null = null

  // 2) Pull out the new required payload
  const bodyJson = await req.json() as any
  const {
    title,
    body,
    category,
    assignto,
    status,
    priority,
    attachments,
    fields,
    userTeamEntityId,   // new
  } = bodyJson as {
    title?: string
    body?: string
    category?: number
    assignto?: number
    status?: number
    priority?: number
    attachments?: AttachmentPayload[]
    fields?: FieldPayload[]
    userTeamEntityId?: number
  }

  if (session) {
    // — SESSION FLOW: require userTeamEntityId
    if (typeof userTeamEntityId !== 'number') {
      return NextResponse.json({ error: 'userTeamEntityId is required for authenticated users' }, { status: 400 })
    }

    const user = session.user as any
    const actingAs = user.actingAs as
      | { userTeamId: number; userTeamEntityId: number; teamName: string }
      | undefined

    if (!actingAs) {
      return NextResponse.json({ error: 'No active UserTeam selected' }, { status: 400 })
    }

    const actingUT = (user.teams as any[]).find((t: any) => t.userTeamId === actingAs.userTeamId)
    if (!actingUT) {
      // Should not happen if session consistency is maintained, but safe check
      return NextResponse.json({ error: 'Selected UserTeam not found in user teams' }, { status: 400 })
    }

    // collect permissions
    actingUT.userTeamPermissions.forEach((p: string) => permSet.add(p))
    actingUT.permissions.forEach((p: string) => permSet.add(p))



    try {
      verifyPermission(permSet, 'ticket:create', 'ticket')
    } catch (err) {
      return handlePermissionError(err)
    }

    // ensure the provided entity matches your current actingAs entity
    if (!actingAs || userTeamEntityId !== actingAs.userTeamEntityId) {
      return NextResponse.json({
        error: `userTeamEntityId=${userTeamEntityId} is not your current acting entity`
      }, { status: 403 })
    }

    actorEntityId = userTeamEntityId

  } else {
    // — API-KEY FLOW: no userTeamEntityId expected
    if (userTeamEntityId !== undefined) {
      return NextResponse.json({
        error: 'userTeamEntityId must not be provided when using API key'
      }, { status: 400 })
    }
    const key = req.headers.get('x-api-key')
    if (!key) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ak = await prisma.apiKey.findUnique({
      where: { key },
      select: { permissions: true, entities: { select: { id: true } } }
    })
    if (!ak) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }
    ak.permissions.forEach(p => permSet.add(p))

    try {
      verifyPermission(permSet, 'ticket:create', 'ticket')
    } catch (err) {
      return handlePermissionError(err)
    }
    actorEntityId = ak.entities[0]?.id ?? null
    if (!actorEntityId) {
      return NextResponse.json({ error: 'No Entity for API key' }, { status: 500 })
    }
  }

  // ─── payload validation ───────────────────────────────────────────────────────
  if (typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }
  for (const [key, val] of [
    ['category', category],
    ['assignto', assignto],
    ['status', status],
    ['priority', priority]
  ] as any) {
    if (typeof val !== 'number') {
      return NextResponse.json({ error: `${key} (numeric ID) is required` }, { status: 400 })
    }
  }
  if (attachments !== undefined && !Array.isArray(attachments)) {
    return NextResponse.json({ error: 'attachments must be an array' }, { status: 400 })
  }

  // ─── category permission check ───────────────────────────────────────────────
  if (session) {
    const allowedCats = await getAccessibleCategoryIds(session.user)
    if (!allowedCats.has(category!)) {
      return NextResponse.json({ error: 'You are not allowed to create tickets in this category' }, { status: 403 })
    }
  }
  const fieldArr = Array.isArray(fields) ? fields : []
  if (fieldArr.some(f =>
    typeof f.fieldDefinitionId !== 'number' ||
    typeof f.value !== 'string'
  )) {
    return NextResponse.json({ error: 'Each field must have numeric fieldDefinitionId & string value' }, { status: 400 })
  }

  // ─── ensure assignee exists ──────────────────────────────────────────────────
  const assignee = await prisma.entity.findUnique({ where: { id: assignto! } })
  if (!assignee) {
    return NextResponse.json({ error: `No Entity found with id=${assignto}` }, { status: 400 })
  }

  // ─── enforce required custom fields ──────────────────────────────────────────
  const allCats = await prisma.ticketCategory.findMany({ select: { id: true, parentId: true } })
  const parentMap = Object.fromEntries(allCats.map(c => [c.id, c.parentId!]))
  const catIds = new Set<number>()
  let cur = category!
  while (cur != null) {
    catIds.add(cur)
    cur = parentMap[cur]
  }
  const defs = await prisma.ticketFieldDefinition.findMany({
    where: { applicableCategoryId: { in: Array.from(catIds) } },
    select: { id: true, requiredAtCreation: true }
  })
  const requiredDefs = defs.filter(d => d.requiredAtCreation).map(d => d.id)
  const providedDefIds = new Set(fieldArr.map(f => f.fieldDefinitionId))
  const missing = requiredDefs.filter(id => !providedDefIds.has(id))
  if (missing.length) {
    return NextResponse.json({
      error: `Missing required custom fields: ${missing.join(', ')}`
    }, { status: 400 })
  }

  // ─── create ticket + thread + attachments + fields ──────────────────────────
  try {
    const { ticket, thread, event } = await prisma.$transaction(async tx => {
      const ticket = await tx.ticket.create({
        data: {
          title: title!.trim(),
          createdById: actorEntityId!,
          currentAssignedToId: assignto!,
          currentPriorityId: priority!,
          currentStatusId: status!,
          currentCategoryId: category!,
        }
      })

      const thread = await tx.ticketThread.create({
        data: {
          ticketId: ticket.id,
          body: body!.trim(),
          createdById: actorEntityId!
        }
      })

      const event = await tx.notificationEvent.create({
        data: {
          type: 'TICKET_CREATED',
          onThreadId: thread.id,
        }
      })

      if (attachments) {
        for (const at of attachments) {
          const parts = at.filePath.split('/').pop()?.split('.') || []
          const ext = parts.length > 1 ? parts.pop()! : undefined
          await tx.ticketThreadAttachment.create({
            data: {
              ticketThreadId: thread.id,
              filePath: at.filePath,
              fileName: parts.join('.'),
              fileType: at.fileType ?? ext,
              ...(typeof at.fileSize === 'number'
                ? { fileSize: at.fileSize }
                : {})
            }
          })
        }
      }

      for (const f of fieldArr) {
        await tx.ticketFieldValue.create({
          data: {
            ticketId: ticket.id,
            ticketFieldDefinitionId: f.fieldDefinitionId,
            value: f.value
          }
        })
      }

      return { ticket, thread, event }
    })

    // ─── enqueue notification for NEW_THREAD ───────────────────────────────────
    await enqueueNotificationInit(event.id)

    return NextResponse.json({ ticket, thread }, { status: 201 })
  } catch (err: any) {
    console.error('Error creating ticket:', err)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}