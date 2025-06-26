"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Loader2,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Calendar,
  User,
  AlertCircle,
  Plus,
} from "lucide-react"
import { format } from "date-fns"

interface TicketListItem {
  id: number
  title: string
  body: string
  currentStatusId: number
  currentPriorityId: number
  currentAssignedTo: {
    entityId: number
    name: string
  } | null
  createdBy: {
    entityId: number
    name: string
  }
  createdAt: string
  updatedAt: string
  unread: boolean
}

interface Priority {
  id: number
  name: string
  color: string
}

interface Status {
  id: number
  name: string
  color: string
}

interface Entity {
  entityId: string
  type: "team" | "user"
  name: string
  children?: Entity[]
}

interface PaginationInfo {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  itemsOnPage: number
  startIndex: number
  endIndex: number
}

type SortField = "title" | "createdAt" | "updatedAt" | "status" | "priority" | "assignedTo"
type SortDirection = "asc" | "desc"

export default function TicketList() {
  const [tickets, setTickets] = useState<TicketListItem[]>([])
  const [filteredTickets, setFilteredTickets] = useState<TicketListItem[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter and sort states
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [assignedFilter, setAssignedFilter] = useState<string>("all")
  const [unreadFilter, setUnreadFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("createdAt")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  // Reference data
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [entities, setEntities] = useState<Entity[]>([])

  const router = useRouter()

  // Fetch reference data
  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        const [priRes, statRes, entRes] = await Promise.all([
          fetch("/api/ticket/priority/list"),
          fetch("/api/ticket/status/list"),
          fetch("/api/entity/list"),
        ])

        if (priRes.ok) {
          const priData = await priRes.json()
          setPriorities(priData.priorities || priData)
        }
        if (statRes.ok) {
          const statData = await statRes.json()
          setStatuses(statData)
        }
        if (entRes.ok) {
          const entData = await entRes.json()
          setEntities(entData)
        }
      } catch (err) {
        console.warn("Failed to fetch reference data:", err)
      }
    }
    fetchReferenceData()
  }, [])

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/ticket/list")
      if (!response.ok) {
        throw new Error("Failed to fetch tickets")
      }

      const data = await response.json()
      setTickets(data.data || [])
      setPagination({
        page: data.page,
        pageSize: data.pageSize,
        totalItems: data.totalItems,
        totalPages: data.totalPages,
        itemsOnPage: data.itemsOnPage,
        startIndex: data.startIndex,
        endIndex: data.endIndex,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...tickets]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (ticket) =>
          ticket.title.toLowerCase().includes(term) ||
          ticket.body.toLowerCase().includes(term) ||
          ticket.createdBy.name.toLowerCase().includes(term) ||
          ticket.currentAssignedTo?.name.toLowerCase().includes(term),
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((ticket) => ticket.currentStatusId.toString() === statusFilter)
    }

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter((ticket) => ticket.currentPriorityId.toString() === priorityFilter)
    }

    // Assigned filter
    if (assignedFilter !== "all") {
      filtered = filtered.filter((ticket) => ticket.currentAssignedTo?.entityId.toString() === assignedFilter)
    }

    // Unread filter
    if (unreadFilter === "unread") {
      filtered = filtered.filter((ticket) => ticket.unread)
    } else if (unreadFilter === "read") {
      filtered = filtered.filter((ticket) => !ticket.unread)
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortField) {
        case "title":
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case "createdAt":
          aValue = new Date(a.createdAt)
          bValue = new Date(b.createdAt)
          break
        case "updatedAt":
          aValue = new Date(a.updatedAt)
          bValue = new Date(b.updatedAt)
          break
        case "status":
          aValue = getStatusName(a.currentStatusId)
          bValue = getStatusName(b.currentStatusId)
          break
        case "priority":
          aValue = getPriorityName(a.currentPriorityId)
          bValue = getPriorityName(b.currentPriorityId)
          break
        case "assignedTo":
          aValue = a.currentAssignedTo?.name || ""
          bValue = b.currentAssignedTo?.name || ""
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    setFilteredTickets(filtered)
  }, [tickets, searchTerm, statusFilter, priorityFilter, assignedFilter, unreadFilter, sortField, sortDirection])

  const getStatusName = (statusId: number) => {
    return statuses.find((s) => s.id === statusId)?.name || "Unknown"
  }

  const getStatusColor = (statusId: number) => {
    return statuses.find((s) => s.id === statusId)?.color || "#gray"
  }

  const getPriorityName = (priorityId: number) => {
    return priorities.find((p) => p.id === priorityId)?.name || "Unknown"
  }

  const getPriorityColor = (priorityId: number) => {
    return priorities.find((p) => p.id === priorityId)?.color || "#gray"
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />
    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setPriorityFilter("all")
    setAssignedFilter("all")
    setUnreadFilter("all")
  }

  const handleTicketClick = (ticketId: number) => {
    router.push(`/ticket/${ticketId}`)
  }

  const flattenEntities = (entities: Entity[]): Entity[] => {
    let result: Entity[] = []
    entities.forEach((entity) => {
      result.push(entity)
      if (entity.children) {
        result = result.concat(flattenEntities(entity.children))
      }
    })
    return result
  }

  const flatEntities = flattenEntities(entities)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">
            {pagination && `${pagination.totalItems} ticket${pagination.totalItems !== 1 ? "s" : ""}`}
          </h2>
          {filteredTickets.length !== tickets.length && (
            <Badge variant="secondary">{filteredTickets.length} filtered</Badge>
          )}
        </div>
        <Button onClick={() => router.push("/ticket/new")} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>New Ticket</span>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id.toString()}>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                        <span>{status.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority Filter */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {priorities.map((priority) => (
                    <SelectItem key={priority.id} value={priority.id.toString()}>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: priority.color }} />
                        <span>{priority.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assigned Filter */}
            <div className="space-y-2">
              <Label>Assigned To</Label>
              <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All assignees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assignees</SelectItem>
                  {flatEntities.map((entity) => (
                    <SelectItem key={entity.entityId} value={entity.entityId}>
                      <div className="flex items-center space-x-2">
                        <User className="h-3 w-3" />
                        <span>{entity.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unread Filter */}
            <div className="space-y-2">
              <Label>Read Status</Label>
              <Select value={unreadFilter} onValueChange={setUnreadFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All tickets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tickets</SelectItem>
                  <SelectItem value="unread">Unread only</SelectItem>
                  <SelectItem value="read">Read only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button variant="outline" onClick={clearFilters} className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("title")} className="h-auto p-0 font-semibold">
                    Title {getSortIcon("title")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("status")} className="h-auto p-0 font-semibold">
                    Status {getSortIcon("status")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("priority")} className="h-auto p-0 font-semibold">
                    Priority {getSortIcon("priority")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("assignedTo")} className="h-auto p-0 font-semibold">
                    Assigned To {getSortIcon("assignedTo")}
                  </Button>
                </TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("createdAt")} className="h-auto p-0 font-semibold">
                    Created {getSortIcon("createdAt")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("updatedAt")} className="h-auto p-0 font-semibold">
                    Updated {getSortIcon("updatedAt")}
                  </Button>
                </TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {tickets.length === 0 ? "No tickets found" : "No tickets match your filters"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleTicketClick(ticket.id)}
                  >
                    <TableCell>
                      {ticket.unread && <div className="w-2 h-2 bg-blue-500 rounded-full" title="Unread" />}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{ticket.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-2">{ticket.body}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="text-white"
                        style={{ backgroundColor: getStatusColor(ticket.currentStatusId) }}
                      >
                        {getStatusName(ticket.currentStatusId)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="text-white"
                        style={{ backgroundColor: getPriorityColor(ticket.currentPriorityId) }}
                      >
                        {getPriorityName(ticket.currentPriorityId)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {ticket.currentAssignedTo ? (
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{ticket.currentAssignedTo.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{ticket.createdBy.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{format(new Date(ticket.createdAt), "MMM d, yyyy")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{format(new Date(ticket.updatedAt), "MMM d, yyyy")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleTicketClick(ticket.id)}>View ticket</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator.clipboard.writeText(ticket.id.toString())
                            }}
                          >
                            Copy ticket ID
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Info */}
      {pagination && pagination.totalItems > 0 && (
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <div>
            Showing {filteredTickets.length} of {pagination.totalItems} tickets
          </div>
          <div>
            Page {pagination.page} of {pagination.totalPages}
          </div>
        </div>
      )}
    </div>
  )
}
