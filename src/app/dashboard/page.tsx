import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { prisma } from "@/lib/prisma"
import { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Ticket statistics and overview",
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/dashboard")
  }

  const [statuses, priorities] = await Promise.all([
    prisma.ticketStatus.findMany({ orderBy: { priority: "asc" } }),
    prisma.ticketPriority.findMany({ orderBy: { priority: "asc" } }),
  ])

  return (
    <DashboardContent
      statuses={statuses.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
      priorities={priorities.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
    />
  )
}