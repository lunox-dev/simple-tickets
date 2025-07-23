"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, AlertCircle, ArrowLeft, RefreshCw, Reply, MoreHorizontal, Archive, Star } from "lucide-react"
import { format } from "date-fns"
import TicketConversation from "./conversation"
import TicketSidebar from "./sidebar"
import NewThreadForm from "./new-thread-form"
import NoPermission from "@/components/ui/NoPermission"
import { useSession } from "next-auth/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

interface ActivityLogEntry {
  type: "THREAD" | "ASSIGN_CHANGE" | "PRIORITY_CHANGE" | "STATUS_CHANGE" | "CATEGORY_CHANGE"
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
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
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
    setShowReplyForm(false)
    fetchTicketData(true)
  }

  const canCreateThread = (): boolean => {
    if (!data) return false

    const threadPermissions = data.user.permissions.filter((p) => p.startsWith("ticket:action:thread:create:"))

    return threadPermissions.some((p) => {
      const parts = p.split(":")
      if (parts.length < 5) return false

      const scope = parts[4] // self, team, team:unclaimed, any

      if (scope === "any") return true
      if (scope === "team") return true
      if (scope === "team:unclaimed") {
        return data.ticket.currentAssignedTo && data.ticket.currentAssignedTo.entityId
      }
      if (scope === "self") {
        return data.ticket.currentAssignedTo && data.ticket.currentAssignedTo.entityId === data.user.id
      }

      return false
    })
  }

  // Show loading while checking authentication
  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Loading ticket...</p>
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
        <div className="min-h-screen bg-gray-50">
          <div className="container mx-auto px-4 py-8">
            <NoPermission message="You don't have permission to view this ticket." />
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </div>
          </div>
        </div>
      )
    }

    if (error === "TICKET_NOT_FOUND") {
      return (
        <div className="min-h-screen bg-gray-50">
          <div className="container mx-auto px-4 py-8">
            <NoPermission message="The ticket you're looking for doesn't exist or has been deleted." />
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => router.push("/tickets")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tickets
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
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
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { ticket, activityLog } = data

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Email-like Header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left side - Navigation */}
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center space-x-2">
              {canCreateThread() && (
                <Button onClick={() => setShowReplyForm(true)} size="sm">
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Star className="h-4 w-4 mr-2" />
                    Star ticket
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Copy ticket link</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Email-like Conversation View */}
          <div className={`${sidebarOpen ? "lg:col-span-3" : "lg:col-span-4"} space-y-6`}>
            {/* Ticket Subject Header */}
            <Card className="bg-white shadow-sm">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Subject line */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <span>Ticket #{ticket.id}</span>
                      <span>•</span>
                      <span>{format(new Date(ticket.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                    </div>
                    <h1 className="text-2xl font-semibold text-gray-900 leading-tight">{ticket.title}</h1>
                  </div>

                  {/* Status indicators */}
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge
                      className="font-medium border-0"
                      style={{
                        backgroundColor: ticket.currentStatus.color,
                        color: getContrastColor(ticket.currentStatus.color),
                      }}
                    >
                      {ticket.currentStatus.name}
                    </Badge>
                    <Badge
                      className="font-medium border-0"
                      style={{
                        backgroundColor: ticket.currentPriority.color,
                        color: getContrastColor(ticket.currentPriority.color),
                      }}
                    >
                      {ticket.currentPriority.name}
                    </Badge>
                    <Badge variant="outline" className="font-medium">
                      {ticket.currentCategory.name}
                    </Badge>
                  </div>

                  {/* Participants */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <div>
                        <span className="text-muted-foreground">From: </span>
                        <span className="font-medium">{ticket.createdBy.name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">To: </span>
                        <span className="font-medium">
                          {ticket.currentAssignedTo ? ticket.currentAssignedTo.name : "Unassigned"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Conversation Thread */}
            <TicketConversation activities={activityLog} lastReadEvent={data.lastReadEvent} ticketId={ticketId} />

            {/* Reply Form */}
            {showReplyForm && canCreateThread() && (
              <Card className="bg-white shadow-sm">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Reply className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium">Reply to ticket</h3>
                        <p className="text-sm text-muted-foreground">Add your response to this conversation</p>
                      </div>
                    </div>
                    <NewThreadForm
                      ticketId={ticketId}
                      onThreadCreated={handleNewThread}
                      onCancel={() => setShowReplyForm(false)}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          {sidebarOpen && (
            <div className="lg:col-span-1">
              <TicketSidebar
                ticket={ticket}
                userPermissions={data.user.permissions}
                onTicketUpdate={handleTicketUpdate}
                onClose={() => setSidebarOpen(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
