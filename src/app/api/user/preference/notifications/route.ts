import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions"

// Validation schema for notification rules
const validateNotificationRules = (rules: any[]): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (!Array.isArray(rules)) {
    return { valid: false, errors: ["Rules must be an array"] }
  }

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]

    if (!rule.id || typeof rule.id !== "string") {
      errors.push(`Rule ${i + 1}: ID is required and must be a string`)
    }

    if (!rule.eventTypes || !Array.isArray(rule.eventTypes) || rule.eventTypes.length === 0) {
      errors.push(`Rule ${i + 1}: eventTypes is required and must be a non-empty array`)
    }

    if (!rule.conditions || typeof rule.conditions !== "object") {
      errors.push(`Rule ${i + 1}: conditions is required and must be an object`)
    }

    if (typeof rule.enabled !== "boolean") {
      errors.push(`Rule ${i + 1}: enabled must be a boolean`)
    }

    // Validate event types
    const validEventTypes = ["TICKET_CREATED", "ASSIGNMENT_CHANGED", "PRIORITY_CHANGED", "STATUS_CHANGED", "NEW_THREAD"]

    if (rule.eventTypes) {
      for (const eventType of rule.eventTypes) {
        if (!validEventTypes.includes(eventType)) {
          errors.push(`Rule ${i + 1}: Invalid event type '${eventType}'`)
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { email, sms } = body

    // Validate email rules if provided
    if (email) {
      const emailValidation = validateNotificationRules(email.rules || [])
      if (!emailValidation.valid) {
        return NextResponse.json(
          {
            error: "Invalid email notification rules",
            details: emailValidation.errors,
          },
          { status: 400 },
        )
      }
    }

    // Validate SMS rules if provided
    if (sms) {
      const smsValidation = validateNotificationRules(sms.rules || [])
      if (!smsValidation.valid) {
        return NextResponse.json(
          {
            error: "Invalid SMS notification rules",
            details: smsValidation.errors,
          },
          { status: 400 },
        )
      }
    }

    // Update user preferences
    const updateData: any = {}
    if (email) {
      updateData.emailNotificationPreferences = email
    }
    if (sms) {
      updateData.smsNotificationPreferences = sms
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating notification preferences:", error)
    return NextResponse.json({ error: "Internal server error while updating preferences" }, { status: 500 })
  }
}
