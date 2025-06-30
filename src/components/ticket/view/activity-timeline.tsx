"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageSquare, UserCheck, Flag, CheckCircle, Download, ExternalLink, Circle } from "lucide-react"
import { format } from "date-fns"
import { SimpleRichTextEditor } from "@/components/ui/SimpleRichTextEditor"

interface ActivityLogEntry {
  type: "THREAD" | "ASSIGN_CHANGE" | "PRIORITY_CHANGE" | "STATUS_CHANGE"
  id: number
  at: string
  read: boolean
  [key: string]: any
}

interface ActivityTimelineProps {
  activityLog: ActivityLogEntry[]
  lastReadEvent: { type: string; id: number } | null
}

export default function TicketActivityTimeline({ activityLog, lastReadEvent }: ActivityTimelineProps) {
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
      default:
        return <Circle className="h-4 w-4" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case "THREAD":
        return "text-blue-600 bg-blue-100"
      case "ASSIGN_CHANGE":
        return "text-green-600 bg-green-100"
      case "PRIORITY_CHANGE":
        return "text-orange-600 bg-orange-100"
      case "STATUS_CHANGE":
        return "text-purple-600 bg-purple-100"
      default:
        return "text-gray-600 bg-gray-100"
    }
  }

  const isLastRead = (entry: ActivityLogEntry) => {
    return lastReadEvent && lastReadEvent.type === entry.type && lastReadEvent.id === entry.id
  }

  const renderThreadEntry = (entry: ActivityLogEntry) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-medium">{entry.createdBy?.name}</span>
          <span className="text-sm text-muted-foreground">commented</span>
        </div>
        <time className="text-sm text-muted-foreground">{format(new Date(entry.at), "MMM d, yyyy 'at' h:mm a")}</time>
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <SimpleRichTextEditor
          value={entry.body || ""}
          onChange={() => {}} // Read-only
          editable={false}
          className="border-none bg-transparent"
        />
      </div>

      {entry.attachments && entry.attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Attachments:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {entry.attachments.map((attachment: any, index: number) => (
              <div key={index} className="flex items-center space-x-2 p-2 bg-muted rounded-md">
                <Download className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                  {attachment.fileSize && (
                    <p className="text-xs text-muted-foreground">{(attachment.fileSize / 1024).toFixed(2)} KB</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <a href={attachment.filePath} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderAssignmentChange = (entry: ActivityLogEntry) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-medium">{entry.by?.name}</span>
          <span className="text-sm text-muted-foreground">changed assignment</span>
        </div>
        <time className="text-sm text-muted-foreground">{format(new Date(entry.at), "MMM d, yyyy 'at' h:mm a")}</time>
      </div>
      <div className="flex items-center space-x-2 text-sm">
        <span>From:</span>
        <Badge variant="outline">{entry.from?.name || "Unassigned"}</Badge>
        <span>→</span>
        <Badge variant="outline">{entry.to?.name || "Unassigned"}</Badge>
      </div>
    </div>
  )

  const renderPriorityChange = (entry: ActivityLogEntry) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-medium">{entry.by?.name}</span>
          <span className="text-sm text-muted-foreground">changed priority</span>
        </div>
        <time className="text-sm text-muted-foreground">{format(new Date(entry.at), "MMM d, yyyy 'at' h:mm a")}</time>
      </div>
      <div className="flex items-center space-x-2 text-sm">
        <span>From:</span>
        <Badge variant="secondary">{entry.from?.name}</Badge>
        <span>→</span>
        <Badge variant="secondary">{entry.to?.name}</Badge>
      </div>
    </div>
  )

  const renderStatusChange = (entry: ActivityLogEntry) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-medium">{entry.by?.name}</span>
          <span className="text-sm text-muted-foreground">changed status</span>
        </div>
        <time className="text-sm text-muted-foreground">{format(new Date(entry.at), "MMM d, yyyy 'at' h:mm a")}</time>
      </div>
      <div className="flex items-center space-x-2 text-sm">
        <span>From:</span>
        <Badge variant="secondary">{entry.from?.name}</Badge>
        <span>→</span>
        <Badge variant="secondary">{entry.to?.name}</Badge>
      </div>
    </div>
  )

  const renderActivityContent = (entry: ActivityLogEntry) => {
    switch (entry.type) {
      case "THREAD":
        return renderThreadEntry(entry)
      case "ASSIGN_CHANGE":
        return renderAssignmentChange(entry)
      case "PRIORITY_CHANGE":
        return renderPriorityChange(entry)
      case "STATUS_CHANGE":
        return renderStatusChange(entry)
      default:
        return <div>Unknown activity type</div>
    }
  }

  if (activityLog.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No activity yet</div>
  }

  return (
    <div className="space-y-6">
      {activityLog.map((entry, index) => (
        <div key={`${entry.type}-${entry.id}`} className="relative">
          {/* Timeline line */}
          {index < activityLog.length - 1 && <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />}

          {/* Activity item */}
          <div className="flex space-x-4">
            {/* Icon */}
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(entry.type)}`}
            >
              {getActivityIcon(entry.type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <Card
                className={`${!entry.read ? "ring-2 ring-blue-200 bg-blue-50/50" : ""} ${isLastRead(entry) ? "ring-2 ring-green-200 bg-green-50/50" : ""}`}
              >
                <CardContent className="p-4">{renderActivityContent(entry)}</CardContent>
              </Card>

              {/* Last read indicator */}
              {isLastRead(entry) && (
                <div className="mt-2 flex items-center space-x-2 text-sm text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span>Last read here</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
