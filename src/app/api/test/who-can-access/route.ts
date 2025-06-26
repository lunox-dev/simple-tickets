// src/app/api/test/who-can-access/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getTicketAccessUsers } from '@/lib/access-users'

export async function GET(req: NextRequest) {
  const ticketIdParam = req.nextUrl.searchParams.get('ticketId')
  if (!ticketIdParam) {
    return NextResponse.json(
      { error: 'Missing required query parameter: ticketId' },
      { status: 400 }
    )
  }

  const ticketId = parseInt(ticketIdParam, 10)
  if (isNaN(ticketId)) {
    return NextResponse.json(
      { error: 'Invalid ticketId; must be an integer' },
      { status: 400 }
    )
  }

  try {
    const access = await getTicketAccessUsers(ticketId)
    return NextResponse.json(access)
  } catch (err) {
    console.error('who-can-access error:', err)
    return NextResponse.json(
      { error: 'Internal server error while fetching access' },
      { status: 500 }
    )
  }
}
