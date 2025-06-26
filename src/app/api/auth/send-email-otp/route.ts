// src/app/api/auth/send-email-otp/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.Active) {
    return NextResponse.json({ error: 'No account found with this email address.' }, { status: 404 })
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60_000)
  await prisma.emailOTP.create({
    data: { userId: user.id, otp, expiresAt },
  })

  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Your Simple Tickets login code',
    text: `Your code is ${otp}. It expires in 5 minutes.`,
  })

  return NextResponse.json({ ok: true })
}
