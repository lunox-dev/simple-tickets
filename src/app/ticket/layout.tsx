import type React from "react"
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { redirect } from "next/navigation"
import AuthenticatedHeader from "@/components/ticket/common/authenticated-header"

export default async function TicketLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    redirect("/login")
  }

  return (
    <div>
      <AuthenticatedHeader session={session} />
      <main>{children}</main>
    </div>
  )
}
