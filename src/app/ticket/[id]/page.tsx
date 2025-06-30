import { notFound } from "next/navigation"
import TicketView from "@/components/ticket/view"

interface TicketPageProps {
  params: {
    id: string
  }
}

export default function TicketPage({ params }: TicketPageProps) {
  const ticketId = Number.parseInt(params.id, 10)

  if (isNaN(ticketId)) {
    notFound()
  }

  return <TicketView ticketId={ticketId} />
}
