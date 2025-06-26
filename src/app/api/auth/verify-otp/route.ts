// src/app/api/auth/verify-otp/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { email, otp } = await req.json()
  if (!email || !otp) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // 1. Lookup user
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.Active) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // 2. Lookup OTP record
  const record = await prisma.emailOTP.findFirst({
    where: { userId: user.id, otp, UsedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!record) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
  }

  // 3. Mark used
  await prisma.emailOTP.update({
    where: { id: record.id },
    data: { UsedAt: new Date() },
  })

  // 4. Return user info for NextAuth
  return NextResponse.json({ id: user.id, name: user.displayName, email: user.email })
}
