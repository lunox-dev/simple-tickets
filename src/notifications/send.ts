// src/notifications/send.ts
import nodemailer from 'nodemailer'

const EMAIL_PROTOCOL = process.env.EMAIL_PROTOCOL || 'SMTP'
const EMAIL_FROM = process.env.EMAIL_FROM!

// SMTP transporter (only used if SMTP selected)
const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!
  }
})

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  headers?: Record<string, string>
) {


  if (!EMAIL_FROM) {
    throw new Error('EMAIL_FROM is not configured')
  }

  const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

  // =========================
  // SMTP
  // =========================
  if (EMAIL_PROTOCOL === 'SMTP') {


    const mailOptions = {
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text,
      ...(headers ? { headers } : {})
    }

    return await smtpTransporter.sendMail(mailOptions)
  }

  // =========================
  // POSTAL API
  // =========================
  if (EMAIL_PROTOCOL === 'API/POSTAL') {


    const payload = {
      from: EMAIL_FROM,
      to: [to],
      subject,
      html_body: html,
      plain_body: text,
      headers: headers || {}
    }

    try {
      const response = await fetch(process.env.EMAIL_API_ENDPOINT!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Server-API-Key': process.env.EMAIL_API_KEY!
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()



      if (result.status !== 'success') {
        console.error(`[sendEmail] Postal API error:`, result)
        throw new Error('Postal API failed')
      }

      return result
    } catch (err) {
      console.error(`[sendEmail] Postal API request failed:`, err)
      throw err
    }
  }

  if (EMAIL_PROTOCOL === 'API/MAILGUN') {
    throw new Error('MAILGUN API transport not implemented yet')
  }

  throw new Error(`Unknown EMAIL_PROTOCOL: ${EMAIL_PROTOCOL}`)
}
