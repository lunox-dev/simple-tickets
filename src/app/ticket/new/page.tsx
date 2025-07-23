import NewTicketForm from "@/components/ticket/new"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function NewTicketPage() {
  return (
    <div>
      {/* Original page content */}
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
    </div>
  )
}
