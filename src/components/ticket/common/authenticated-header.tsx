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
import { LogOut, User, Users, ChevronDown, Building2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Session } from "next-auth"

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
      router.refresh()
    } catch (error) {
      toast.error("Error", {
        description: error instanceof Error ? error.message : "Failed to change team",
      })
    } finally {
      setIsChangingTeam(false)
    }
  }

  const handleNavigation = (path: string) => {
    router.push(path)
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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 m-0 p-0">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 m-0">
        {/* Logo/Brand */}
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold leading-none">Simple Tickets</h1>
            <p className="text-xs text-muted-foreground">Support Platform</p>
          </div>
        </div>

        {/* Center - Acting Team Info */}
        <div className="hidden md:flex items-center">
          {hasMultipleTeams ? (
            <div className="flex items-center space-x-3 rounded-lg border bg-card px-3 py-2 shadow-sm">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Acting as:</span>
              </div>
              <Select
                value={user.actionUserTeamId.toString()}
                onValueChange={handleTeamChange}
                disabled={isChangingTeam}
              >
                <SelectTrigger className="h-8 w-[180px] border-0 bg-transparent p-0 focus:ring-0">
                  <SelectValue>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="font-medium">
                        {user.actingAs.teamName}
                      </Badge>
                      {!isChangingTeam && <ChevronDown className="h-3 w-3 opacity-50" />}
                      {isChangingTeam && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {user.teams.map((team) => (
                    <SelectItem key={team.userTeamId} value={team.userTeamId.toString()}>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{team.name}</span>
                        {team.userTeamId === user.actionUserTeamId && (
                          <Badge variant="default" className="ml-2 text-xs">
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
            <div className="text-sm text-muted-foreground">{user.actingAs.teamName}</div>
          )}
        </div>

        {/* Right side - User menu */}
        <div className="flex items-center space-x-2">
          {/* Mobile team selector */}
          <div className="md:hidden">
            {hasMultipleTeams ? (
              <Select
                value={user.actionUserTeamId.toString()}
                onValueChange={handleTeamChange}
                disabled={isChangingTeam}
              >
                <SelectTrigger className="h-9 w-9 p-0">
                  <div className="flex items-center justify-center">
                    {isChangingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {user.teams.map((team) => (
                    <SelectItem key={team.userTeamId} value={team.userTeamId.toString()}>
                      <div className="flex items-center justify-between w-full">
                        <span>{team.name}</span>
                        {team.userTeamId === user.actionUserTeamId && (
                          <Badge variant="default" className="ml-2 text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <Users className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder.svg" alt={user.name} />
                  <AvatarFallback className="text-xs font-medium">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="/placeholder.svg" alt={user.name} />
                      <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  {hasMultipleTeams && (
                    <div className="md:hidden">
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>Current team:</span>
                        <Badge variant="secondary" className="text-xs">
                          {user.actingAs.teamName}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => handleNavigation("/dashboard")}>
                <Building2 className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => handleNavigation("/profile")}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
