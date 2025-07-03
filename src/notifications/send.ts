// src/notifications/send.ts
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!
  }
})

export async function sendEmail(to: string, subject: string, html: string) {
  console.log(`[sendEmail] Sending email to: ${to}, subject: ${subject}`)
  try {
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM!,
      to,
      subject,
      html
    })
    console.log(`[sendEmail] Email sent result:`, result)
    return result
  } catch (err) {
    console.error(`[sendEmail] Error sending email:`, err)
    throw err
  }
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
  } catch (err) {
    console.error(`[sendSMS] Error sending SMS:`, err)
    throw err
  }
}


