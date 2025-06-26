import { NextRequest, NextResponse } from 'next/server'
import { getAccessibleTicketsByUser } from '@/lib/access-tickets'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const userIdParam = url.searchParams.get('userId')
  const limitParam = url.searchParams.get('limit')

  if (!userIdParam || isNaN(Number(userIdParam))) {
    return NextResponse.json({ error: 'Missing or invalid userId' }, { status: 400 })
  }

  const userId = Number(userIdParam)
  const limit = limitParam ? Math.min(Number(limitParam), 1000) : 100 // Optional limit cap

  try {
    const result = await getAccessibleTicketsByUser(userId, limit)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in /api/test/what-can-access:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
