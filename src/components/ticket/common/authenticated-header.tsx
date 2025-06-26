"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { LogOut, User, Settings, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Session } from 'next-auth'

interface Team {
  userTeamId: number
  teamId: number
  name: string
  permissions: string[]
  userTeamPermissions: string[]
  entityId: number
}

interface ActingAs {
  userTeamId: number
  teamName: string
}

interface SessionUser {
  id: number
  name: string
  email: string
  permissions: string[]
  teams: Team[]
  actionUserTeamId: number
  actingAs: ActingAs
}

interface AuthenticatedHeaderProps {
  session: Session
}

export default function AuthenticatedHeader({ session }: AuthenticatedHeaderProps) {
  const [isChangingTeam, setIsChangingTeam] = useState(false)
  const router = useRouter()
  const user = session.user as SessionUser

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const handleTeamChange = async (userTeamId: string) => {
    setIsChangingTeam(true)

    try {
      const response = await fetch("/api/user/preference/acting-team/change", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userTeamId: Number.parseInt(userTeamId, 10),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to change team")
      }

      toast.success("Team Changed", {
        description: "Your acting team has been updated successfully.",
      })

      // Refresh the page to update the session
      router.refresh()
    } catch (error) {
      toast.error("Error", {
        description: error instanceof Error ? error.message : "Failed to change team",
      })
    } finally {
      setIsChangingTeam(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const hasMultipleTeams = user.teams.length > 1

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">Simple Tickets</h1>
          </div>

          {/* Center - Acting Team Info */}
          <div className="flex items-center space-x-4">
            {hasMultipleTeams ? (
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Acting as:</span>
                <Select
                  value={user.actionUserTeamId.toString()}
                  onValueChange={handleTeamChange}
                  disabled={isChangingTeam}
                >
                  <SelectTrigger className="w-[200px] h-8">
                    <SelectValue>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className="text-xs">
                          {user.actingAs.teamName}
                        </Badge>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {user.teams.map((team) => (
                      <SelectItem key={team.userTeamId} value={team.userTeamId.toString()}>
                        <div className="flex items-center space-x-2">
                          <span>{team.name}</span>
                          {team.userTeamId === user.actionUserTeamId && (
                            <Badge variant="default" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Team:</span>
                <Badge variant="secondary">{user.actingAs.teamName}</Badge>
              </div>
            )}
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder.svg" alt={user.name} />
                    <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
