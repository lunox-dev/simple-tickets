"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  Loader2,
  User,
  Flag,
  CheckCircle,
  AlertCircle,
  FolderTree,
  UserPlus,
  Calendar,
  X,
  Settings,
} from "lucide-react"
import { format } from "date-fns"

interface TicketData {
  id: number
  title: string
  currentStatus: { id: number; name: string; color: string }
  currentPriority: { id: number; name: string; color: string }
  currentCategory: { id: number; name: string; fullPath?: string }
  currentAssignedTo: { entityId: number; name: string } | null
  createdBy: { entityId: number; name: string }
  createdAt: string
  updatedAt: string
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
  childDropdownLabel: string | null
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

interface SidebarProps {
  ticket: TicketData
  userPermissions: string[]
  onTicketUpdate: () => void
  onClose?: () => void
}

export default function TicketSidebar({ ticket, userPermissions, onTicketUpdate, onClose }: SidebarProps) {
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [flatCategories, setFlatCategories] = useState<FlatCategory[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [flatEntities, setFlatEntities] = useState<FlatEntity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Helper function to get contrasting text color
  const getContrastColor = (hexColor: string) => {
    // Remove # if present
    const color = hexColor.replace("#", "")

    // Convert to RGB
    const r = Number.parseInt(color.substr(0, 2), 16)
    const g = Number.parseInt(color.substr(2, 2), 16)
    const b = Number.parseInt(color.substr(4, 2), 16)

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

    // Return black for light colors, white for dark colors
    return luminance > 0.5 ? "#000000" : "#ffffff"
  }

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
      } finally {
        setIsLoading(false)
      }
    }
    fetchReferenceData()
  }, [])

  const canChangeStatus = (toStatusId?: number): boolean => {
    const currentStatusId = ticket.currentStatus.id

    return userPermissions.some((permission) => {
      if (!permission.startsWith("ticket:action:change:status:")) return false

      const parts = permission.split(":")
      if (parts.length < 10) return false

      const fromStatus = parts[5]
      const toStatus = parts[7]
      const scope = parts[9]

      if (fromStatus !== "any" && Number.parseInt(fromStatus) !== currentStatusId) return false
      if (toStatusId && toStatus !== "any" && Number.parseInt(toStatus) !== toStatusId) return false

      return scope === "any" || scope === "team" || scope === "self"
    })
  }

  const canChangePriority = (toPriorityId?: number): boolean => {
    const currentPriorityId = ticket.currentPriority.id

    return userPermissions.some((permission) => {
      if (!permission.startsWith("ticket:action:change:priority:")) return false

      const parts = permission.split(":")
      if (parts.length < 10) return false

      const fromPriority = parts[5]
      const toPriority = parts[7]
      const scope = parts[9]

      if (fromPriority !== "any" && Number.parseInt(fromPriority) !== currentPriorityId) return false
      if (toPriorityId && toPriority !== "any" && Number.parseInt(toPriority) !== toPriorityId) return false

      return scope === "any" || scope === "team" || scope === "self"
    })
  }

  const canChangeCategory = (toCategoryId?: number): boolean => {
    const currentCategoryId = ticket.currentCategory.id

    return userPermissions.some((permission) => {
      if (!permission.startsWith("ticket:action:change:category:")) return false

      const parts = permission.split(":")
      if (parts.length < 10) return false

      const fromCategory = parts[5]
      const toCategory = parts[7]
      const scope = parts[9]

      if (fromCategory !== "any" && Number.parseInt(fromCategory) !== currentCategoryId) return false
      if (toCategoryId && toCategory !== "any" && Number.parseInt(toCategory) !== toCategoryId) return false

      return scope === "any" || scope === "team" || scope === "self"
    })
  }

  const canChangeAssignment = (): boolean => {
    return userPermissions.some((permission) => {
      if (!permission.startsWith("ticket:action:change:assigned:")) return false
      const parts = permission.split(":")
      if (parts.length < 5) return false
      const scope = parts[4]
      return scope === "any" || scope === "team" || scope === "team:unclaimed" || scope === "self"
    })
  }

  const canClaimTicket = (): boolean => {
    if (!ticket.currentAssignedTo) return false

    return userPermissions.some((permission) => {
      if (!permission.startsWith("ticket:action:claim:")) return false
      const parts = permission.split(":")
      if (parts.length < 4) return false
      const scope = parts[3]
      return scope === "any" || scope === "team" || scope === "team:unclaimed" || scope === "self"
    })
  }

  const handleStatusChange = async (statusId: string) => {
    setIsUpdating("status")
    setError(null)

    try {
      const response = await fetch("/api/ticket/change/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
          statusId: Number.parseInt(statusId, 10),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update status")
      }

      onTicketUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status")
    } finally {
      setIsUpdating(null)
    }
  }

  const handlePriorityChange = async (priorityId: string) => {
    setIsUpdating("priority")
    setError(null)

    try {
      const response = await fetch("/api/ticket/change/priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
          priorityId: Number.parseInt(priorityId, 10),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update priority")
      }

      onTicketUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update priority")
    } finally {
      setIsUpdating(null)
    }
  }

  const handleCategoryChange = async (categoryId: string) => {
    setIsUpdating("category")
    setError(null)

    try {
      const response = await fetch("/api/ticket/change/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
          categoryId: Number.parseInt(categoryId, 10),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update category")
      }

      onTicketUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category")
    } finally {
      setIsUpdating(null)
    }
  }

  const handleAssignmentChange = async (entityId: string) => {
    setIsUpdating("assignment")
    setError(null)

    try {
      const entity = flatEntities.find((e) => e.entityId === entityId)
      if (!entity) {
        throw new Error("Entity not found")
      }

      const payload: any = {
        ticketId: ticket.id,
        entityId: Number.parseInt(entity.entityId, 10),
      }

      const response = await fetch("/api/ticket/change/assigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update assignment")
      }

      onTicketUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update assignment")
    } finally {
      setIsUpdating(null)
    }
  }

  const handleClaimTicket = async () => {
    setIsUpdating("claim")
    setError(null)

    try {
      const response = await fetch("/api/ticket/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to claim ticket")
      }

      onTicketUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim ticket")
    } finally {
      setIsUpdating(null)
    }
  }

  if (isLoading) {
    return (
      <Card className="bg-white shadow-sm">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Ticket Details */}
      <Card className="bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Ticket Details
            </CardTitle>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Status</span>
            </div>
            {canChangeStatus() ? (
              <Select
                value={ticket.currentStatus.id.toString()}
                onValueChange={handleStatusChange}
                disabled={isUpdating === "status"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ticket.currentStatus.color }} />
                      <span>{ticket.currentStatus.name}</span>
                      {isUpdating === "status" && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statuses
                    .filter((s) => canChangeStatus(s.id))
                    .map((status) => (
                      <SelectItem key={status.id} value={status.id.toString()}>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                          <span>{status.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-md">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ticket.currentStatus.color }} />
                <span className="text-sm">{ticket.currentStatus.name}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Priority */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Flag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Priority</span>
            </div>
            {canChangePriority() ? (
              <Select
                value={ticket.currentPriority.id.toString()}
                onValueChange={handlePriorityChange}
                disabled={isUpdating === "priority"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ticket.currentPriority.color }} />
                      <span>{ticket.currentPriority.name}</span>
                      {isUpdating === "priority" && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {priorities
                    .filter((p) => canChangePriority(p.id))
                    .map((priority) => (
                      <SelectItem key={priority.id} value={priority.id.toString()}>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: priority.color }} />
                          <span>{priority.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-md">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ticket.currentPriority.color }} />
                <span className="text-sm">{ticket.currentPriority.name}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Assignment */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Assigned To</span>
            </div>

            {canChangeAssignment() ? (
              <Select
                value={ticket.currentAssignedTo?.entityId.toString() || ""}
                onValueChange={handleAssignmentChange}
                disabled={isUpdating === "assignment"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{ticket.currentAssignedTo?.name || "Unassigned"}</span>
                      {isUpdating === "assignment" && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-[350px] max-h-[200px]">
                  {flatEntities.map((entity) => (
                    <SelectItem key={entity.entityId} value={entity.entityId}>
                      <span className="block w-full">
                        {"\u00A0".repeat(entity.level * 4)}
                        {entity.name} ({entity.type})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-2 bg-gray-50 rounded-md">
                <span className="text-sm">{ticket.currentAssignedTo?.name || "Unassigned"}</span>
              </div>
            )}

            {/* Claim Button */}
            {canClaimTicket() && ticket.currentAssignedTo && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClaimTicket}
                disabled={isUpdating === "claim"}
                className="w-full bg-transparent"
              >
                {isUpdating === "claim" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Claim Ticket
              </Button>
            )}
          </div>

          <Separator />

          {/* Category */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <FolderTree className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Category</span>
            </div>
            {canChangeCategory() ? (
              <Select
                value={ticket.currentCategory.id.toString()}
                onValueChange={handleCategoryChange}
                disabled={isUpdating === "category"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm truncate">
                        {flatCategories.find((c) => c.id === ticket.currentCategory.id)?.fullPath ||
                          ticket.currentCategory.name}
                      </span>
                      {isUpdating === "category" && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-[350px] max-h-[300px]">
                  {flatCategories
                    .filter((c) => canChangeCategory(c.id))
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        <span className="block w-full">
                          {"\u00A0".repeat(category.level * 4)}
                          {category.name}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-2 bg-gray-50 rounded-md">
                <span className="text-sm">{ticket.currentCategory.name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ticket Info */}
      <Card className="bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{format(new Date(ticket.createdAt), "MMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span className="font-medium">{format(new Date(ticket.updatedAt), "MMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created by</span>
              <span className="font-medium">{ticket.createdBy.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ticket ID</span>
              <Badge variant="outline" className="font-mono">
                #{ticket.id}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
