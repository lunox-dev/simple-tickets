"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, User, Flag, CheckCircle, AlertCircle } from "lucide-react"

interface TicketData {
  id: number
  title: string
  currentStatus: { id: number; name: string }
  currentPriority: { id: number; name: string }
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

interface Entity {
  entityId: string
  type: "team" | "user"
  name: string
  children?: Entity[]
}

interface PropertiesPanelProps {
  ticket: TicketData
  userPermissions: string[]
  onTicketUpdate: () => void
}

export default function TicketPropertiesPanel({ ticket, userPermissions, onTicketUpdate }: PropertiesPanelProps) {
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasPermission = (permission: string): boolean => {
    return userPermissions.includes(permission)
  }

  const canChangeStatus = (): boolean => {
    // Check for specific status change permissions
    const currentStatusId = ticket.currentStatus.id

    // Check for any status change permissions
    const anyStatusPermissions = userPermissions.filter((p) =>
      p.startsWith("ticket:action:change:status:from:any:to:any:"),
    )

    if (anyStatusPermissions.length > 0) {
      // Check if user has permission based on assignment/creation context
      const hasAssignedAny = anyStatusPermissions.some((p) => p.endsWith(":assigned:any"))
      const hasCreatedByAny = anyStatusPermissions.some((p) => p.endsWith(":createdby:any"))
      const hasAssignedTeam = anyStatusPermissions.some((p) => p.endsWith(":assigned:team"))
      const hasCreatedByTeam = anyStatusPermissions.some((p) => p.endsWith(":createdby:team"))

      if (hasAssignedAny || hasCreatedByAny) return true
      if (hasAssignedTeam && ticket.currentAssignedTo) return true
      if (hasCreatedByTeam) return true
    }

    // Check for specific status ID permissions
    const specificPermissions = userPermissions.filter(
      (p) =>
        p.includes(`ticket:action:change:status:from:${currentStatusId}:`) ||
        p.includes(`ticket:action:change:status:from:any:to:`),
    )

    return specificPermissions.length > 0
  }

  const canChangePriority = (): boolean => {
    // Check for specific priority change permissions
    const currentPriorityId = ticket.currentPriority.id

    // Check for any priority change permissions
    const anyPriorityPermissions = userPermissions.filter((p) =>
      p.startsWith("ticket:action:change:priority:from:any:to:any:"),
    )

    if (anyPriorityPermissions.length > 0) {
      const hasAssignedAny = anyPriorityPermissions.some((p) => p.endsWith(":assigned:any"))
      const hasCreatedByAny = anyPriorityPermissions.some((p) => p.endsWith(":createdby:any"))
      const hasAssignedTeam = anyPriorityPermissions.some((p) => p.endsWith(":assigned:team"))
      const hasCreatedByTeam = anyPriorityPermissions.some((p) => p.endsWith(":createdby:team"))

      if (hasAssignedAny || hasCreatedByAny) return true
      if (hasAssignedTeam && ticket.currentAssignedTo) return true
      if (hasCreatedByTeam) return true
    }

    return false
  }

  const canChangeAssignment = (): boolean => {
    // Check for assignment change permissions
    const assignmentPermissions = userPermissions.filter((p) => p.startsWith("ticket:action:change:assigned:"))

    return assignmentPermissions.some((p) => p.endsWith(":any") || p.endsWith(":team") || p.endsWith(":self"))
  }

  const canCreateThread = (): boolean => {
    // Check for thread creation permissions
    const threadPermissions = userPermissions.filter((p) => p.startsWith("ticket:action:thread:create:"))

    return threadPermissions.some((p) => p.endsWith(":any") || p.endsWith(":team") || p.endsWith(":self"))
  }

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
      } finally {
        setIsLoading(false)
      }
    }
    fetchReferenceData()
  }, [])

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
      }

      if (entity.type === "team") {
        payload.teamId = Number.parseInt(entity.entityId, 10)
      } else {
        payload.userTeamId = Number.parseInt(entity.entityId, 10)
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Properties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="space-y-2">
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
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">{ticket.currentStatus.name}</Badge>
                      {isUpdating === "status" && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
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
            ) : (
              <Badge variant="secondary">{ticket.currentStatus.name}</Badge>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-2">
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
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">{ticket.currentPriority.name}</Badge>
                      {isUpdating === "priority" && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
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
            ) : (
              <Badge variant="secondary">{ticket.currentPriority.name}</Badge>
            )}
          </div>

          {/* Assignment */}
          <div className="space-y-2">
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
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{ticket.currentAssignedTo?.name || "Unassigned"}</Badge>
                      {isUpdating === "assignment" && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {flatEntities.map((entity) => (
                    <SelectItem key={entity.entityId} value={entity.entityId}>
                      <div className="flex items-center space-x-2">
                        <User className="h-3 w-3" />
                        <span>
                          {entity.name} ({entity.type})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline">{ticket.currentAssignedTo?.name || "Unassigned"}</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
