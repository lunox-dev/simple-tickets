"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus, AlertCircle, Edit, GripVertical } from "lucide-react"
import { Switch } from "@/components/ui/switch"

interface Team {
  id: number
  name: string
  priority: number
  permissions: string[]
  Active: boolean
}

interface CreateTeamForm {
  name: string
  priority: number
  permissions: string
}

export default function TeamManagement() {
  const [teams, setTeams] = useState<Team[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Create team dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateTeamForm>({
    name: "",
    priority: 0,
    permissions: "",
  })
  const [isCreating, setIsCreating] = useState(false)

  // Edit team dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState<{
    teamId: number
    name: string
    permissions: string
    Active: boolean
  }>({
    teamId: 0,
    name: "",
    permissions: "",
    Active: true,
  })
  const [isEditingTeam, setIsEditingTeam] = useState(false)

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isSavingOrder, setIsSavingOrder] = useState(false)

  const fetchTeams = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/user/team/list")
      if (!response.ok) {
        throw new Error("Failed to fetch teams")
      }
      const data = await response.json()
      setTeams(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTeams()
  }, [])

  const handleCreateTeam = async () => {
    if (!createForm.name.trim()) {
      setError("Team name is required")
      return
    }

    setIsCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const permissions = createForm.permissions
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0)

      const response = await fetch("/api/user/team/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          priority: createForm.priority,
          permissions,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create team")
      }

      setSuccess("Team created successfully")
      setCreateDialogOpen(false)
      setCreateForm({ name: "", priority: 0, permissions: "" })
      fetchTeams()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditTeam = async () => {
    if (!editForm.name.trim()) {
      setError("Team name is required")
      return
    }

    setIsEditingTeam(true)
    setError(null)
    setSuccess(null)

    try {
      const permissions = editForm.permissions
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0)

      const response = await fetch("/api/user/team/modify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: editForm.teamId,
          name: editForm.name.trim(),
          permissions,
          Active: editForm.Active,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update team")
      }

      setSuccess("Team updated successfully")
      setEditDialogOpen(false)
      fetchTeams()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsEditingTeam(false)
    }
  }

  const openEditDialog = (team: Team) => {
    setEditForm({
      teamId: team.id,
      name: team.name,
      permissions: team.permissions.join(", "),
      Active: team.Active,
    })
    setEditDialogOpen(true)
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === dropIndex) return

    const newTeams = [...teams]
    const draggedTeam = newTeams[draggedIndex]
    newTeams.splice(draggedIndex, 1)
    newTeams.splice(dropIndex, 0, draggedTeam)

    // Update priorities based on new order
    const updatedTeams = newTeams.map((team, index) => ({
      ...team,
      priority: index,
    }))

    setTeams(updatedTeams)
    setDraggedIndex(null)
  }

  const saveTeamOrder = async () => {
    setIsSavingOrder(true)
    setError(null)
    setSuccess(null)

    try {
      const updates = teams.map((team, index) => ({
        teamId: team.id,
        priority: index,
      }))

      const response = await fetch("/api/user/team/manage/change-priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update team order")
      }

      setSuccess("Team order updated successfully")
      fetchTeams()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSavingOrder(false)
    }
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
        <h2 className="text-lg font-semibold">Teams ({teams.length})</h2>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={saveTeamOrder} disabled={isSavingOrder}>
            {isSavingOrder && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Order
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
                <DialogDescription>Add a new team to the system.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Team Name</Label>
                  <Input
                    id="create-name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Development Team"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-priority">Priority</Label>
                  <Input
                    id="create-priority"
                    type="number"
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-permissions">Permissions (comma-separated)</Label>
                  <Textarea
                    id="create-permissions"
                    value={createForm.permissions}
                    onChange={(e) => setCreateForm({ ...createForm, permissions: e.target.value })}
                    placeholder="ticket:create, ticket:read:assigned:team"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTeam} disabled={isCreating}>
                  {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Team
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Teams Table with Drag and Drop */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b bg-muted/50">
            <p className="text-sm text-muted-foreground">
              Drag teams to reorder them. Click "Save Order" to persist changes.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No teams found
                  </TableCell>
                </TableRow>
              ) : (
                teams.map((team, index) => (
                  <TableRow
                    key={team.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`cursor-move ${draggedIndex === index ? "opacity-50" : ""}`}
                  >
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-mono">{team.priority}</TableCell>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <div className="text-sm text-muted-foreground truncate">
                          {team.permissions.length > 0 ? team.permissions.join(", ") : "No permissions"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          team.Active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {team.Active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(team)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Team Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>Update team information and permissions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Team Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Development Team"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-permissions">Permissions (comma-separated)</Label>
              <Textarea
                id="edit-permissions"
                value={editForm.permissions}
                onChange={(e) => setEditForm({ ...editForm, permissions: e.target.value })}
                placeholder="ticket:create, ticket:read:assigned:team"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-team-active"
                checked={editForm.Active}
                onCheckedChange={(checked) => setEditForm({ ...editForm, Active: checked })}
              />
              <Label htmlFor="edit-team-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTeam} disabled={isEditingTeam}>
              {isEditingTeam && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
