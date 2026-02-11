"use client"

import { useMemo } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface StatsChartsProps {
    statusCounts: { statusId: number; count: number }[]
    priorityCounts: { priorityId: number; count: number }[]
    statuses: { id: number; name: string; color: string }[]
    priorities: { id: number; name: string; color: string }[]
}

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

export function StatsCharts({
    statusCounts,
    priorityCounts,
    statuses,
    priorities,
}: StatsChartsProps) {

    const statusData = useMemo(() => {
        return statusCounts.map(item => {
            const meta = statuses.find(s => s.id === item.statusId)
            return {
                name: meta?.name || `Status ${item.statusId}`,
                value: item.count,
                color: meta?.color || "#8884d8"
            }
        }).filter(d => d.value > 0)
    }, [statusCounts, statuses])

    const priorityData = useMemo(() => {
        return priorityCounts.map(item => {
            const meta = priorities.find(p => p.id === item.priorityId)
            return {
                name: meta?.name || `Priority ${item.priorityId}`,
                value: item.count,
                color: meta?.color || "#82ca9d"
            }
        }).filter(d => d.value > 0)
    }, [priorityCounts, priorities])

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle>Tickets by Status</CardTitle>
                    <CardDescription>Distribution of tickets across different statuses.</CardDescription>
                </CardHeader>
                <CardContent>
                    {statusData.length > 0 ? (
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                            No data available
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle>Tickets by Priority</CardTitle>
                    <CardDescription>Distribution of tickets across different priorities.</CardDescription>
                </CardHeader>
                <CardContent>
                    {priorityData.length > 0 ? (
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={priorityData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={100}
                                        fill="#82ca9d"
                                        dataKey="value"
                                    >
                                        {priorityData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                            No data available
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
