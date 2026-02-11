"use client"

import { useState, useEffect } from "react"
import { DashboardFilter } from "./dashboard-filter"
import { StatsOverview } from "./stats-overview"
import { StatsCharts } from "./stats-charts"
import { LatestTicketsList } from "./latest-tickets"
import { DashboardFilterState, DashboardStats } from "./types"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface DashboardContentProps {
    statuses: { id: number; name: string; color: string }[]
    priorities: { id: number; name: string; color: string }[]
}

export function DashboardContent({ statuses, priorities }: DashboardContentProps) {
    const [filters, setFilters] = useState<DashboardFilterState>({
        statusIds: [],
        priorityIds: [],
    })
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true)
            try {
                const res = await fetch('/api/dashboard/stats', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(filters),
                })
                if (res.ok) {
                    const data = await res.json()
                    setStats(data)
                } else {
                    console.error("Failed to fetch dashboard stats")
                }
            } catch (error) {
                console.error("Error fetching dashboard stats:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [filters])

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <div className="flex items-center space-x-2">
                    <DashboardFilter
                        statuses={statuses}
                        priorities={priorities}
                        filters={filters}
                        setFilters={setFilters}
                    />
                </div>
            </div>

            {loading && !stats ? (
                <div className="flex h-[400px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : stats ? (
                <div className="space-y-4">
                    <StatsOverview
                        myAssignmentsCount={stats.myAssignmentsCount}
                        teamAssignmentsCount={stats.teamAssignmentsCount}
                    />

                    <StatsCharts
                        statusCounts={stats.statusCounts}
                        priorityCounts={stats.priorityCounts}
                        statuses={statuses}
                        priorities={priorities}
                    />

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <Card className="col-span-4 lg:col-span-7">
                            <CardHeader>
                                <CardTitle>Recent Tickets</CardTitle>
                                <CardDescription>
                                    Latest tickets matching your filters.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <LatestTicketsList tickets={stats.latestTickets} />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : (
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                    Failed to load data.
                </div>
            )}
        </div>
    )
}
