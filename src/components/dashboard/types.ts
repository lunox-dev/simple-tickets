export interface DashboardFilterState {
    statusIds: number[]
    priorityIds: number[]
}

export interface DashboardStats {
    statusCounts: { statusId: number; count: number }[]
    priorityCounts: { priorityId: number; count: number }[]
    myAssignmentsCount: number
    teamAssignmentsCount: number
    latestTickets: LatestTicket[]
}

export interface LatestTicket {
    id: number
    title: string
    status: { id: number; name: string; color: string }
    priority: { id: number; name: string; color: string }
    assignedTo: { name: string } | null
    createdAt: string
}
