
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, AlertCircle, ArrowLeft, RefreshCw, Reply, MoreHorizontal, Archive, Star, Sidebar as SidebarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
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
    teams: { id: number; teamId: number }[]
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

      if (scope === "team") {
        const assignedTeamId = data.ticket.currentAssignedTo?.teamId
        // Also check if assigned to a userTeam, which has a teamId
        const userTeamTeamId = data.ticket.currentAssignedTo?.type === 'user' ? data.ticket.currentAssignedTo.teamId : null

        const effectiveTeamId = assignedTeamId || userTeamTeamId
        if (!effectiveTeamId) return false

        return data.user.teams.some(t => t.teamId === effectiveTeamId)
      }

      if (scope === "team:unclaimed") {
        // Must be assigned to one of my teams AND not assigned to a specific user
        const assignedTeamId = data.ticket.currentAssignedTo?.teamId
        if (!assignedTeamId) return false
        if (data.ticket.currentAssignedTo?.userTeamId) return false // It IS claimed

        return data.user.teams.some(t => t.teamId === assignedTeamId)
      }

      if (scope === "self") {
        if (!data.ticket.currentAssignedTo?.userTeamId) return false
        return data.user.teams.some(t => t.id === data.ticket.currentAssignedTo!.userTeamId)
      }

      return false
    })
  }

  // Show loading while checking authentication
  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        <div className="min-h-screen bg-background">
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
        <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background">
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
    <div className="min-h-screen bg-background">
      {/* Sticky View Header */}
      <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border sticky top-16 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/tickets")}
                className="text-muted-foreground hover:text-foreground h-8 w-8 p-0 rounded-full flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-2 text-xs mb-0.5">
                  <span className="font-mono text-muted-foreground">#{ticket.id}</span>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="text-muted-foreground font-medium">{ticket.currentCategory.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-bold text-foreground truncate tracking-tight leading-none">{ticket.title}</h1>
                  <Badge
                    variant="secondary"
                    className="rounded-full text-xs font-semibold px-2 py-0 border-0 flex-shrink-0 h-5"
                    style={{
                      backgroundColor: `${ticket.currentStatus.color}20`,
                      color: ticket.currentStatus.color
                    }}
                  >
                    {ticket.currentStatus.name}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {!showReplyForm && canCreateThread() && (
                <Button onClick={() => setShowReplyForm(true)} size="sm" className="shadow-sm">
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </Button>
              )}

              <div className="h-4 w-px bg-border mx-1" />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`h-9 w-9 ${sidebarOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                title={sidebarOpen ? "Close Sidebar" : "Open Sidebar"}
              >
                <SidebarIcon className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleRefresh} disabled={isRefreshing}>
                    <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                    <span>Refresh Ticket</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigator.clipboard.writeText(window.location.href)}>
                    <div className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-2 h-4 w-4"
                      >
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                      <span>Copy Link</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className={`${sidebarOpen ? "lg:col-span-3" : "lg:col-span-4"} space-y-8`}>

            <TicketConversation
              activities={activityLog}
              lastReadEvent={data.lastReadEvent}
              ticketId={ticketId}
            />

            {showReplyForm && canCreateThread() && (
              <div className="scroll-mt-24" id="reply-form">
                <Card className="bg-card shadow-lg shadow-black/5 border-border overflow-hidden ring-1 ring-border">
                  <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <Reply className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">New Reply</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowReplyForm(false)} className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
                      <span className="sr-only">Close</span>
                      <span aria-hidden className="text-lg leading-none">&times;</span>
                    </Button>
                  </div>
                  <CardContent className="p-5">
                    <NewThreadForm
                      ticketId={ticketId}
                      onThreadCreated={handleNewThread}
                      onCancel={() => setShowReplyForm(false)}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Sidebar */}
          {sidebarOpen && (
            <div className="lg:col-span-1">
              <TicketSidebar
                ticket={ticket}
                user={data.user}
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
