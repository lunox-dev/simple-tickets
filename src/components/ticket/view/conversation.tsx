"use client"

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
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { SimpleRichTextEditor } from "@/components/ui/SimpleRichTextEditor"

interface ActivityLogEntry {
  type: "THREAD" | "ASSIGN_CHANGE" | "PRIORITY_CHANGE" | "STATUS_CHANGE" | "CATEGORY_CHANGE"
  id: number
  at: string
  read: boolean
  [key: string]: any
}

interface ConversationProps {
  activities: ActivityLogEntry[]
  lastReadEvent: { type: string; id: number } | null
  ticketId: number
}

export default function TicketConversation({ activities, lastReadEvent, ticketId }: ConversationProps) {
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
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const renderThreadMessage = (entry: ActivityLogEntry) => (
    <Card
      className={`bg-white shadow-sm transition-all duration-200 ${
        !entry.read ? "ring-2 ring-blue-100 bg-blue-50/30" : ""
      } ${isLastRead(entry) ? "ring-2 ring-green-200 bg-green-50/30" : ""}`}
    >
      <CardContent className="p-6">
        {/* Message Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-blue-100 text-blue-700 font-medium">
                {getInitials(entry.createdBy?.name || "U")}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">{entry.createdBy?.name}</span>
                {!entry.read && (
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                    New
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <time dateTime={entry.at}>{format(new Date(entry.at), "MMM d, yyyy 'at' h:mm a")}</time>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(entry.at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Message Content */}
        <div className="prose prose-sm max-w-none text-gray-800 mb-4">
          <SimpleRichTextEditor
            value={entry.body || ""}
            onChange={() => {}}
            editable={false}
            className="border-none bg-transparent p-0"
          />
        </div>

        {/* Attachments */}
        {entry.attachments && entry.attachments.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <Download className="h-4 w-4 mr-2" />
              Attachments ({entry.attachments.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {entry.attachments.map((attachment: any, index: number) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border">
                  <Download className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{attachment.fileName}</p>
                    {attachment.fileSize && (
                      <p className="text-xs text-gray-500">{(attachment.fileSize / 1024).toFixed(2)} KB</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" asChild>
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
          <div className="mt-4 pt-3 border-t border-green-200">
            <div className="flex items-center space-x-2 text-sm text-green-700">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="font-medium">You read up to here</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const renderSystemActivity = (entry: ActivityLogEntry) => {
    let activityText = ""
    let fromValue = ""
    let toValue = ""

    switch (entry.type) {
      case "ASSIGN_CHANGE":
        activityText = "assigned this ticket"
        fromValue = entry.from?.name || "Unassigned"
        toValue = entry.to?.name || "Unassigned"
        break
      case "PRIORITY_CHANGE":
        activityText = "changed the priority"
        fromValue = entry.from?.name || "None"
        toValue = entry.to?.name || "None"
        break
      case "STATUS_CHANGE":
        activityText = "updated the status"
        fromValue = entry.from?.name || "None"
        toValue = entry.to?.name || "None"
        break
      case "CATEGORY_CHANGE":
        activityText = "moved this ticket"
        fromValue = entry.from?.name || "None"
        toValue = entry.to?.name || "None"
        break
    }

    return (
      <div className="flex items-center space-x-4 py-4 px-6 bg-gray-50 rounded-lg border">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
            {getActivityIcon(entry.type)}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 text-sm">
            <span className="font-medium text-gray-900">{entry.by?.name}</span>
            <span className="text-gray-600">{activityText}</span>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {fromValue}
            </Badge>
            <ArrowRight className="h-3 w-3 text-gray-400" />
            <Badge variant="outline" className="text-xs">
              {toValue}
            </Badge>
          </div>
        </div>
        <div className="flex-shrink-0 text-xs text-gray-500">
          {formatDistanceToNow(new Date(entry.at), { addSuffix: true })}
        </div>
      </div>
    )
  }

  // Sort activities chronologically
  const sortedActivities = [...activities].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  if (sortedActivities.length === 0) {
    return (
      <Card className="bg-white shadow-sm">
        <CardContent className="p-12 text-center">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No conversation yet</h3>
          <p className="text-gray-500">This ticket hasn't received any responses yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {sortedActivities.map((entry, index) => (
        <div key={`${entry.type}-${entry.id}`}>
          {entry.type === "THREAD" ? renderThreadMessage(entry) : renderSystemActivity(entry)}
        </div>
      ))}
    </div>
  )
}
