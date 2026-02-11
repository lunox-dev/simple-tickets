import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { LatestTicket } from "./types"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"

interface LatestTicketsListProps {
    tickets: LatestTicket[]
}

export function LatestTicketsList({ tickets }: LatestTicketsListProps) {
    const router = useRouter()

    if (tickets.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground">
                No recent tickets found.
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[80px]">ID</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead className="text-right">Created</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tickets.map((ticket) => (
                        <TableRow
                            key={ticket.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/ticket/${ticket.id}`)}
                        >
                            <TableCell className="font-medium">#{ticket.id}</TableCell>
                            <TableCell className="font-medium">{ticket.title}</TableCell>
                            <TableCell>
                                <Badge
                                    variant="secondary"
                                    style={{
                                        backgroundColor: `${ticket.status.color}20`,
                                        color: ticket.status.color,
                                    }}
                                >
                                    {ticket.status.name}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge
                                    variant="outline"
                                    style={{
                                        borderColor: ticket.priority.color,
                                        color: ticket.priority.color,
                                    }}
                                >
                                    {ticket.priority.name}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                {ticket.assignedTo ? (
                                    <span className="text-sm">{ticket.assignedTo.name}</span>
                                ) : (
                                    <span className="text-sm text-muted-foreground italic">
                                        Unassigned
                                    </span>
                                )}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                                {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
