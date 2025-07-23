"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
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
  X,
  CalendarIcon,
  MoreHorizontal,
  Plus,
  RefreshCw,
  User,
  Clock,
  Eye,
  MessageSquare,
  AlertCircle,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

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

interface Category {
  id: number
  name: string
  children: Category[]
}

interface FlatCategory {
  id: number
  name: string
  fullPath: string
  level: number
}

interface Entity {
  entityId: string
  type: "team" | "user"
  name: string
  children?: Entity[]
}

interface FlatEntity {
  entityId: string
  name: string
  type: "team" | "user"
  fullPath: string
  level: number
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

interface FilterState {
  search: string
  statuses: number[]
  priorities: number[]
  categories: number[]
  assignedEntities: number[]
  createdByEntities: number[]
  fromDate: Date | null
  toDate: Date | null
  includeUserTeamsForTeams: boolean
  includeUserTeamsForCreatedByTeams: boolean
}

export default function TicketList() {
  const router = useRouter()
  const searchParams = useSearchParams()

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

  const [showFilters, setShowFilters] = useState(false)
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

        if (priRes.ok) {
          const priData = await priRes.json()
          setPriorities(priData.priorities || priData)
        }
        if (statRes.ok) {
          const statData = await statRes.json()
          setStatuses(statData)
        }
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

      // Add filters
      if (filters.search) {
        // Note: The API doesn't seem to support search, so we'll filter client-side for now
      }

      filters.statuses.forEach((id) => params.append("status", id.toString()))
      filters.priorities.forEach((id) => params.append("priority", id.toString()))
      filters.categories.forEach((id) => params.append("category", id.toString()))
      filters.assignedEntities.forEach((id) => params.append("assignedEntity", id.toString()))
      filters.createdByEntities.forEach((id) => params.append("createdByEntity", id.toString()))

      if (filters.fromDate) {
        params.set("fromDate", filters.fromDate.toISOString())
      }
      if (filters.toDate) {
        params.set("toDate", filters.toDate.toISOString())
      }

      if (filters.includeUserTeamsForTeams) {
        params.set("includeUserTeamsForTeams", "1")
      }
      if (filters.includeUserTeamsForCreatedByTeams) {
        params.set("includeUserTeamsForCreatedByTeams", "1")
      }

      const response = await fetch(`/api/ticket/list?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Failed to fetch tickets")
      }

      const data = await response.json()

      // Client-side search filtering if search term exists
      let filteredData = data.data || []
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase()
        filteredData = filteredData.filter(
          (ticket: TicketListItem) =>
            ticket.title.toLowerCase().includes(searchTerm) ||
            ticket.body.toLowerCase().includes(searchTerm) ||
            ticket.createdBy.name.toLowerCase().includes(searchTerm) ||
            ticket.currentAssignedTo?.name.toLowerCase().includes(searchTerm),
        )
      }

      setTickets(filteredData)
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
  }, [currentPage, pageSize, filters])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

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

  const getContrastColor = (hexColor: string) => {
    const color = hexColor.replace("#", "")
    const r = Number.parseInt(color.substr(0, 2), 16)
    const g = Number.parseInt(color.substr(2, 2), 16)
    const b = Number.parseInt(color.substr(4, 2), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? "#000000" : "#ffffff"
  }

  const clearFilters = () => {
    setFilters({
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
    setCurrentPage(1)
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (filters.search) count++
    if (filters.statuses.length) count++
    if (filters.priorities.length) count++
    if (filters.categories.length) count++
    if (filters.assignedEntities.length) count++
    if (filters.createdByEntities.length) count++
    if (filters.fromDate || filters.toDate) count++
    return count
  }

  const handleTicketClick = (ticketId: number) => {
    router.push(`/ticket/${ticketId}`)
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
              {pagination && (
                <Badge variant="secondary" className="text-sm">
                  {pagination.totalItems} total
                </Badge>
              )}
              {getActiveFilterCount() > 0 && (
                <Badge variant="outline" className="text-sm">
                  {getActiveFilterCount()} filter{getActiveFilterCount() !== 1 ? "s" : ""} active
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={cn("relative", getActiveFilterCount() > 0 && "border-blue-300 bg-blue-50")}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {getActiveFilterCount() > 0 && (
                  <Badge className="ml-2 h-5 w-5 p-0 text-xs bg-blue-600">{getActiveFilterCount()}</Badge>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={fetchTickets}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => router.push("/ticket/new")}>
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Advanced Filters Sidebar */}
        {showFilters && (
          <div className="w-80 bg-white border-r border-gray-200 h-screen sticky top-16 overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Filters</h2>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Search */}
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tickets..."
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="space-y-3">
                <Label>Status</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {statuses.map((status) => (
                    <div key={status.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status.id}`}
                        checked={filters.statuses.includes(status.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilters((prev) => ({
                              ...prev,
                              statuses: [...prev.statuses, status.id],
                            }))
                          } else {
                            setFilters((prev) => ({
                              ...prev,
                              statuses: prev.statuses.filter((id) => id !== status.id),
                            }))
                          }
                        }}
                      />
                      <label
                        htmlFor={`status-${status.id}`}
                        className="flex items-center space-x-2 text-sm cursor-pointer"
                      >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                        <span>{status.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div className="space-y-3">
                <Label>Priority</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {priorities.map((priority) => (
                    <div key={priority.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`priority-${priority.id}`}
                        checked={filters.priorities.includes(priority.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilters((prev) => ({
                              ...prev,
                              priorities: [...prev.priorities, priority.id],
                            }))
                          } else {
                            setFilters((prev) => ({
                              ...prev,
                              priorities: prev.priorities.filter((id) => id !== priority.id),
                            }))
                          }
                        }}
                      />
                      <label
                        htmlFor={`priority-${priority.id}`}
                        className="flex items-center space-x-2 text-sm cursor-pointer"
                      >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: priority.color }} />
                        <span>{priority.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              <div className="space-y-3">
                <Label>Category</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {flatCategories.map((category) => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category.id}`}
                        checked={filters.categories.includes(category.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilters((prev) => ({
                              ...prev,
                              categories: [...prev.categories, category.id],
                            }))
                          } else {
                            setFilters((prev) => ({
                              ...prev,
                              categories: prev.categories.filter((id) => id !== category.id),
                            }))
                          }
                        }}
                      />
                      <label
                        htmlFor={`category-${category.id}`}
                        className="text-sm cursor-pointer"
                        style={{ paddingLeft: `${category.level * 16}px` }}
                      >
                        {category.level > 0 && "└─ "}
                        {category.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assigned To Filter */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Assigned To</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-user-teams"
                      checked={filters.includeUserTeamsForTeams}
                      onCheckedChange={(checked) => {
                        setFilters((prev) => ({
                          ...prev,
                          includeUserTeamsForTeams: !!checked,
                        }))
                      }}
                    />
                    <Label htmlFor="include-user-teams" className="text-xs text-muted-foreground">
                      Include team members
                    </Label>
                  </div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {flatEntities.map((entity) => (
                    <div key={entity.entityId} className="flex items-center space-x-2">
                      <Checkbox
                        id={`assigned-${entity.entityId}`}
                        checked={filters.assignedEntities.includes(Number(entity.entityId))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilters((prev) => ({
                              ...prev,
                              assignedEntities: [...prev.assignedEntities, Number(entity.entityId)],
                            }))
                          } else {
                            setFilters((prev) => ({
                              ...prev,
                              assignedEntities: prev.assignedEntities.filter((id) => id !== Number(entity.entityId)),
                            }))
                          }
                        }}
                      />
                      <label
                        htmlFor={`assigned-${entity.entityId}`}
                        className="text-sm cursor-pointer"
                        style={{ paddingLeft: `${entity.level * 16}px` }}
                      >
                        {entity.level > 0 && "└─ "}
                        {entity.name} ({entity.type})
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Created By Filter */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Created By</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-created-by-teams"
                      checked={filters.includeUserTeamsForCreatedByTeams}
                      onCheckedChange={(checked) => {
                        setFilters((prev) => ({
                          ...prev,
                          includeUserTeamsForCreatedByTeams: !!checked,
                        }))
                      }}
                    />
                    <Label htmlFor="include-created-by-teams" className="text-xs text-muted-foreground">
                      Include team members
                    </Label>
                  </div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {flatEntities.map((entity) => (
                    <div key={entity.entityId} className="flex items-center space-x-2">
                      <Checkbox
                        id={`created-by-${entity.entityId}`}
                        checked={filters.createdByEntities.includes(Number(entity.entityId))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilters((prev) => ({
                              ...prev,
                              createdByEntities: [...prev.createdByEntities, Number(entity.entityId)],
                            }))
                          } else {
                            setFilters((prev) => ({
                              ...prev,
                              createdByEntities: prev.createdByEntities.filter((id) => id !== Number(entity.entityId)),
                            }))
                          }
                        }}
                      />
                      <label
                        htmlFor={`created-by-${entity.entityId}`}
                        className="text-sm cursor-pointer"
                        style={{ paddingLeft: `${entity.level * 16}px` }}
                      >
                        {entity.level > 0 && "└─ "}
                        {entity.name} ({entity.type})
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-3">
                <Label>Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !filters.fromDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.fromDate ? format(filters.fromDate, "MMM d") : "From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.fromDate || undefined}
                        onSelect={(date) => setFilters((prev) => ({ ...prev, fromDate: date || null }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !filters.toDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.toDate ? format(filters.toDate, "MMM d") : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.toDate || undefined}
                        onSelect={(date) => setFilters((prev) => ({ ...prev, toDate: date || null }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets found</h3>
                <p className="text-gray-500 mb-4">
                  {getActiveFilterCount() > 0
                    ? "No tickets match your current filters."
                    : "Get started by creating your first ticket."}
                </p>
                {getActiveFilterCount() > 0 ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                ) : (
                  <Button onClick={() => router.push("/ticket/new")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Ticket
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Tickets List */}
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-blue-200",
                      ticket.unread && "bg-blue-50/30 border-blue-200",
                    )}
                    onClick={() => handleTicketClick(ticket.id)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 space-y-3">
                          {/* Header */}
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-mono text-muted-foreground">#{ticket.id}</span>
                              {ticket.unread && <div className="w-2 h-2 bg-blue-500 rounded-full" title="Unread" />}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge
                                className="text-xs font-medium border-0"
                                style={{
                                  backgroundColor: getStatusColor(ticket.currentStatusId),
                                  color: getContrastColor(getStatusColor(ticket.currentStatusId)),
                                }}
                              >
                                {getStatusName(ticket.currentStatusId)}
                              </Badge>
                              <Badge
                                className="text-xs font-medium border-0"
                                style={{
                                  backgroundColor: getPriorityColor(ticket.currentPriorityId),
                                  color: getContrastColor(getPriorityColor(ticket.currentPriorityId)),
                                }}
                              >
                                {getPriorityName(ticket.currentPriorityId)}
                              </Badge>
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">{ticket.title}</h3>

                          {/* Body Preview */}
                          <p className="text-sm text-gray-600 line-clamp-2">{ticket.body}</p>

                          {/* Meta Information */}
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-1">
                                <User className="h-4 w-4" />
                                <span>Created by {ticket.createdBy.name}</span>
                              </div>
                              {ticket.currentAssignedTo && (
                                <div className="flex items-center space-x-1">
                                  <User className="h-4 w-4" />
                                  <span>Assigned to {ticket.currentAssignedTo.name}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-1">
                                <Clock className="h-4 w-4" />
                                <span>{formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2 ml-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
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
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-6">
                  <div className="text-sm text-muted-foreground">
                    Showing {pagination.startIndex} to {pagination.endIndex} of {pagination.totalItems} tickets
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const page = i + 1
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        )
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                      disabled={currentPage === pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
