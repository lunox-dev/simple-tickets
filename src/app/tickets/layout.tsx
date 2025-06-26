import type React from "react"
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { redirect } from "next/navigation"
import AuthenticatedHeader from "@/components/ticket/common/authenticated-header"
import NoPermission from '@/components/ui/NoPermission'

export default async function TicketLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    redirect("/login")
  }

  // Check for ticket read permissions (user, team, or userTeam)
  const userPerms = (session.user as any).permissions as string[] || [];
  const userTeams = (session.user as any).teams as Array<{
    permissions: string[];
    userTeamPermissions: string[];
  }> || [];
  const allPerms = [
    ...userPerms,
    ...userTeams.flatMap(t => [...t.permissions, ...t.userTeamPermissions])
  ];
  const hasTicketRead = allPerms.some(p => p.startsWith('ticket:read:'));
  if (!hasTicketRead) {
    return <NoPermission message="You do not have permission to view any tickets." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AuthenticatedHeader session={session} />
      <main className="pt-16">{children}</main>
    </div>
  )
}
