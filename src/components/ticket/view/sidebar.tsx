"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  ChevronsUpDown,
  Check,
  Users,
  Pencil,
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { ApiSelect } from "@/components/ticket/new/api-select"
import { Input } from "@/components/ui/input"

interface TicketEntity {
  entityId: number
  name: string
  type: 'team' | 'user' | 'unknown'
  teamId: number | null
  userTeamId: number | null
}

interface TicketData {
  id: number
  title: string
  currentStatus: { id: number; name: string; color: string }
  currentPriority: { id: number; name: string; color: string }
  currentCategory: { id: number; name: string; fullPath?: string }
  currentAssignedTo: TicketEntity | null
  createdBy: TicketEntity
  createdAt: string
  updatedAt: string
  customFields?: {
    id: number
    label: string
    type: string
    multiSelect: boolean
    key: string | null
    value: string
    group: { id: number; name: string } | null
    apiConfig?: any
  }[]
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


interface ResolvedItem {
  value: string
  label: string
  metadata?: {
    image?: string
    description?: string
  }
}
interface AllowedActions {
  allowedStatuses: number[]
  allowedPriorities: number[]
  allowedCategories: number[]
  allowedAssignees: string[]
  claimType: 'CLAIM' | 'FORCE_CLAIM' | null
  canUpdateCustomFields: boolean
  canUpdateFreshCustomFields: boolean
}

interface SidebarProps {
  ticket: TicketData
  user: any
  meta: any
  allowedActions: AllowedActions
  onTicketUpdate: () => void
  onClose?: () => void
}


function TicketFieldDisplay({ field, allFields, ticketId, canEdit, onUpdate }: {
  field: NonNullable<TicketData['customFields']>[0],
  allFields: NonNullable<TicketData['customFields']>,
  ticketId: number,
  canEdit: boolean,
  onUpdate: () => void
}) {
  console.log(`Field ${field.id} (${field.label}) canEdit:`, canEdit, 'Value:', field.value)
  const [resolvedItems, setResolvedItems] = useState<ResolvedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [fallback, setFallback] = useState<string | null>(null)
  const lastValidContext = useRef<Record<string, string> | null>(null)
  const lastSuccessfulValue = useRef<string | null>(null)

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState<string>(field.value || "")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    // Reset edit value when field changes
    setEditValue(field.value || "")
    setIsEditing(false)
  }, [field.value])

  // Resolve Value Effect (View Mode)
  useEffect(() => {
    if (!field.value || isEditing) { // Don't resolve if empty or editing (unless we want to show current resolved)
      if (!field.value) setFallback("-")
      return
    }

    let parsedValue: string | string[] = field.value
    if (field.multiSelect) {
      try {
        parsedValue = JSON.parse(field.value)
      } catch { }
    }

    const currentRawValue = Array.isArray(parsedValue) ? parsedValue.join(",") : String(parsedValue)

    if (field.type === 'API_SELECT') {
      // Check for dependencies
      let dependencyValue: string | undefined
      const config = field.apiConfig as any
      if (config && config.dependsOnFieldKey && allFields) {
        const parentField = allFields.find(f => f.key === config.dependsOnFieldKey)
        if (parentField && parentField.value) {
          dependencyValue = parentField.value
        }
      }

      setLoading(true)
      fetch('/api/ticket/field/resolve-value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldDefinitionId: field.id,
          value: parsedValue,
          dependencyValue
        })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            setResolvedItems(data.items)

            // Store successful value and context
            lastSuccessfulValue.current = currentRawValue

            const newContext: Record<string, string> = {}
            if (config.dependsOnFieldKey && dependencyValue) {
              newContext[config.dependsOnFieldKey] = dependencyValue
            }
            if (field.key) {
              newContext[field.key] = currentRawValue
            }
            lastValidContext.current = newContext

          } else if (data.labels) {
            setResolvedItems(data.labels.map((l: string) => ({ label: l, value: '' })))
          } else {
            // If items are empty, check if we have a stale valid value
            if (lastSuccessfulValue.current === currentRawValue && resolvedItems.length > 0) {
              // Keep the existing resolved items and context!
              // This handles the case where Org changes (making fetch return empty for this service ID)
              // but we want to show the OLD service name until the user explicitly changes it.
              // console.log("Preserving stale resolved value for:", currentRawValue)
            } else {
              setResolvedItems([])
              const raw = Array.isArray(parsedValue) ? parsedValue.join(", ") : String(parsedValue)
              setFallback(raw)
            }
          }
        })
        .catch(() => {
          // On error, also try to preserve if value matches?
          if (lastSuccessfulValue.current === currentRawValue && resolvedItems.length > 0) {
            // Keep existing
          } else {
            const raw = Array.isArray(parsedValue) ? parsedValue.join(", ") : String(parsedValue)
            setFallback(raw)
          }
        })
        .finally(() => setLoading(false))
    } else {
      const raw = Array.isArray(parsedValue) ? parsedValue.join(", ") : String(parsedValue)
      setFallback(raw)
    }
  }, [field, allFields, isEditing])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // If value is array (multi), serialize it? ApiSelect returns array/string.
      // The backend expects 'value' as string (if simple) or serialized JSON?
      // Existing values are stored as strings. API_SELECT multiselect stores JSON string?
      // Let's assume ApiSelect returns what we need, but we need to stringify if multiselect.

      let payloadValue = editValue
      if (Array.isArray(editValue) || (typeof editValue === 'object' && editValue !== null)) {
        payloadValue = JSON.stringify(editValue)
      }

      const res = await fetch('/api/ticket/change/field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          fieldDefinitionId: field.id,
          value: payloadValue,
          context: lastValidContext.current
        })
      })

      if (!res.ok) throw new Error('Failed to update')

      setIsEditing(false)
      onUpdate()
    } catch (err) {
      console.error(err)
      alert('Failed to save value')
    } finally {
      setIsSaving(false)
    }
  }

  // Determine dependency params for Edit Mode
  const dependencyInfo = useMemo(() => {
    if (field.type !== 'API_SELECT') return {}
    const config = field.apiConfig as any
    if (config && config.dependsOnFieldKey) {
      const parentField = allFields.find(f => f.key === config.dependsOnFieldKey)
      return {
        dependencyParam: config.dependencyParam || 'id', // Default or from config? resolve-value inferred it. ApiSelect usually needs it passed.
        // Actually ApiSelect fetches fetch-options which handles dependency?
        // fetch-options needs dependencyParam and dependencyValue.
        // We need to pass them to ApiSelect prop.
        dependencyValue: parentField?.value
      }
    }
    return {}
  }, [field, allFields])

  // Clear edit value if dependency changes - REMOVED: Backend handles clearing.
  // useEffect(() => {
  //   if (dependencyInfo.dependencyValue && isEditing) {
  //     setEditValue("")
  //   }
  // }, [dependencyInfo.dependencyValue])


  if (isEditing) {
    return (
      <div className="flex flex-col gap-2">
        {field.type === 'API_SELECT' ? (
          <ApiSelect
            fieldId={field.id}
            value={editValue}
            onChange={(val) => setEditValue(val as string)}
            multiSelect={field.multiSelect}
            dependencyParam={dependencyInfo.dependencyParam}
            dependencyValue={dependencyInfo.dependencyValue}
            key={dependencyInfo.dependencyValue} // Reset if dependency changes
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 text-sm"
          />
        )}
        <div className="flex items-center gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving} className="h-6 w-6 p-0">
            <X className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="default" onClick={handleSave} disabled={isSaving} className="h-6 w-6 p-0">
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </Button>
        </div>
      </div>
    )
  }

  if (loading) return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />

  // View Mode with Edit Button
  return (
    <div className="group flex items-center justify-between w-full">
      <div className="flex-1 min-w-0">
        {resolvedItems.length > 0 ? (
          <div className="flex flex-col gap-2">
            {resolvedItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                {item.metadata?.image && (
                  <img src={item.metadata.image} alt="" className="w-5 h-5 rounded object-cover border bg-muted" />
                )}
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.metadata?.description && (
                    <span className="text-[10px] text-muted-foreground">{item.metadata.description}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-sm font-medium text-foreground break-words">{fallback}</span>
        )}
      </div>

      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </Button>
      )}
    </div>
  )
}

export default function TicketSidebar({ ticket, user, meta, allowedActions, onTicketUpdate, onClose }: SidebarProps) {
  console.log('TicketSidebar allowedActions:', allowedActions)
  // Derive state from props
  const priorities = meta.priorities
  const statuses = meta.statuses
  // Categories from tree
  // Ideally we type cast meta.categoryTree
  const categories = meta.categoryTree as Category[]
  const entities = meta.entities

  const [isLoading, setIsLoading] = useState(false) // No longer loading initial data
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState("")

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

  const flatCategories = useMemo(() => flattenCategories(categories), [categories])
  const flatEntities = useMemo(() => flattenEntities(entities), [entities])

  const canChangeStatus = (toStatusId?: number): boolean => {
    if (toStatusId) {
      return allowedActions.allowedStatuses.includes(toStatusId)
    }
    return allowedActions.allowedStatuses.length > 0
  }

  const canChangePriority = (toPriorityId?: number): boolean => {
    if (toPriorityId) {
      return allowedActions.allowedPriorities.includes(toPriorityId)
    }
    return allowedActions.allowedPriorities.length > 0
  }

  const canChangeCategory = (toCategoryId?: number): boolean => {
    if (toCategoryId) {
      return allowedActions.allowedCategories.includes(toCategoryId)
    }
    return allowedActions.allowedCategories.length > 0
  }

  const canChangeAssignment = (): boolean => {
    // If there are allowed assignees, we can assign (assuming we can assign to those specific ones)
    return allowedActions.allowedAssignees.length > 0
  }

  const canClaimTicket = (): boolean => {
    return !!allowedActions.claimType
  }

  const getClaimLabel = () => {
    if (allowedActions.claimType === 'FORCE_CLAIM') return 'Force Claim'
    return 'Claim Ticket'
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

  const filteredEntities = useMemo(() => {
    if (!assignSearch) return flatEntities
    return flatEntities.filter(
      (entity) =>
        entity.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
        entity.fullPath.toLowerCase().includes(assignSearch.toLowerCase()),
    )
  }, [flatEntities, assignSearch])

  const getEntityInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
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
      <Card className="bg-card shadow-sm">
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

      {/* Ticket Details */}
      <Card className="bg-card shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border bg-muted/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center">
              <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
              Properties
            </CardTitle>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
              {isUpdating === "status" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {canChangeStatus() ? (
              <Select
                value={ticket.currentStatus.id.toString()}
                onValueChange={handleStatusChange}
                disabled={isUpdating === "status"}
              >
                <SelectTrigger className="w-full h-10 bg-muted/10 border-border hover:bg-card hover:border-border transition-colors focus:ring-1 focus:ring-ring">
                  <SelectValue>
                    <div className="flex items-center space-x-2.5">
                      <div className="w-2.5 h-2.5 rounded-full ring-2 ring-transparent transition-all" style={{ backgroundColor: ticket.currentStatus.color }} />
                      <span className="font-medium text-foreground">{ticket.currentStatus.name}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statuses
                    .filter((s: any) => canChangeStatus(s.id))
                    .map((status: any) => (
                      <SelectItem key={status.id} value={status.id.toString()}>
                        <div className="flex items-center space-x-2.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                          <span>{status.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center space-x-2.5 p-2.5 bg-muted/10 rounded-md border border-border">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ticket.currentStatus.color }} />
                <span className="text-sm font-medium text-foreground">{ticket.currentStatus.name}</span>
              </div>
            )}
          </div>

          <Separator className="bg-border" />

          {/* Priority */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priority</label>
              {isUpdating === "priority" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {canChangePriority() ? (
              <Select
                value={ticket.currentPriority.id.toString()}
                onValueChange={handlePriorityChange}
                disabled={isUpdating === "priority"}
              >
                <SelectTrigger className="w-full h-10 bg-muted/10 border-border hover:bg-card hover:border-border transition-colors focus:ring-1 focus:ring-ring">
                  <SelectValue>
                    <div className="flex items-center space-x-2.5">
                      <div className="w-2.5 h-2.5 rounded-full ring-2 ring-transparent" style={{ backgroundColor: ticket.currentPriority.color }} />
                      <span className="font-medium text-foreground">{ticket.currentPriority.name}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {priorities
                    .filter((p: any) => canChangePriority(p.id))
                    .map((priority: any) => (
                      <SelectItem key={priority.id} value={priority.id.toString()}>
                        <div className="flex items-center space-x-2.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: priority.color }} />
                          <span>{priority.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center space-x-2.5 p-2.5 bg-muted/10 rounded-md border border-border">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ticket.currentPriority.color }} />
                <span className="text-sm font-medium text-foreground">{ticket.currentPriority.name}</span>
              </div>
            )}
          </div>

          <Separator className="bg-border" />

          {/* Assignment */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assigned To</label>
              {isUpdating === "assignment" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>

            {canChangeAssignment() ? (
              <Popover open={assignOpen} onOpenChange={setAssignOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={assignOpen}
                    className="w-full justify-between h-10 bg-muted/10 border-border hover:bg-card hover:border-border transition-all focus:ring-1 focus:ring-ring px-3"
                    disabled={isUpdating === "assignment"}
                  >
                    {ticket.currentAssignedTo?.entityId ? (
                      <div className="flex items-center gap-2.5 truncate w-full">
                        <Avatar className="h-5 w-5 border border-border">
                          <AvatarFallback className="text-[10px] bg-muted text-muted-foreground font-medium">
                            {getEntityInitials(
                              flatEntities.find((e) => e.entityId === ticket.currentAssignedTo?.entityId.toString())?.name ||
                              "",
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate font-medium text-foreground text-sm">
                          {
                            flatEntities.find((e) => e.entityId === ticket.currentAssignedTo?.entityId.toString())
                              ?.name || "Unknown"
                          }
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground font-normal">Select team or user...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start" sideOffset={8}>
                  <Command shouldFilter={false} className="border-0">
                    <div className="p-2 border-b border-border">
                      <CommandInput
                        placeholder="Search..."
                        value={assignSearch}
                        onValueChange={setAssignSearch}
                        className="h-9"
                      />
                    </div>
                    <CommandList className="max-h-[300px] p-1">
                      <CommandEmpty className="py-6 text-center text-sm text-gray-500">No teams or users found.</CommandEmpty>
                      <CommandGroup>
                        {filteredEntities.map((entity, idx) => (
                          <CommandItem
                            key={entity.entityId}
                            value={entity.entityId}
                            onSelect={(currentValue) => {
                              handleAssignmentChange(currentValue)
                              setAssignOpen(false)
                              setAssignSearch("")
                            }}
                            className={cn(
                              "cursor-pointer rounded-md aria-selected:bg-muted aria-selected:text-foreground my-0.5",
                              entity.type === "team" ? "font-semibold text-foreground" : "font-normal text-muted-foreground"
                            )}
                          >
                            <div className="flex items-center gap-3 w-full py-0.5">
                              <Avatar className="h-6 w-6 border border-border">
                                <AvatarFallback className="text-[10px] bg-card">{getEntityInitials(entity.name)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate">
                                    {entity.name}
                                  </span>
                                  <Badge variant={entity.type === "team" ? "secondary" : "outline"} className="text-[10px] h-4 px-1 rounded-sm border-border text-muted-foreground font-normal ml-auto">
                                    {entity.type === "team" ? "Team" : "User"}
                                  </Badge>
                                </div>
                                {entity.level > 0 && (
                                  <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{entity.fullPath}</p>
                                )}
                              </div>
                              {ticket.currentAssignedTo?.entityId.toString() === entity.entityId && (
                                <Check className="h-3 w-3 text-primary" />
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            ) : (
              <div className="p-2.5 bg-muted/10 rounded-md border border-border flex items-center gap-2">
                <Avatar className="h-5 w-5 border border-border">
                  <AvatarFallback className="text-[10px] bg-card text-muted-foreground">
                    <User className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground">{ticket.currentAssignedTo?.name || "Unassigned"}</span>
              </div>
            )}



            {/* Claim Button */}
            {allowedActions.claimType && ticket.currentAssignedTo && (
              <Button
                variant={allowedActions.claimType === 'FORCE_CLAIM' ? "destructive" : "secondary"}
                size="sm"
                onClick={handleClaimTicket}
                disabled={isUpdating === "claim"}
                className="w-full mt-2"
              >
                {isUpdating === "claim" ? (
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-3 w-3 mr-2" />
                )}
                {getClaimLabel()}
              </Button>
            )}
          </div>

          <Separator className="bg-border" />

          {/* Category */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</label>
              {isUpdating === "category" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {canChangeCategory() ? (
              <Select
                value={ticket.currentCategory.id.toString()}
                onValueChange={handleCategoryChange}
                disabled={isUpdating === "category"}
              >
                <SelectTrigger className="w-full h-10 bg-muted/10 border-border hover:bg-card hover:border-border transition-colors focus:ring-1 focus:ring-ring">
                  <SelectValue>
                    <div className="flex items-center space-x-2.5">
                      <FolderTree className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground truncate">
                        {flatCategories.find((c) => c.id === ticket.currentCategory.id)?.name ||
                          ticket.currentCategory.name}
                      </span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-[350px] max-h-[300px]">
                  {flatCategories
                    .filter((c) => canChangeCategory(c.id))
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        <span className="flex items-center">
                          {category.level > 0 && (
                            <span className="mr-2 text-muted-foreground/40">
                              {"\u00A0\u00A0".repeat(category.level)}↳
                            </span>
                          )}
                          {category.name}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-2.5 bg-muted/10 rounded-md border border-border flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{ticket.currentCategory.name}</span>
              </div>
            )}
          </div>

          {(ticket.customFields && ticket.customFields.length > 0) && (
            <>
              <Separator className="bg-border" />

              {Object.entries(
                (ticket.customFields || []).reduce((acc, field) => {
                  const groupName = field.group?.name || "Additional Information"
                  if (!acc[groupName]) acc[groupName] = []
                  acc[groupName].push(field)
                  return acc
                }, {} as Record<string, NonNullable<TicketData['customFields']>>)
              ).sort((a, b) => {
                if (a[0] === "Additional Information") return 1
                if (b[0] === "Additional Information") return -1
                return a[0].localeCompare(b[0])
              }).map(([groupName, fields]) => (
                <div key={groupName} className="space-y-3">
                  {groupName !== "Additional Information" && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="h-px bg-border flex-1" />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{groupName}</span>
                      <div className="h-px bg-border flex-1" />
                    </div>
                  )}
                  {fields.map(field => (
                    <div key={field.id} className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{field.label}</label>
                      <div className="p-2.5 bg-muted/10 rounded-md border border-border min-h-[36px] flex items-center">
                        <TicketFieldDisplay
                          field={field}
                          allFields={ticket.customFields || []}
                          ticketId={ticket.id}
                          canEdit={
                            !!field.value
                              ? allowedActions.canUpdateCustomFields
                              : allowedActions.canUpdateFreshCustomFields
                          }
                          onUpdate={onTicketUpdate}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

        </CardContent>
      </Card>

      {/* Ticket Info */}
      <Card className="bg-card shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border bg-muted/10">
          <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            Meta Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Created On</span>
              <span className="font-medium text-foreground">{format(new Date(ticket.createdAt), "MMM d, yyyy")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Last Updated</span>
              <span className="font-medium text-foreground">{format(new Date(ticket.updatedAt), "MMM d, yyyy")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Created By</span>
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5 border border-border">
                  <AvatarFallback className="text-[9px] bg-muted/50 text-muted-foreground">{getEntityInitials(ticket.createdBy.name)}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{ticket.createdBy.name}</span>
              </div>
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Internal ID</span>
              <span className="font-mono text-xs text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded border border-border/50">
                #{ticket.id}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div >
  )
}
