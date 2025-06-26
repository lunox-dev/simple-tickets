import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import TicketList from "@/components/ticket/list"

export default function TicketsPage() {
  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <TicketList />
        </CardContent>
      </Card>
    </div>
  )
}
