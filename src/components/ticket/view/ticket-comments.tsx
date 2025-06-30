"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MessageSquare, UserCheck, Flag, CheckCircle, ExternalLink, ArrowRight } from "lucide-react"
import { format } from "date-fns"
import { SimpleRichTextEditor } from "@/components/ui/SimpleRichTextEditor"

interface ActivityLogEntry {
  type: "THREAD" | "ASSIGN_CHANGE" | "PRIORITY_CHANGE" | "STATUS_CHANGE"
  id: number
  at: string
  read: boolean
  [key: string]: any
}

interface TicketCommentsProps {
  activities: ActivityLogEntry[]
}

export default function TicketComments({ activities }: TicketCommentsProps) {
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
        return <MessageSquare className="h-4 w-4" />
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

  const renderThreadComment = (entry: ActivityLogEntry) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-medium">{entry.createdBy?.name}</span>
          <span className="text-sm text-muted-foreground">commented</span>
        </div>
        <time className="text-sm text-muted-foreground">{format(new Date(entry.at), "MMM d, h:mm a")}</time>
      </div>

      <div className="pl-4 border-l-2 border-muted">
        <SimpleRichTextEditor
          value={entry.body || ""}
          onChange={() => {}} // Read-only
          editable={false}
          className="border-none bg-transparent p-0"
        />
      </div>

      {entry.attachments && entry.attachments.length > 0 && (
        <div className="space-y-2 pl-4">
          <h4 className="text-sm font-medium">Attachments:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {entry.attachments.map((attachment: any, index: number) => (
              <div key={index} className="flex items-center space-x-2 p-2 bg-muted rounded-md">
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

  const renderSystemActivity = (entry: ActivityLogEntry) => {
    let activityText = ""
    let fromValue = ""
    let toValue = ""

    switch (entry.type) {
      case "ASSIGN_CHANGE":
        activityText = "changed assignment"
        fromValue = entry.from?.name || "Unassigned"
        toValue = entry.to?.name || "Unassigned"
        break
      case "PRIORITY_CHANGE":
        activityText = "changed priority"
        fromValue = entry.from?.name || "Unknown"
        toValue = entry.to?.name || "Unknown"
        break
      case "STATUS_CHANGE":
        activityText = "changed status"
        fromValue = entry.from?.name || "Unknown"
        toValue = entry.to?.name || "Unknown"
        break
    }

    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="font-medium">{entry.by?.name}</span>
          <span className="text-sm text-muted-foreground">{activityText}</span>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {fromValue}
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-xs">
              {toValue}
            </Badge>
          </div>
        </div>
        <time className="text-sm text-muted-foreground">{format(new Date(entry.at), "MMM d, h:mm a")}</time>
      </div>
    )
  }

  if (activities.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No activity yet</div>
  }

  return (
    <div className="space-y-4">
      {activities.map((entry, index) => (
        <div key={`${entry.type}-${entry.id}`} className="relative">
          {/* Timeline connector */}
          {index < activities.length - 1 && <div className="absolute left-4 top-12 bottom-0 w-px bg-border" />}

          <div className="flex space-x-4">
            {/* Activity Icon */}
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(entry.type)}`}
            >
              {getActivityIcon(entry.type)}
            </div>

            {/* Activity Content */}
            <div className="flex-1 min-w-0">
              {entry.type === "THREAD" ? (
                <div
                  className={`p-4 rounded-lg border ${!entry.read ? "bg-blue-50 border-blue-200" : "bg-background"}`}
                >
                  {renderThreadComment(entry)}
                </div>
              ) : (
                <div className={`p-3 rounded-lg border ${!entry.read ? "bg-blue-50 border-blue-200" : "bg-muted/50"}`}>
                  {renderSystemActivity(entry)}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
