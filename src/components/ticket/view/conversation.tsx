"use client"

import { useState, useEffect } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  MessageSquare,
  UserCheck,
  Flag,
  CheckCircle,
  FolderTree,
  Download,
  ExternalLink,
  ArrowRight,
  Clock,
  Pencil,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { SimpleRichTextEditor } from "@/components/ui/SimpleRichTextEditor"
import { cn } from "@/lib/utils"

interface ActivityLogEntry {
  type: "THREAD" | "ASSIGN_CHANGE" | "PRIORITY_CHANGE" | "STATUS_CHANGE" | "CATEGORY_CHANGE" | "CUSTOM_FIELD_CHANGE"
  id: number
  at: string
  read: boolean
  [key: string]: any
}

interface ConversationProps {
  activities: ActivityLogEntry[]
  lastReadEvent: { type: string; id: number } | null
  ticketId: number
  ticket?: any
}

interface ResolvedValueProps {
  value: string
  fieldDefinitionId: number
  fieldType: string
  context?: Record<string, any>
}

function ResolvedValueDisplay({ value, fieldDefinitionId, fieldType, context }: ResolvedValueProps) {
  const [resolved, setResolved] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!value || (fieldType !== 'API_SELECT' && fieldType !== 'API_COMBINE')) return

    let cancelled = false
    setLoading(true)

    fetch('/api/ticket/field/resolve-value', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldDefinitionId, value, context })
    })
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          if (data.items && data.items.length > 0) {
            setResolved(data.items[0].label)
          } else if (data.label) {
            setResolved(data.label)
          } else if (data.labels && data.labels.length > 0) {
            setResolved(data.labels[0])
          }
        }
      })
      .catch(err => console.error('Failed to resolve value', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [value, fieldDefinitionId, fieldType, context])

  if (!value) return <span className="text-muted-foreground italic">(empty)</span>

  if (fieldType !== 'API_SELECT' && fieldType !== 'API_COMBINE') {
    return <span>{value}</span>
  }

  if (loading) return <span className="animate-pulse">...</span>

  return <span>{resolved || value}</span>
}

export default function TicketConversation({ activities, lastReadEvent, ticketId, ticket }: ConversationProps) {
  // Create context from ticket custom fields
  const context = ticket?.customFields?.reduce((acc: any, field: any) => {
    if (field.key) acc[field.key] = field.value
    return acc
  }, {}) || {}



  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const isLastRead = (entry: ActivityLogEntry) => {
    return lastReadEvent && lastReadEvent.type === entry.type && lastReadEvent.id === entry.id
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "THREAD":
        return <MessageSquare className="h-4 w-4" />
      case "ASSIGN_CHANGE":
        return <UserCheck className="h-4 w-4" />
      case "PRIORITY_CHANGE":
        return <Flag className="h-4 w-4" />
      case "STATUS_CHANGE":
        return <CheckCircle className="h-4 w-4" />
      case "CATEGORY_CHANGE":
        return <FolderTree className="h-4 w-4" />
      case "CUSTOM_FIELD_CHANGE":
        return <Pencil className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const renderThreadMessage = (entry: ActivityLogEntry, isFirst: boolean = false) => {
    if (isFirst) {
      return (
        <div className="mb-8 px-1">
          <div className="flex items-center space-x-3 mb-4">
            <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
              <AvatarFallback className={cn("text-sm font-semibold", entry.createdBy?.name ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                {getInitials(entry.createdBy?.name || "U")}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-foreground">{entry.createdBy?.name}</span>
                <Badge variant="outline" className="text-xs border-border text-muted-foreground font-normal">
                  Author
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                reported {formatDistanceToNow(new Date(entry.at), { addSuffix: true })}
              </div>
            </div>
          </div>

          <div className="prose prose-base max-w-none text-foreground leading-relaxed pl-14">
            <SimpleRichTextEditor
              value={entry.body || ""}
              onChange={() => { }}
              editable={false}
              className="border-none bg-transparent p-0"
            />
          </div>

          {/* Attachments for first message */}
          {entry.attachments && entry.attachments.length > 0 && (
            <div className="mt-6 pl-14">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center">
                <Download className="h-3 w-3 mr-2" />
                Attachments ({entry.attachments.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {entry.attachments.map((attachment: any, index: number) => (
                  <div key={index} className="flex items-center space-x-3 p-2.5 bg-card hover:bg-muted/50 rounded-lg border border-border transition-colors group shadow-sm">
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                      <Download className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{attachment.fileName}</p>
                      {attachment.fileSize && (
                        <p className="text-xs text-muted-foreground">{(attachment.fileSize / 1024).toFixed(2)} KB</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild>
                      <a href={attachment.filePath} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-2 text-xs text-muted-foreground uppercase tracking-widest">Activity & Comments</span>
            </div>
          </div>
        </div>
      )
    }

    return (
      <Card
        className={`bg-card shadow-sm border-0 ring-1 ring-border transition-all duration-200 ${!entry.read ? "bg-primary/5 ring-primary/20" : ""
          } ${isLastRead(entry) ? "ring-green-500/50 ring-2" : ""}`}
      >
        <CardContent className="p-6">
          {/* Message Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center space-x-4">
              <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                <AvatarFallback className={cn("text-sm font-semibold", entry.createdBy?.name ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  {getInitials(entry.createdBy?.name || "U")}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-foreground">{entry.createdBy?.name}</span>
                  {!entry.read && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary font-medium">
                      New
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-0.5">
                  <time dateTime={entry.at} className="font-medium">{format(new Date(entry.at), "MMM d, yyyy 'at' h:mm a")}</time>
                  <span>•</span>
                  <span>{formatDistanceToNow(new Date(entry.at), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Message Content */}
          <div className="prose prose-sm max-w-none text-foreground mb-5 leading-relaxed">
            <SimpleRichTextEditor
              value={entry.body || ""}
              onChange={() => { }}
              editable={false}
              className="border-none bg-transparent p-0"
            />
          </div>

          {/* Attachments */}
          {entry.attachments && entry.attachments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center">
                <Download className="h-3 w-3 mr-2" />
                Attachments ({entry.attachments.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {entry.attachments.map((attachment: any, index: number) => (
                  <div key={index} className="flex items-center space-x-3 p-2.5 bg-muted/30 hover:bg-muted/50 rounded-lg border border-border transition-colors group">
                    <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                      <Download className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{attachment.fileName}</p>
                      {attachment.fileSize && (
                        <p className="text-xs text-muted-foreground">{(attachment.fileSize / 1024).toFixed(2)} KB</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild>
                      <a href={attachment.filePath} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last read indicator */}
          {isLastRead(entry) && (
            <div className="mt-4 -mb-2 flex justify-center">
              <div className="bg-green-500/10 text-green-600 dark:text-green-400 text-xs px-3 py-1 rounded-full border border-green-500/20 shadow-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Last read
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderSystemActivity = (entry: ActivityLogEntry) => {
    let activityText = ""
    let fromValue: import('react').ReactNode = ""
    let toValue: import('react').ReactNode = ""
    let icon = <Clock className="h-3 w-3" />
    let iconColor = "text-muted-foreground"
    let iconBg = "bg-muted"

    switch (entry.type) {
      case "ASSIGN_CHANGE":
        activityText = "assigned to"
        fromValue = entry.from?.name || "Unassigned"
        toValue = entry.to?.name || "Unassigned"
        icon = <UserCheck className="h-3 w-3" />
        iconColor = "text-violet-500 dark:text-violet-400"
        iconBg = "bg-violet-100 dark:bg-violet-900/30"
        break
      case "PRIORITY_CHANGE":
        activityText = "changed priority"
        fromValue = entry.from?.name || "None"
        toValue = entry.to?.name || "None"
        icon = <Flag className="h-3 w-3" />
        iconColor = "text-orange-500 dark:text-orange-400"
        iconBg = "bg-orange-100 dark:bg-orange-900/30"
        break
      case "STATUS_CHANGE":
        activityText = "changed status"
        fromValue = entry.from?.name || "None"
        toValue = entry.to?.name || "None"
        icon = <CheckCircle className="h-3 w-3" />
        iconColor = "text-green-500 dark:text-green-400"
        iconBg = "bg-green-100 dark:bg-green-900/30"
        break
      case "CATEGORY_CHANGE":
        activityText = "moved to"
        fromValue = entry.from?.name || "None"
        toValue = entry.to?.name || "None"
        icon = <FolderTree className="h-3 w-3" />
        iconColor = "text-blue-500 dark:text-blue-400"
        iconBg = "bg-blue-100 dark:bg-blue-900/30"
        break
      case "CUSTOM_FIELD_CHANGE":
        activityText = `updated ${entry.fieldLabel || "field"}`
        fromValue = <ResolvedValueDisplay value={entry.from} fieldDefinitionId={entry.fieldDefinitionId} fieldType={entry.fieldType} context={entry.context || context} />
        toValue = <ResolvedValueDisplay value={entry.to} fieldDefinitionId={entry.fieldDefinitionId} fieldType={entry.fieldType} context={entry.context || context} />
        icon = <Pencil className="h-3 w-3" />
        iconColor = "text-indigo-500 dark:text-indigo-400"
        iconBg = "bg-indigo-100 dark:bg-indigo-900/30"
        break
      default:
        icon = getActivityIcon(entry.type)
        iconColor = "text-muted-foreground"
        iconBg = "bg-muted"
        fromValue = ""
        toValue = ""
    }

    return (
      <div className="relative pl-8 h-full py-2">
        {/* Timeline line - purely decorative (optional, maybe distracting if not continuous. Let's start with just clean row) */}

        <div className="flex items-center space-x-3 text-sm group">
          <div className={cn("h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors", iconBg, iconColor)}>
            {icon}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
            <span className="font-semibold text-foreground text-xs">{entry.by?.name}</span>
            <span className="text-xs">{activityText}</span>

            {/* Render changes only if from/to are present (or if custom field) */}
            {(entry.type !== 'CUSTOM_FIELD_CHANGE' || (entry.from || entry.to)) && (
              <div className="flex items-center gap-1.5 bg-muted/40 px-1.5 py-0.5 rounded border border-border">
                <span className="text-xs font-medium text-muted-foreground line-through decoration-muted-foreground/50">{fromValue}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                <span className="text-xs font-medium text-foreground">{toValue}</span>
              </div>
            )}
          </div>

          <span className="text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {formatDistanceToNow(new Date(entry.at), { addSuffix: true })}
          </span>
        </div>
      </div>
    )
  }

  // Sort activities chronologically
  const sortedActivities = [...activities].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  // Helper to group activities
  const groupActivities = (activities: ActivityLogEntry[]) => {
    const grouped: ActivityLogEntry[][] = []
    let currentGroup: ActivityLogEntry[] = []

    activities.forEach((activity, index) => {
      if (currentGroup.length === 0) {
        currentGroup.push(activity)
        return
      }

      const last = currentGroup[currentGroup.length - 1]

      // Check if we can group:
      // 1. Both are CUSTOM_FIELD_CHANGE
      // 2. Same user (check createdBy or by)
      // 3. Close in time (e.g. within 60 seconds)
      const isCustomField = activity.type === 'CUSTOM_FIELD_CHANGE' && last.type === 'CUSTOM_FIELD_CHANGE'
      const sameUser = (activity.by?.id || activity.createdBy?.id) === (last.by?.id || last.createdBy?.id)
      const timeDiff = Math.abs(new Date(activity.at).getTime() - new Date(last.at).getTime())
      const closeInTime = timeDiff < 60000 // 60 seconds

      if (isCustomField && sameUser && closeInTime) {
        currentGroup.push(activity)
      } else {
        grouped.push(currentGroup)
        currentGroup = [activity]
      }
    })

    if (currentGroup.length > 0) {
      grouped.push(currentGroup)
    }

    return grouped
  }

  const groupedActivities = groupActivities(sortedActivities)

  const renderGroupedActivity = (group: ActivityLogEntry[]) => {
    // Single activity -> render normally
    if (group.length === 1) {
      return group[0].type === "THREAD"
        ? renderThreadMessage(group[0], sortedActivities.findIndex(a => a.type === "THREAD") === sortedActivities.indexOf(group[0]))
        : renderSystemActivity(group[0])
    }

    // Grouped Custom Fields
    // We assume they are all CUSTOM_FIELD_CHANGE due to grouping logic
    const first = group[0]
    const entries = group

    // Build Merged Context for this group
    // Start with global context (current ticket state)
    // Overlay the 'to' values from this group to simulate the state at that time (for the new values)
    const groupContextOverride = entries.reduce((acc: any, entry) => {
      // We need the key to add it to context. 
      // Ideally the activity should have the key, but we often only have fieldDefinitionId.
      // However, we can try to find the key from the global ticket definitions if available?
      // Or simpler: If we have fieldDefinitionId, we can't easily map to key without lookup.
      // BUT! resolved-value API primarily needs KEYS for dependencies if dependsOnFieldKey is used.

      // Optimization: The 'context' we built earlier uses keys (e.g. 'organization'). 
      // We need to map fieldDefinitionId -> key.
      // Since we don't have that map easily here without traversing ticket.customFields, 
      // let's try to look it up from the current ticket.customFields data which has { id, key, value }.
      const fieldDef = ticket?.customFields?.find((f: any) => f.id === entry.fieldDefinitionId)
      if (fieldDef && fieldDef.key) {
        acc[fieldDef.key] = entry.to
      }
      return acc
    }, {})

    const mergedContext = { ...context, ...groupContextOverride }

    return (
      <div className="relative pl-8 py-2">
        {/* Group Icon (use Pencil for edits) */}
        <div className="flex items-start space-x-3 text-sm group">
          <div className={cn("h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400")}>
            <Pencil className="h-3 w-3" />
          </div>

          <div className="flex flex-col gap-1 w-full max-w-2xl">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-semibold text-foreground text-xs">{first.by?.name}</span>
              <span className="text-xs">updated {group.length} fields</span>
              <span className="text-[10px] text-muted-foreground/60">{formatDistanceToNow(new Date(first.at), { addSuffix: true })}</span>
            </div>

            <div className="bg-card/50 border border-border/50 rounded-md p-2 space-y-2 mt-1">
              {entries.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-1/3 truncate text-right">{entry.fieldLabel}:</span>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="font-medium text-muted-foreground line-through decoration-muted-foreground/50 truncate max-w-[40%]">
                      <ResolvedValueDisplay value={entry.from} fieldDefinitionId={entry.fieldDefinitionId} fieldType={entry.fieldType} context={entry.context || context} />
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                    <span className="font-medium text-foreground truncate">
                      {/* Prefer entry.context (snapshot) if available, else fall back to mergedContext (grouping guess) */}
                      <ResolvedValueDisplay value={entry.to} fieldDefinitionId={entry.fieldDefinitionId} fieldType={entry.fieldType} context={entry.context || mergedContext} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groupedActivities.map((group, index) => (
        <div key={`group-${index}`}>
          {renderGroupedActivity(group)}
        </div>
      ))}
    </div>
  )
}
