// src/notifications/send.ts
import nodemailer from 'nodemailer'
import https from 'https'


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
      // create an HTTPS agent for internal TLS handling
      const agent = new https.Agent({
        rejectUnauthorized: false, // ignore cert hostname mismatch
        minVersion: 'TLSv1.2'      // force TLS 1.2 if server requires it
      })

      const response = await fetch(process.env.EMAIL_API_ENDPOINT!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Server-API-Key': process.env.EMAIL_API_KEY!
        },
        body: JSON.stringify(payload),
        agent // pass the custom agent here
      } as any)

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

export async function sendSMS(to: string, text: string) {
  const phone = to.replace(/^\+/, '') // remove leading +
  const payload = {
    data: text,
    phoneNumber: phone,
    sIDCode: process.env.SMS_ID_CODE!,
    userName: process.env.SMS_USER!,
    password: process.env.SMS_PASS!
  }
  console.log(`[sendSMS] Sending SMS to: ${phone}, payload:`, payload)
  try {
    const response = await fetch(process.env.SMS_HOST!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const responseBody = await response.text()
    console.log(`[sendSMS] SMS response status: ${response.status}, body:`, responseBody)
    return responseBody
  } catch (err: any) {
    // Check for undici connection timeout errors (common in Node 18+ with fetch)
    if (err.code === 'UND_ERR_CONNECT_TIMEOUT' || err.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      console.error(`[sendSMS] Connection timeout to SMS gateway (${process.env.SMS_HOST}). Are you connected to the VPN?`)
    }
    throw err
  }
}
