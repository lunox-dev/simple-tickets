"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Plus, AlertCircle, Users, UserMinus } from "lucide-react"

interface User {
  id: number
  displayName: string
  email: string
  teams: Array<{
    userTeamId: number
    teamName: string | null
  }>
}

interface Team {
  id: number
  name: string
  Active: boolean
  users?: TeamUser[]
}

interface TeamUser {
  userTeamId: number
  userId: number
  displayName: string
  email: string
  displayPriority: number
  permissions: string[]
  Active: boolean
}

interface AssignmentForm {
  userId: number | null
  teamId: number | null
}

export default function UserTeamAssignment() {
  const [users, setUsers] = useState<User[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Assignment dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignForm, setAssignForm] = useState<AssignmentForm>({
    userId: null,
    teamId: null,
  })
  const [isAssigning, setIsAssigning] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [usersRes, teamsRes] = await Promise.all([fetch("/api/user/account/list"), fetch("/api/user/team/list")])

      if (!usersRes.ok || !teamsRes.ok) {
        throw new Error("Failed to fetch data")
      }

      const usersData = await usersRes.json()
      const teamsData = await teamsRes.json()

      setUsers(usersData)
      setTeams(teamsData.filter((team: Team) => team.Active))
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAssignUser = async () => {
    if (!assignForm.userId || !assignForm.teamId) {
      setError("Please select both user and team")
      return
    }

    setIsAssigning(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/user/team/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: assignForm.userId,
          teamId: assignForm.teamId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to assign user to team")
      }

      setSuccess("User assigned to team successfully")
      setAssignDialogOpen(false)
      setAssignForm({ userId: null, teamId: null })
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsAssigning(false)
    }
  }

  const handleRemoveUser = async (userTeamId: number) => {
    if (!confirm("Are you sure you want to remove this user from the team?")) {
      return
    }

    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/user/team/resign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userTeamId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to remove user from team")
      }

      setSuccess("User removed from team successfully")
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const getTeamUsers = (teamId: number): User[] => {
    return users.filter((user) => user.teams.some((team) => team.teamName === teams.find((t) => t.id === teamId)?.name))
  }

  const getUnassignedUsers = (): User[] => {
    return users.filter((user) => user.teams.length === 0)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
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

      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Team User Management</h2>
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Assign User to Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign User to Team</DialogTitle>
              <DialogDescription>Select a user and team to create a new assignment.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>User</Label>
                <Select
                  value={assignForm.userId?.toString() || ""}
                  onValueChange={(value) => setAssignForm({ ...assignForm, userId: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.displayName} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Team</Label>
                <Select
                  value={assignForm.teamId?.toString() || ""}
                  onValueChange={(value) => setAssignForm({ ...assignForm, teamId: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignUser} disabled={isAssigning}>
                {isAssigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Assign User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Unassigned Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-4 w-4 mr-2" />
            Unassigned Users ({getUnassignedUsers().length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {getUnassignedUsers().length === 0 ? (
            <p className="text-muted-foreground text-sm">All users are assigned to teams</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getUnassignedUsers().map((user) => (
                <div key={user.id} className="p-3 border rounded-lg">
                  <div className="font-medium">{user.displayName}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                  <Badge variant="outline" className="mt-2">
                    No Team
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teams and their users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {teams.map((team) => {
          const teamUsers = getTeamUsers(team.id)
          return (
            <Card key={team.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    {team.name} ({teamUsers.length})
                  </div>
                  <Badge variant={team.Active ? "default" : "secondary"}>{team.Active ? "Active" : "Inactive"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {teamUsers.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">No users assigned to this team</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamUsers.map((user) => {
                        const userTeam = user.teams.find((t) => t.teamName === team.name)
                        return (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.displayName}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              {userTeam && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveUser(userTeam.userTeamId)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
