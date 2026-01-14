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

export async function sendEmail(to: string, subject: string, html: string, headers?: Record<string, string>) {
  console.log(`[sendEmail] Preparing to send email...`);
  console.log(`[sendEmail] SMTP config:`, {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    from: process.env.SMTP_FROM,
    user: process.env.SMTP_USER,
    // Do NOT log password!
  });
  // crude HTML to text fallback
  const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const mailOptions = {
    from: process.env.SMTP_FROM!,
    to,
    subject,
    html,
    text,
    ...(headers ? { headers } : {})
  };
  console.log(`[sendEmail] Mail options:`, mailOptions);

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`[sendEmail] Email sent result:`, result);
    if (result.accepted && result.accepted.length > 0) {
      console.log(`[sendEmail] Email accepted by SMTP server for:`, result.accepted);
    }
    if (result.rejected && result.rejected.length > 0) {
      console.warn(`[sendEmail] Email rejected by SMTP server for:`, result.rejected);
    }
    if (result.response) {
      console.log(`[sendEmail] SMTP response:`, result.response);
    }
    return result;
  } catch (err) {
    console.error(`[sendEmail] Error sending email:`, err);
    throw err;
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
  } catch (err: any) {
    if (err.code === 'UND_ERR_CONNECT_TIMEOUT' || err.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      console.error(`[sendSMS] Connection timeout to SMS gateway (${process.env.SMS_HOST}). Are you connected to the VPN?`)
    }
    console.error(`[sendSMS] Error sending SMS:`, err)
    throw err
  }
}


