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
import { Loader2, Plus, Edit, AlertCircle, GripVertical, CheckCircle } from "lucide-react"

interface Status {
  id: number
  name: string
  priority: number
  color: string
}

interface CreateStatusForm {
  name: string
  priority: number
  color: string
}

interface EditStatusForm {
  id: number
  name: string
  priority: number
  color: string
}

export default function StatusManagement() {
  const [statuses, setStatuses] = useState<Status[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Create status dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateStatusForm>({
    name: "",
    priority: 0,
    color: "#10b981",
  })
  const [isCreating, setIsCreating] = useState(false)

  // Edit status dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditStatusForm>({
    id: 0,
    name: "",
    priority: 0,
    color: "#10b981",
  })
  const [isEditing, setIsEditing] = useState(false)

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isSavingOrder, setIsSavingOrder] = useState(false)

  const fetchStatuses = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/ticket/status/list")
      if (!response.ok) {
        throw new Error("Failed to fetch statuses")
      }
      const data = await response.json()
      setStatuses(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStatuses()
  }, [])

  const handleCreateStatus = async () => {
    if (!createForm.name.trim()) {
      setError("Status name is required")
      return
    }

    setIsCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/ticket/status/create", {
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
        throw new Error(errorData.error || "Failed to create status")
      }

      setSuccess("Status created successfully")
      setCreateDialogOpen(false)
      setCreateForm({ name: "", priority: 0, color: "#10b981" })
      fetchStatuses()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditStatus = async () => {
    if (!editForm.name.trim()) {
      setError("Status name is required")
      return
    }

    setIsEditing(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/ticket/status/manage", {
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
        throw new Error(errorData.error || "Failed to update status")
      }

      setSuccess("Status updated successfully")
      setEditDialogOpen(false)
      fetchStatuses()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsEditing(false)
    }
  }

  const openEditDialog = (status: Status) => {
    setEditForm({
      id: status.id,
      name: status.name,
      priority: status.priority,
      color: status.color,
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

    const newStatuses = [...statuses]
    const draggedStatus = newStatuses[draggedIndex]
    newStatuses.splice(draggedIndex, 1)
    newStatuses.splice(dropIndex, 0, draggedStatus)

    // Update priorities based on new order
    const updatedStatuses = newStatuses.map((status, index) => ({
      ...status,
      priority: index,
    }))

    setStatuses(updatedStatuses)
    setDraggedIndex(null)
  }

  const saveStatusOrder = async () => {
    setIsSavingOrder(true)
    setError(null)
    setSuccess(null)

    try {
      const updates = statuses.map((status, index) => ({
        id: status.id,
        priority: index,
      }))

      const response = await fetch("/api/ticket/status/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update status order")
      }

      setSuccess("Status order updated successfully")
      fetchStatuses()
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
          <CheckCircle className="h-5 w-5 mr-2" />
          Statuses ({statuses.length})
        </h3>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={saveStatusOrder} disabled={isSavingOrder}>
            {isSavingOrder && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Order
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Status
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Status</DialogTitle>
                <DialogDescription>Add a new ticket status to the system.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Status Name</Label>
                  <Input
                    id="create-name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="In Progress"
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
                      placeholder="#10b981"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateStatus} disabled={isCreating}>
                  {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Status
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statuses Table with Drag and Drop */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b bg-muted/50">
            <p className="text-sm text-muted-foreground">
              Drag statuses to reorder them. Click "Save Order" to persist changes.
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
              {statuses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No statuses found
                  </TableCell>
                </TableRow>
              ) : (
                statuses.map((status, index) => (
                  <TableRow
                    key={status.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`cursor-move ${draggedIndex === index ? "opacity-50" : ""}`}
                  >
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-mono">{status.priority}</TableCell>
                    <TableCell className="font-medium">{status.name}</TableCell>
                    <TableCell className="font-mono text-sm">{status.color}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: status.color }} />
                        <span
                          className="px-2 py-1 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: status.color }}
                        >
                          {status.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(status)}>
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

      {/* Edit Status Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Status</DialogTitle>
            <DialogDescription>Update status information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Status Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="In Progress"
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
                  placeholder="#10b981"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditStatus} disabled={isEditing}>
              {isEditing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
