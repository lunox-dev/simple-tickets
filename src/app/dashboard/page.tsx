import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { prisma } from "@/lib/prisma"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Ticket statistics and overview",
}

export default async function DashboardPage() {
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