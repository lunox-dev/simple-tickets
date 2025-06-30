"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertCircle, ArrowLeft, Clock, User, Flag, CheckCircle, MessageSquare } from "lucide-react"
import { format } from "date-fns"
import TicketComments from "./ticket-comments"
import TicketPropertiesPanel from "./properties-panel"
import NewThreadForm from "./new-thread-form"
import NoPermission from "@/components/ui/NoPermission"
import { useSession } from "next-auth/react"
import { SimpleRichTextEditor } from "@/components/ui/SimpleRichTextEditor"

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

interface ActivityLogEntry {
  type: "THREAD" | "ASSIGN_CHANGE" | "PRIORITY_CHANGE" | "STATUS_CHANGE"
  id: number
  at: string
  read: boolean
  [key: string]: any
}

interface TicketViewData {
  user: {
    id: number
    permissions: string[]
  }
  ticket: TicketData
  lastReadEvent: { type: string; id: number } | null
  activityLog: ActivityLogEntry[]
}

interface TicketViewProps {
  ticketId: number
}

export default function TicketView({ ticketId }: TicketViewProps) {
  const [data, setData] = useState<TicketViewData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const router = useRouter()

  const { data: session, status } = useSession()

  const fetchTicketData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const response = await fetch(`/api/ticket/read?ticketId=${ticketId}`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("TICKET_NOT_FOUND")
        }
        if (response.status === 403) {
          throw new Error("NO_PERMISSION")
        }
        if (response.status === 401) {
          throw new Error("UNAUTHORIZED")
        }
        throw new Error("Failed to load ticket")
      }

      const ticketData = await response.json()
      setData(ticketData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`
    }
  }, [status])

  useEffect(() => {
    if (status === "authenticated") {
      fetchTicketData()
    }
  }, [ticketId, status])

  const handleRefresh = () => {
    fetchTicketData(true)
  }

  const handleTicketUpdate = () => {
    fetchTicketData(true)
  }

  const handleNewThread = () => {
    fetchTicketData(true)
  }

  const hasPermission = (permission: string): boolean => {
    return data?.user.permissions.includes(permission) ?? false
  }

  const canCreateThread = (): boolean => {
    if (!data) return false

    // Check for thread creation permissions
    const threadPermissions = data.user.permissions.filter((p) => p.startsWith("ticket:action:thread:create:"))

    return threadPermissions.some((p) => p.endsWith(":any") || p.endsWith(":team") || p.endsWith(":self"))
  }

  // Show loading while checking authentication
  if (status === "loading" || isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8 max-w-7xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  // Don't render anything if redirecting to login
  if (status === "unauthenticated") {
    return null
  }

  if (error) {
    if (error === "NO_PERMISSION") {
      return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl">
          <NoPermission message="You don't have permission to view this ticket." />
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      )
    }

    if (error === "TICKET_NOT_FOUND") {
      return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl">
          <NoPermission message="The ticket you're looking for doesn't exist or has been deleted." />
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => router.push("/tickets")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tickets
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="container mx-auto p-4 md:p-8 max-w-7xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { ticket, activityLog } = data

  // Separate first thread (ticket body) from other activities
  const firstThread = activityLog.find((entry) => entry.type === "THREAD")
  const otherActivities = activityLog.filter((entry) => entry !== firstThread)

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="xl:col-span-3 space-y-6">
          {/* Main Ticket Card */}
          <Card>
            <CardHeader className="pb-4">
              {/* Ticket Title */}
              <div className="space-y-3">
                <h1 className="text-2xl font-bold">
                  #{ticket.id} - {ticket.title}
                </h1>

                {/* Status and Priority Badges */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary">{ticket.currentStatus.name}</Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Flag className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary">{ticket.currentPriority.name}</Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">
                      Assigned to {ticket.currentAssignedTo ? ticket.currentAssignedTo.name : "Unassigned"}
                    </Badge>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <span>Created by {ticket.createdBy.name}</span>
                  <span>•</span>
                  <span>{format(new Date(ticket.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                  {ticket.updatedAt !== ticket.createdAt && (
                    <>
                      <span>•</span>
                      <span>Updated {format(new Date(ticket.updatedAt), "MMM d, yyyy 'at' h:mm a")}</span>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {/* Original Ticket Body */}
              {firstThread && (
                <div className="space-y-4">
                  <SimpleRichTextEditor
                    value={firstThread.body || ""}
                    onChange={() => {}} // Read-only
                    editable={false}
                    className="border-none bg-transparent p-0"
                  />

                  {/* First Thread Attachments */}
                  {firstThread.attachments && firstThread.attachments.length > 0 && (
                    <div className="space-y-2 pt-4 border-t">
                      <h4 className="text-sm font-medium">Attachments:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {firstThread.attachments.map((attachment: any, index: number) => (
                          <div key={index} className="flex items-center space-x-2 p-2 bg-muted rounded-md">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                              {attachment.fileSize && (
                                <p className="text-xs text-muted-foreground">
                                  {(attachment.fileSize / 1024).toFixed(2)} KB
                                </p>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={attachment.filePath} target="_blank" rel="noopener noreferrer">
                                Download
                              </a>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments and Activity */}
          {otherActivities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>Activity ({otherActivities.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TicketComments activities={otherActivities} />
              </CardContent>
            </Card>
          )}

          {/* New Comment Form */}
          {canCreateThread() && (
            <Card>
              <CardHeader>
                <CardTitle>Add Comment</CardTitle>
              </CardHeader>
              <CardContent>
                <NewThreadForm ticketId={ticketId} onThreadCreated={handleNewThread} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Properties Panel */}
        <div className="xl:col-span-1">
          <TicketPropertiesPanel
            ticket={ticket}
            userPermissions={data.user.permissions}
            onTicketUpdate={handleTicketUpdate}
          />
        </div>
      </div>
    </div>
  )
}
