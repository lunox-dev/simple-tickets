// src/app/api/ticket/list/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession }        from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma }                  from '@/lib/prisma'
import { getAccessibleTicketsByUser } from '@/lib/access-tickets'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = Number((session.user as any).id)
  if (!userId || isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid session user' }, { status: 400 })
  }

  // 1) Which tickets can this user see?
  const accessResult        = await getAccessibleTicketsByUser(userId, 1000)
  const accessibleTicketIds = accessResult.tickets.map(t => t.ticketId)
  if (accessibleTicketIds.length === 0) {
    return NextResponse.json({ error: 'Forbidden: You do not have permission to view any tickets.' }, { status: 403 })
  }

  // 2) Find any unread notifications for this user across those tickets
  const unreadRows = await prisma.notificationRecipient.findMany({
    where: {
      userId,
      read: false,
      event: {
        OR: [
          { onThread:           { ticketId: { in: accessibleTicketIds } } },
          { onAssignmentChange: { ticketId: { in: accessibleTicketIds } } },
          { onPriorityChange:   { ticketId: { in: accessibleTicketIds } } },
          { onStatusChange:     { ticketId: { in: accessibleTicketIds } } },
          { onCategoryChange:   { ticketId: { in: accessibleTicketIds } } },
        ]
      }
    },
    select: {
      event: {
        select: {
          onThread:           { select: { ticketId: true } },
          onAssignmentChange: { select: { ticketId: true } },
          onPriorityChange:   { select: { ticketId: true } },
          onStatusChange:     { select: { ticketId: true } },
          onCategoryChange:   { select: { ticketId: true } },
        }
      }
    }
  })

  const unreadByTicket = new Set<number>()
  for (const { event } of unreadRows) {
    if (event.onThread) {
      unreadByTicket.add(event.onThread.ticketId)
    } else if (event.onAssignmentChange) {
      unreadByTicket.add(event.onAssignmentChange.ticketId)
    } else if (event.onPriorityChange) {
      unreadByTicket.add(event.onPriorityChange.ticketId)
    } else if (event.onStatusChange) {
      unreadByTicket.add(event.onStatusChange.ticketId)
    } else if (event.onCategoryChange) {
      unreadByTicket.add(event.onCategoryChange.ticketId)
    }
  }

  // 3) Parse filters & pagination
  const qp       = req.nextUrl.searchParams
  const page     = Math.max(1, parseInt(qp.get('page')     || '1',   10))
  const pageSize = Math.min(500, Math.max(1, parseInt(qp.get('pageSize') || '100', 10)))
  const fromDate = qp.get('fromDate') ? new Date(qp.get('fromDate')!) : null
  const toDate   = qp.get('toDate')   ? new Date(qp.get('toDate')!)   : null
  const sort     = qp.get('sort')?.toLowerCase() === 'asc' ? 'asc' : 'desc'

  const statusIds   = qp.getAll('status').map(Number).filter(Boolean)
  const priorityIds = qp.getAll('priority').map(Number).filter(Boolean)
  const assignedIds = qp.getAll('assignedEntity').map(Number).filter(Boolean)

  const fieldFilters: Array<{ ticketFieldDefinitionId: number; value: string }> = []
  for (const [key,val] of qp.entries()) {
    if (key.startsWith('field_')) {
      const defId = parseInt(key.slice(6),10)
      if (!isNaN(defId)) fieldFilters.push({ ticketFieldDefinitionId: defId, value: val })
    }
  }

  // 4) Build your ticket WHERE clause
  const where: any = { id: { in: accessibleTicketIds }, AND: [] }
  if (fromDate || toDate) {
    const dt: any = {}
    if (fromDate) dt.gte = fromDate
    if (toDate)   dt.lte = toDate
    where.AND.push({ createdAt: dt })
  }
  if (statusIds.length)   where.AND.push({ currentStatusId:   { in: statusIds } })
  if (priorityIds.length) where.AND.push({ currentPriorityId: { in: priorityIds } })
  if (assignedIds.length) where.AND.push({ currentAssignedToId:{ in: assignedIds } })
  for (const f of fieldFilters) {
    where.AND.push({
      fieldValues: {
        some: {
          ticketFieldDefinitionId: f.ticketFieldDefinitionId,
          value:                   f.value
        }
      }
    })
  }

  // 5) Fetch count + page of tickets
  const [ total, raw ] = await prisma.$transaction([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: sort },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      select: {
        id:    true,
        title: true,
        threads: { orderBy: { createdAt: 'asc' }, take: 1, select: { body: true } },
        currentStatus:   { select: { id: true } },
        currentPriority: { select: { id: true } },
        currentAssignedTo: {
          select: {
            id: true,
            team:     { select: { name: true } },
            userTeam: {
              select: {
                user: { select: { displayName: true } },
                team: { select: { name: true } }
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            team:     { select: { name: true } },
            userTeam: {
              select: {
                user: { select: { displayName: true } },
                team: { select: { name: true } }
              }
            }
          }
        },
        createdAt: true,
        updatedAt: true
      }
    })
  ])

  // 6) Map to response, adding unread boolean
  const formatEntity = (e: any) =>
    e.team
      ? e.team.name
      : `${e.userTeam.user.displayName} (${e.userTeam.team.name})`

  const items = raw.map(t => ({
    id:                t.id,
    title:             t.title,
    body:              t.threads[0]?.body.slice(0,250) ?? '',
    currentStatusId:   t.currentStatus.id,
    currentPriorityId: t.currentPriority.id,
    currentAssignedTo: t.currentAssignedTo
      ? { entityId: t.currentAssignedTo.id, name: formatEntity(t.currentAssignedTo) }
      : null,
    createdBy: {
      entityId: t.createdBy.id,
      name:     formatEntity(t.createdBy)
    },
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    unread:    unreadByTicket.has(t.id)
  }))

  // 7) Return paginated response
  const totalPages  = Math.ceil(total / pageSize)
  const itemsOnPage = items.length
  const startIndex  = (page - 1) * pageSize + 1
  const endIndex    = startIndex + itemsOnPage - 1

  return NextResponse.json({
    page,
    pageSize,
    totalItems:  total,
    totalPages,
    itemsOnPage,
    startIndex,
    endIndex,
    data: items
  })
}
