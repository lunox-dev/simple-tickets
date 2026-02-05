'use client'

import React, { useState, useEffect } from "react"
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
import { Loader2, Plus, AlertCircle, Layers } from "lucide-react"
import { FieldEditor } from "../ticket-fields/field-editor"

interface FieldGroup {
    id: number
    name: string
    description: string | null
    _count?: {
        fields: number
    }
}

export default function FieldGroupManagement() {
    const [groups, setGroups] = useState<FieldGroup[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [manageOpen, setManageOpen] = useState(false)
    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

    // Create dialog
    const [createOpen, setCreateOpen] = useState(false)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [creating, setCreating] = useState(false)

    const fetchGroups = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/ticket/group/list')
            if (res.ok) {
                const data = await res.json()
                setGroups(data)
            } else {
                throw new Error("Failed to fetch groups")
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchGroups()
    }, [])

    const handleCreate = async () => {
        if (!name) return
        setCreating(true)
        try {
            const res = await fetch('/api/ticket/group/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            })
            if (!res.ok) {
                const d = await res.json()
                throw new Error(d.error || 'Failed to create group')
            }
            setCreateOpen(false)
            setName('')
            setDescription('')
            fetchGroups()
        } catch (err: any) {
            alert(err.message)
        } finally {
            setCreating(false)
        }
    }

    return (
        <div className="space-y-6">
            <GroupManager
                open={manageOpen}
                onOpenChange={setManageOpen}
                groupId={selectedGroupId}
                onUpdate={() => {
                    fetchGroups()
                    setManageOpen(false)
                }}
            />

            {/* Actions */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold flex items-center">
                    <Layers className="h-5 w-5 mr-2" />
                    Field Groups ({groups.length})
                </h3>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Group
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Field Group</DialogTitle>
                            <DialogDescription>Group custom fields together visually.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Customer Details" />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Fields Count</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={4} className="text-center py-4"><Loader2 className="animate-spin inline mr-2" /> Loading...</TableCell></TableRow>
                            ) : groups.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No groups found</TableCell></TableRow>
                            ) : (
                                groups.map(g => (
                                    <TableRow key={g.id}>
                                        <TableCell className="font-medium">{g.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{g.description || '-'}</TableCell>
                                        <TableCell>{g._count?.fields || 0}</TableCell>
                                        <TableCell>
                                            <Button variant="outline" size="sm" onClick={() => {
                                                setSelectedGroupId(g.id)
                                                setManageOpen(true)
                                            }}>
                                                Manage
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

function GroupManager({ open, onOpenChange, groupId, onUpdate }: { open: boolean, onOpenChange: (o: boolean) => void, groupId: number | null, onUpdate: () => void }) {
    const [group, setGroup] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<any[]>([])
    const [fields, setFields] = useState<any[]>([])

    // Edit Form State
    const [name, setName] = useState('')
    const [desc, setDesc] = useState('')
    const [selectedCats, setSelectedCats] = useState<number[]>([])

    // Load data
    useEffect(() => {
        if (open && groupId) {
            setLoading(true)
            Promise.all([
                fetch('/api/ticket/group/list').then(r => r.json()), // Ideally fetch single group details or find in list
                fetch('/api/ticket/category/list').then(r => r.json()),
                fetch(`/api/ticket/field/list?groupId=${groupId}`).then(r => r.json())
            ]).then(([groupsData, catsData, fieldsData]) => {
                const g = groupsData.find((x: any) => x.id === groupId)
                if (g) {
                    setGroup(g)
                    setName(g.name)
                    setDesc(g.description || '')
                    // Extract category IDs
                    const cIds = g.categories?.map((c: any) => c.ticketCategoryId) || []
                    setSelectedCats(cIds)
                }
                setCategories(catsData)
                setFields(fieldsData)
            }).finally(() => setLoading(false))
        }
    }, [open, groupId])

    const handleSaveGeneral = async () => {
        if (!groupId) return
        try {
            const res = await fetch('/api/ticket/group/update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: groupId,
                    name,
                    description: desc,
                    categoryIds: selectedCats
                })
            })
            if (!res.ok) throw new Error('Failed to update')
            onUpdate()
        } catch (e) {
            alert('Error updating group')
        }
    }

    const handleDeleteGroup = async () => {
        if (!confirm('Are you sure you want to delete this group? Fields will be unlinked (not deleted).')) return
        try {
            const res = await fetch('/api/ticket/group/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: groupId })
            })
            if (!res.ok) throw new Error('Failed')
            onUpdate()
        } catch (e) {
            alert('Failed to delete group')
        }
    }

    const handleDeleteField = async (fId: number) => {
        if (!confirm('Are you sure? All data for this field will be lost.')) return
        try {
            const res = await fetch('/api/ticket/field/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: fId })
            })
            if (!res.ok) throw new Error('Failed')
            setFields(fields.filter(f => f.id !== fId))
        } catch (e) {
            alert('Failed to delete field')
        }
    }

    /* Rendering Helpers */
    const flattenTree = (nodes: any[], level = 0, parentPath: string[] = []): any[] => {
        let res: any[] = []
        nodes.forEach(node => {
            const currentPath = [...parentPath, node.name]
            res.push({
                ...node,
                level,
                fullPath: currentPath.join(" > ")
            })
            if (node.children && node.children.length > 0) {
                res = res.concat(flattenTree(node.children, level + 1, currentPath))
            }
        })
        return res
    }
    const flatCats = flattenTree(categories)

    if (!groupId) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Manage Group: {group?.name}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* General Settings */}
                    <div className="grid gap-4 border p-4 rounded-md">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold">General & Access</h4>
                            <Button variant="destructive" size="sm" onClick={handleDeleteGroup}>Delete Group</Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input value={desc} onChange={e => setDesc(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Applicable Categories</Label>
                            <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                                {flatCats.map(cat => (
                                    <div key={cat.id} className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedCats.includes(cat.id)}
                                            onChange={e => {
                                                if (e.target.checked) setSelectedCats([...selectedCats, cat.id])
                                                else setSelectedCats(selectedCats.filter(id => id !== cat.id))
                                            }}
                                            className="rounded border-gray-300"
                                        />
                                        <span className="text-sm" style={{ paddingLeft: cat.level * 16 }}>
                                            {cat.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <Button onClick={handleSaveGeneral} size="sm" className="w-fit">Save General Settings</Button>
                    </div>

                    {/* Fields */}
                    <div className="border p-4 rounded-md space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold">Fields ({fields.length})</h4>
                            <FieldEditor
                                defaultGroupId={groupId}
                                onSaved={() => {
                                    // Refresh fields
                                    fetch(`/api/ticket/field/list?groupId=${groupId}`).then(r => r.json()).then(setFields)
                                }}
                                trigger={<Button size="sm">Add Field to Group</Button>}
                            />
                        </div>
                        <div className="space-y-2">
                            {fields.length === 0 ? <div className="text-muted-foreground text-sm italic">No fields in this group.</div> : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Label</TableHead>
                                            <TableHead>Key</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Required</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map(f => (
                                            <TableRow key={f.id}>
                                                <TableCell>{f.label}</TableCell>
                                                <TableCell className="font-mono text-xs">{f.key}</TableCell>
                                                <TableCell>{f.type}</TableCell>
                                                <TableCell>
                                                    <span className={f.activeInCreate ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                                                        {f.activeInCreate ? "Active" : "Archived"}
                                                    </span>
                                                </TableCell>
                                                <TableCell>{f.requiredAtCreation ? 'Yes' : 'No'}</TableCell>
                                                <TableCell className="flex gap-2">
                                                    <FieldEditor
                                                        initialData={f}
                                                        defaultGroupId={groupId}
                                                        onSaved={() => {
                                                            fetch(`/api/ticket/field/list?groupId=${groupId}`).then(r => r.json()).then(setFields)
                                                        }}
                                                        trigger={<Button variant="outline" size="sm">Edit</Button>}
                                                    />
                                                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteField(f.id)}>
                                                        Delete
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
