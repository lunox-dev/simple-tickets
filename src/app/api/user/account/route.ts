import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        displayName: true,
        email: true,
        mobile: true,
        emailNotificationPreferences: true,
        smsNotificationPreferences: true,
        permissions: true,
        userTeams: {
          where: { Active: true },
          select: {
            id: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Type guard to check if value is a JsonObject with a rules array
    function hasRulesArray(val: unknown): val is { rules: unknown } {
      return (
        typeof val === 'object' &&
        val !== null &&
        'rules' in val &&
        Array.isArray((val as any).rules)
      )
    }

    let emailNotificationPreferences = user.emailNotificationPreferences
    if (!hasRulesArray(emailNotificationPreferences)) {
      emailNotificationPreferences = { rules: [] }
    }

    let smsNotificationPreferences = user.smsNotificationPreferences
    if (!hasRulesArray(smsNotificationPreferences)) {
      smsNotificationPreferences = { rules: [] }
    }

    return NextResponse.json({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      mobile: user.mobile,
      permissions: user.permissions,
      emailNotificationPreferences,
      smsNotificationPreferences,
      teams: user.userTeams.map((ut) => ({
        userTeamId: ut.id,
        teamId: ut.team.id,
        name: ut.team.name,
      })),
    })
  } catch (error) {
    console.error("Error fetching user account:", error)
    return NextResponse.json({ error: "Internal server error while fetching user account" }, { status: 500 })
  }
}
