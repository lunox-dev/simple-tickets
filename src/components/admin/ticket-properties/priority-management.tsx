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
import { Loader2, Plus, Edit, AlertCircle, GripVertical, Flag } from "lucide-react"

interface Priority {
  id: number
  name: string
  priority: number
  color: string
}

interface CreatePriorityForm {
  name: string
  priority: number
  color: string
}

interface EditPriorityForm {
  id: number
  name: string
  priority: number
  color: string
}

export default function PriorityManagement() {
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Create priority dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreatePriorityForm>({
    name: "",
    priority: 0,
    color: "#3b82f6",
  })
  const [isCreating, setIsCreating] = useState(false)

  // Edit priority dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditPriorityForm>({
    id: 0,
    name: "",
    priority: 0,
    color: "#3b82f6",
  })
  const [isEditing, setIsEditing] = useState(false)

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isSavingOrder, setIsSavingOrder] = useState(false)

  const fetchPriorities = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/ticket/priority/list")
      if (!response.ok) {
        throw new Error("Failed to fetch priorities")
      }
      const data = await response.json()
      setPriorities(data.priorities || data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPriorities()
  }, [])

  const handleCreatePriority = async () => {
    if (!createForm.name.trim()) {
      setError("Priority name is required")
      return
    }

    setIsCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/ticket/priority/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          priority: createForm.priority,
          color: createForm.color,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create priority")
      }

      setSuccess("Priority created successfully")
      setCreateDialogOpen(false)
      setCreateForm({ name: "", priority: 0, color: "#3b82f6" })
      fetchPriorities()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditPriority = async () => {
    if (!editForm.name.trim()) {
      setError("Priority name is required")
      return
    }

    setIsEditing(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/ticket/priority/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editForm.id,
          name: editForm.name.trim(),
          priority: editForm.priority,
          color: editForm.color,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update priority")
      }

      setSuccess("Priority updated successfully")
      setEditDialogOpen(false)
      fetchPriorities()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsEditing(false)
    }
  }

  const openEditDialog = (priority: Priority) => {
    setEditForm({
      id: priority.id,
      name: priority.name,
      priority: priority.priority,
      color: priority.color,
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

    const newPriorities = [...priorities]
    const draggedPriority = newPriorities[draggedIndex]
    newPriorities.splice(draggedIndex, 1)
    newPriorities.splice(dropIndex, 0, draggedPriority)

    // Update priorities based on new order
    const updatedPriorities = newPriorities.map((priority, index) => ({
      ...priority,
      priority: index,
    }))

    setPriorities(updatedPriorities)
    setDraggedIndex(null)
  }

  const savePriorityOrder = async () => {
    setIsSavingOrder(true)
    setError(null)
    setSuccess(null)

    try {
      const updates = priorities.map((priority, index) => ({
        id: priority.id,
        priority: index,
      }))

      const response = await fetch("/api/ticket/priority/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update priority order")
      }

      setSuccess("Priority order updated successfully")
      fetchPriorities()
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
        <h3 className="text-lg font-semibold flex items-center">
          <Flag className="h-5 w-5 mr-2" />
          Priorities ({priorities.length})
        </h3>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={savePriorityOrder} disabled={isSavingOrder}>
            {isSavingOrder && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Order
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Priority
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Priority</DialogTitle>
                <DialogDescription>Add a new ticket priority to the system.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Priority Name</Label>
                  <Input
                    id="create-name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="High Priority"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-priority">Priority Order</Label>
                  <Input
                    id="create-priority"
                    type="number"
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-color">Color</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="create-color"
                      type="color"
                      value={createForm.color}
                      onChange={(e) => setCreateForm({ ...createForm, color: e.target.value })}
                      className="w-16 h-10 p-1 border rounded"
                    />
                    <Input
                      value={createForm.color}
                      onChange={(e) => setCreateForm({ ...createForm, color: e.target.value })}
                      placeholder="#3b82f6"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreatePriority} disabled={isCreating}>
                  {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Priority
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Priorities Table with Drag and Drop */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b bg-muted/50">
            <p className="text-sm text-muted-foreground">
              Drag priorities to reorder them. Click "Save Order" to persist changes.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priorities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No priorities found
                  </TableCell>
                </TableRow>
              ) : (
                priorities.map((priority, index) => (
                  <TableRow
                    key={priority.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`cursor-move ${draggedIndex === index ? "opacity-50" : ""}`}
                  >
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-mono">{priority.priority}</TableCell>
                    <TableCell className="font-medium">{priority.name}</TableCell>
                    <TableCell className="font-mono text-sm">{priority.color}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: priority.color }} />
                        <span
                          className="px-2 py-1 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: priority.color }}
                        >
                          {priority.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(priority)}>
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

      {/* Edit Priority Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Priority</DialogTitle>
            <DialogDescription>Update priority information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Priority Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="High Priority"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-priority">Priority Order</Label>
              <Input
                id="edit-priority"
                type="number"
                value={editForm.priority}
                onChange={(e) => setEditForm({ ...editForm, priority: Number(e.target.value) })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-color">Color</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="edit-color"
                  type="color"
                  value={editForm.color}
                  onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  value={editForm.color}
                  onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditPriority} disabled={isEditing}>
              {isEditing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Priority
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
