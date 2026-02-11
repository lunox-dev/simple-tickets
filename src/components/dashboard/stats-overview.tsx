import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, User, ClipboardList } from "lucide-react"

interface StatsOverviewProps {
    myAssignmentsCount: number
    teamAssignmentsCount: number
}

export function StatsOverview({
    myAssignmentsCount,
    teamAssignmentsCount,
}: StatsOverviewProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">My Assignments</CardTitle>
                    <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{myAssignmentsCount}</div>
                    <p className="text-xs text-muted-foreground">
                        Active tickets assigned to you
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Team Assignments</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{teamAssignmentsCount}</div>
                    <p className="text-xs text-muted-foreground">
                        Active tickets assigned to your teams
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Ongoing</CardTitle>
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{myAssignmentsCount + teamAssignmentsCount}</div>
                    <p className="text-xs text-muted-foreground">
                        Total active assignments relevant to you
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
