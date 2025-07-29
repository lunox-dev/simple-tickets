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
      <div className="flex h-screen bg-white">
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
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-bold text-gray-800">Tickets</h1>
                {pagination && <Badge variant="secondary">{pagination.totalItems} total</Badge>}
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={fetchTickets} disabled={isLoading}>
                  <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => router.push("/ticket/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Ticket
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="p-6">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <MessageSquare className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-800">No Tickets Found</h3>
                <p className="text-gray-500 mt-1">There are no tickets matching your current filters.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {tickets.map((ticket) => (
                  <li
                    key={ticket.id}
                    className="p-4 sm:p-6 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                    onClick={() => handleTicketClick(ticket.id)}
                  >
                    <div className="flex items-start justify-between space-x-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-sm font-mono text-gray-500">#{ticket.id}</span>
                          <Badge
                            className="text-xs font-semibold"
                            style={{
                              backgroundColor: getStatusColor(ticket.currentStatusId),
                              color: getContrastColor(getStatusColor(ticket.currentStatusId)),
                            }}
                          >
                            {getStatusName(ticket.currentStatusId)}
                          </Badge>
                          <Badge
                            className="text-xs font-semibold"
                            style={{
                              backgroundColor: getPriorityColor(ticket.currentPriorityId),
                              color: getContrastColor(getPriorityColor(ticket.currentPriorityId)),
                            }}
                          >
                            {getPriorityName(ticket.currentPriorityId)}
                          </Badge>
                        </div>

                        <h2 className="text-base font-semibold text-gray-800 truncate mb-1">{ticket.title}</h2>

                        <p className="text-sm text-gray-600 line-clamp-1 mb-2">
                          <span className="font-medium">{ticket.createdBy.name}</span>
                          <span className="text-gray-400 mx-1">&middot;</span>
                          {ticket.body}
                        </p>

                        {/* Compact time display */}
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center space-x-1 cursor-help">
                                <Clock className="h-3 w-3" />
                                <span>
                                  Created {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Created: {format(new Date(ticket.createdAt), "MMM dd, yyyy 'at' HH:mm")}</p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center space-x-1 cursor-help">
                                <Edit className="h-3 w-3" />
                                <span>
                                  Updated {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Updated: {format(new Date(ticket.updatedAt), "MMM dd, yyyy 'at' HH:mm")}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
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
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-3 border-t border-gray-200 text-sm text-gray-600 flex items-center justify-between">
              <div>
                Showing {pagination.startIndex} to {pagination.endIndex} of {pagination.totalItems} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  )
}
