"use client"

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Edit, AlertCircle, FolderTree } from "lucide-react"

interface Category {
  id: number
  name: string
  childDropdownLabel: string | null
  children: Category[]
}

interface FlatCategory {
  id: number
  name: string
  childDropdownLabel: string | null
  parentId: number | null
  level: number
  fullPath: string
}

interface CreateCategoryForm {
  name: string
  childDropdownLabel: string
  parentId: number | null
  priority: number
}

interface EditCategoryForm {
  id: number
  name: string
  childDropdownLabel: string
  parentId: number | null
  priority: number
}

export default function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([])
  const [flatCategories, setFlatCategories] = useState<FlatCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Create category dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateCategoryForm>({
    name: "",
    childDropdownLabel: "",
    parentId: null,
    priority: 0,
  })
  const [isCreating, setIsCreating] = useState(false)

  // Edit category dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditCategoryForm>({
    id: 0,
    name: "",
    childDropdownLabel: "",
    parentId: null,
    priority: 0,
  })
  const [isEditing, setIsEditing] = useState(false)

  // Flatten categories for display and parent selection
  const flattenCategories = (
    categories: Category[],
    parentPath: string[] = [],
    level = 0,
    parentId: number | null = null,
  ): FlatCategory[] => {
    let result: FlatCategory[] = []

    categories.forEach((category) => {
      const currentPath = [...parentPath, category.name]

      result.push({
        id: category.id,
        name: category.name,
        childDropdownLabel: category.childDropdownLabel,
        parentId,
        level,
        fullPath: currentPath.join(" > "),
      })

      if (category.children && category.children.length > 0) {
        result = result.concat(flattenCategories(category.children, currentPath, level + 1, category.id))
      }
    })

    return result
  }

  const fetchCategories = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/ticket/category/list")
      if (!response.ok) {
        throw new Error("Failed to fetch categories")
      }
      const data = await response.json()
      setCategories(data)
      setFlatCategories(flattenCategories(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const handleCreateCategory = async () => {
    if (!createForm.name.trim()) {
      setError("Category name is required")
      return
    }

    setIsCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/ticket/category/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          childDropdownLabel: createForm.childDropdownLabel.trim() || null,
          parentId: createForm.parentId,
          priority: createForm.priority,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create category")
      }

      setSuccess("Category created successfully")
      setCreateDialogOpen(false)
      setCreateForm({ name: "", childDropdownLabel: "", parentId: null, priority: 0 })
      fetchCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditCategory = async () => {
    if (!editForm.name.trim()) {
      setError("Category name is required")
      return
    }

    setIsEditing(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/ticket/category/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editForm.id,
          name: editForm.name.trim(),
          childDropdownLabel: editForm.childDropdownLabel.trim() || null,
          parentId: editForm.parentId,
          priority: editForm.priority,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update category")
      }

      setSuccess("Category updated successfully")
      setEditDialogOpen(false)
      fetchCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsEditing(false)
    }
  }

  const openEditDialog = (category: FlatCategory) => {
    setEditForm({
      id: category.id,
      name: category.name,
      childDropdownLabel: category.childDropdownLabel || "",
      parentId: category.parentId,
      priority: 0, // We don't have priority in the list response
    })
    setEditDialogOpen(true)
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
          <FolderTree className="h-5 w-5 mr-2" />
          Categories ({flatCategories.length})
        </h3>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Category</DialogTitle>
              <DialogDescription>Add a new ticket category to the system.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Category Name</Label>
                <Input
                  id="create-name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Bug Reports"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-parent">Parent Category</Label>
                <Select
                  value={createForm.parentId?.toString() || "0"} // Updated default value to be a non-empty string
                  onValueChange={(value) => setCreateForm({ ...createForm, parentId: value ? Number(value) : null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No Parent (Root Category)</SelectItem> // Updated value to be a non-empty
                    string
                    {flatCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {"\u00A0".repeat(cat.level * 4)}
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-child-label">Child Dropdown Label</Label>
                <Input
                  id="create-child-label"
                  value={createForm.childDropdownLabel}
                  onChange={(e) => setCreateForm({ ...createForm, childDropdownLabel: e.target.value })}
                  placeholder="Select subcategory (optional)"
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateCategory} disabled={isCreating}>
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Child Dropdown Label</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flatCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No categories found
                  </TableCell>
                </TableRow>
              ) : (
                flatCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <span style={{ marginLeft: `${category.level * 20}px` }}>
                          {category.level > 0 && "└─ "}
                          {category.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {category.childDropdownLabel || <span className="text-muted-foreground italic">None</span>}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">Level {category.level}</span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(category)}>
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

      {/* Edit Category Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update category information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Category Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Bug Reports"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-parent">Parent Category</Label>
              <Select
                value={editForm.parentId?.toString() || "0"} // Updated default value to be a non-empty string
                onValueChange={(value) => setEditForm({ ...editForm, parentId: value ? Number(value) : null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No Parent (Root Category)</SelectItem> // Updated value to be a non-empty string
                  {flatCategories
                    .filter((cat) => cat.id !== editForm.id) // Don't allow self as parent
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {"\u00A0".repeat(cat.level * 4)}
                        {cat.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-child-label">Child Dropdown Label</Label>
              <Input
                id="edit-child-label"
                value={editForm.childDropdownLabel}
                onChange={(e) => setEditForm({ ...editForm, childDropdownLabel: e.target.value })}
                placeholder="Select subcategory (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-priority">Priority</Label>
              <Input
                id="edit-priority"
                type="number"
                value={editForm.priority}
                onChange={(e) => setEditForm({ ...editForm, priority: Number(e.target.value) })}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditCategory} disabled={isEditing}>
              {isEditing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
