"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, MoreHorizontal, Plus, RefreshCw, Eye, AlertCircle, MessageSquare, Clock, Edit } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"
import { FilterPanel } from "./filter-panel"
import type {
  TicketListItem,
  Priority,
  Status,
  Category,
  Entity,
  PaginationInfo,
  FilterState,
  FlatCategory,
  FlatEntity,
} from "./types"

export function TicketListView() {
  const router = useRouter()
  const [tickets, setTickets] = useState<TicketListItem[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Reference data
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [flatCategories, setFlatCategories] = useState<FlatCategory[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [flatEntities, setFlatEntities] = useState<FlatEntity[]>([])

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    statuses: [],
    priorities: [],
    categories: [],
    assignedEntities: [],
    createdByEntities: [],
    fromDate: null,
    toDate: null,
    includeUserTeamsForTeams: false,
    includeUserTeamsForCreatedByTeams: false,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Flatten categories for display
  const flattenCategories = (categories: Category[], parentPath: string[] = [], level = 0): FlatCategory[] => {
    let result: FlatCategory[] = []
    categories.forEach((category) => {
      const currentPath = [...parentPath, category.name]
      result.push({
        id: category.id,
        name: category.name,
        fullPath: currentPath.join(" > "),
        level,
      })
      if (category.children && category.children.length > 0) {
        result = result.concat(flattenCategories(category.children, currentPath, level + 1))
      }
    })
    return result
  }

  // Flatten entities for display
  const flattenEntities = (entities: Entity[], parentPath: string[] = [], level = 0): FlatEntity[] => {
    let result: FlatEntity[] = []
    entities.forEach((entity) => {
      const currentPath = [...parentPath, entity.name]
      result.push({
        entityId: entity.entityId,
        name: entity.name,
        type: entity.type,
        fullPath: currentPath.join(" > "),
        level,
      })
      if (entity.children && entity.children.length > 0) {
        result = result.concat(flattenEntities(entity.children, currentPath, level + 1))
      }
    })
    return result
  }

  // Fetch reference data
  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        const [priRes, statRes, catRes, entRes] = await Promise.all([
          fetch("/api/ticket/priority/list"),
          fetch("/api/ticket/status/list"),
          fetch("/api/ticket/category/list"),
          fetch("/api/entity/list"),
        ])

        if (priRes.ok) setPriorities((await priRes.json()).priorities || [])
        if (statRes.ok) setStatuses(await statRes.json())
        if (catRes.ok) {
          const catData = await catRes.json()
          setCategories(catData)
          setFlatCategories(flattenCategories(catData))
        }
        if (entRes.ok) {
          const entData = await entRes.json()
          setEntities(entData)
          setFlatEntities(flattenEntities(entData))
        }
      } catch (err) {
        console.warn("Failed to fetch reference data:", err)
        setError("Could not load filter data. Some filters may not work.")
      }
    }

    fetchReferenceData()
  }, [])

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set("page", currentPage.toString())
      params.set("pageSize", pageSize.toString())

      filters.statuses.forEach((id) => params.append("status", id.toString()))
      filters.priorities.forEach((id) => params.append("priority", id.toString()))
      filters.categories.forEach((id) => params.append("category", id.toString()))
      filters.assignedEntities.forEach((id) => params.append("assignedEntity", id.toString()))
      filters.createdByEntities.forEach((id) => params.append("createdByEntity", id.toString()))

      if (filters.fromDate) params.set("fromDate", filters.fromDate.toISOString())
      if (filters.toDate) params.set("toDate", filters.toDate.toISOString())
      if (filters.includeUserTeamsForTeams) params.set("includeUserTeamsForTeams", "1")
      if (filters.includeUserTeamsForCreatedByTeams) params.set("includeUserTeamsForCreatedByTeams", "1")

      const response = await fetch(`/api/ticket/list?${params.toString()}`)
      if (!response.ok) throw new Error(`Failed to fetch tickets: ${response.statusText}`)

      const data = await response.json()
      let ticketData = data.data || []

      if (filters.search) {
        const term = filters.search.toLowerCase()
        ticketData = ticketData.filter(
          (t: TicketListItem) =>
            t.title.toLowerCase().includes(term) ||
            t.body.toLowerCase().includes(term) ||
            t.createdBy.name.toLowerCase().includes(term) ||
            t.currentAssignedTo?.name.toLowerCase().includes(term),
        )
      }

      setTickets(ticketData)
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
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, pageSize, filters])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  const getStatusName = (statusId: number) => statuses.find((s) => s.id === statusId)?.name || "Unknown"
  const getStatusColor = (statusId: number) => statuses.find((s) => s.id === statusId)?.color || "#808080"
  const getPriorityName = (priorityId: number) => priorities.find((p) => p.id === priorityId)?.name || "Unknown"
  const getPriorityColor = (priorityId: number) => priorities.find((p) => p.id === priorityId)?.color || "#808080"

  const getContrastColor = (hexColor: string) => {
    if (!hexColor.startsWith("#")) return "#ffffff"
    const r = Number.parseInt(hexColor.slice(1, 3), 16)
    const g = Number.parseInt(hexColor.slice(3, 5), 16)
    const b = Number.parseInt(hexColor.slice(5, 7), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "#000000" : "#ffffff"
  }

  const handleTicketClick = (ticketId: number) => router.push(`/ticket/${ticketId}`)

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          statuses={statuses}
          priorities={priorities}
          flatCategories={flatCategories}
          flatEntities={flatEntities}
          onFilterChange={() => setCurrentPage(1)}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="px-8 py-6 border-b bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Tickets</h1>
                {pagination && (
                  <Badge variant="outline" className="px-3 py-1 font-normal text-sm bg-muted/30 border-border">
                    {pagination.totalItems} Total
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm" onClick={fetchTickets} disabled={isLoading} className="border-border hover:bg-muted">
                  <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => router.push("/ticket/new")} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Ticket
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-8">
            <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
              {isLoading && tickets.length === 0 ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="p-8">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-center">
                  <div className="bg-muted p-4 rounded-full mb-4">
                    <MessageSquare className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">No tickets found</h3>
                  <p className="text-muted-foreground max-w-sm mb-6">
                    No tickets matched your search criteria. Try adjusting your filters or create a new ticket.
                  </p>
                  <Button onClick={() => setFilters({
                    search: "",
                    statuses: [],
                    priorities: [],
                    categories: [],
                    assignedEntities: [],
                    createdByEntities: [],
                    fromDate: null,
                    toDate: null,
                    includeUserTeamsForTeams: false,
                    includeUserTeamsForCreatedByTeams: false,
                  })}
                    variant="outline">
                    Clear all filters
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead className="w-[140px]">Status</TableHead>
                      <TableHead className="w-[120px]">Priority</TableHead>
                      <TableHead className="min-w-[300px]">Subject</TableHead>
                      <TableHead className="w-[180px]">Requester</TableHead>
                      <TableHead className="w-[180px]">Assigned To</TableHead>
                      <TableHead className="w-[140px] text-right">Updated</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleTicketClick(ticket.id)}
                      >
                        <TableCell className="font-mono text-muted-foreground font-medium">#{ticket.id}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="text-xs font-semibold px-2.5 py-0.5 rounded-full border-0"
                            style={{
                              backgroundColor: `${getStatusColor(ticket.currentStatusId)}20`, // 12% opacity background
                              color: getStatusColor(ticket.currentStatusId),
                              boxShadow: `0 0 0 1px ${getStatusColor(ticket.currentStatusId)}40 inset`
                            }}
                          >
                            {getStatusName(ticket.currentStatusId)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="text-xs font-semibold px-2.5 py-0.5 rounded-full border-0"
                            style={{
                              backgroundColor: `${getPriorityColor(ticket.currentPriorityId)}20`,
                              color: getPriorityColor(ticket.currentPriorityId),
                              boxShadow: `0 0 0 1px ${getPriorityColor(ticket.currentPriorityId)}40 inset`
                            }}
                          >
                            {getPriorityName(ticket.currentPriorityId)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col max-w-[500px]">
                            <span className="font-medium text-foreground truncate block mb-0.5">
                              {ticket.title}
                            </span>
                            <span className="text-xs text-muted-foreground truncate block font-normal">
                              {ticket.body}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm rounded hover:bg-muted px-2 py-1 -ml-2 transition-colors">
                              {ticket.createdBy.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {ticket.currentAssignedTo ? (
                              <span className="text-sm text-foreground bg-muted/50 px-2 py-1 rounded">
                                {ticket.currentAssignedTo.name}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground italic">Unassigned</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleTicketClick(ticket.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View ticket
                              </DropdownMenuItem>
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
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{pagination.startIndex}</span> to <span className="font-medium text-foreground">{pagination.endIndex}</span> of <span className="font-medium text-foreground">{pagination.totalItems}</span> results
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <span className="sr-only">Previous page</span>
                    <span aria-hidden>&larr;</span>
                  </Button>
                  <div className="flex items-center gap-1">
                    {/* Simplified Pagination: Just generic Prev/Next for now to match shadcn style */}
                    <span className="text-sm px-2">Page {currentPage} of {pagination.totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages!, p + 1))}
                    disabled={currentPage === pagination.totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <span className="sr-only">Next page</span>
                    <span aria-hidden>&rarr;</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
