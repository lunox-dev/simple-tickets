import { notFound } from "next/navigation"
import TicketView from "@/components/ticket/view"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // await the params promise
  const { id } = await params

  const ticketId = Number.parseInt(id, 10)
  if (isNaN(ticketId)) {
    notFound()
  }

  return <TicketView ticketId={ticketId} />
}
