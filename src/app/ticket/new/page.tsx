import NewTicketForm from "@/components/ticket/new"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function NewTicketPage() {
  return (
    <div className="container mx-auto p-4 md:p-8 max-w-12xl">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Create New Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <NewTicketForm />
        </CardContent>
      </Card>
    </div>
  )
}
