import { notFound } from "next/navigation"
import TicketView from "@/components/ticket/view"

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const ticketId = Number.parseInt(id, 10)
  if (isNaN(ticketId)) {
    notFound()
  }

  return <TicketView ticketId={ticketId} />
}
