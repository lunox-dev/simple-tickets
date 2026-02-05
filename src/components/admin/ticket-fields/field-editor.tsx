'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ApiInspector } from './api-inspector'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export function FieldEditor({ categoryId, defaultGroupId, onSaved, trigger, initialData }: { categoryId?: number, defaultGroupId?: number, onSaved?: () => void, trigger?: React.ReactNode, initialData?: any }) {
    const props = { categoryId, defaultGroupId, onSaved, trigger, initialData }
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Form State
    const [label, setLabel] = useState('')
    const [key, setKey] = useState('')
    const [type, setType] = useState('TEXT')
    const [required, setRequired] = useState(false)
    const [multiSelect, setMultiSelect] = useState(false)
    const [activeInCreate, setActiveInCreate] = useState(true)
    const [activeInRead, setActiveInRead] = useState(true)
    const [priority, setPriority] = useState('0')
    const [apiConfig, setApiConfig] = useState<any>(null)
    const [groupId, setGroupId] = useState<string>(defaultGroupId ? String(defaultGroupId) : 'none')

    const [availableGroups, setAvailableGroups] = useState<any[]>([])

    // Load initial data if provided (Edit Mode)
    useEffect(() => {
        if (open && props.initialData) {
            const f = props.initialData
            setLabel(f.label)
            setKey(f.key)
            setType(f.type)
            setRequired(f.requiredAtCreation)
            setMultiSelect(f.multiSelect)
            setActiveInCreate(f.activeInCreate !== false) // default true
            setActiveInRead(f.activeInRead !== false)
            setPriority(String(f.priority || 0))
            setApiConfig(f.apiConfig)
            if (f.ticketFieldGroup) {
                setGroupId(String(f.ticketFieldGroup.id))
            } else if (f.ticketFieldGroupId) {
                setGroupId(String(f.ticketFieldGroupId))
            } else {
                setGroupId('none')
            }
        } else if (open && !props.initialData) {
            // Reset for create mode
            setLabel('')
            setKey('')
            setType('TEXT')
            setRequired(false)
            setMultiSelect(false)
            setActiveInCreate(true)
            setActiveInRead(true)
            setPriority('0')
            setApiConfig(null)
            if (defaultGroupId) setGroupId(String(defaultGroupId))
            else setGroupId('none')
        }
    }, [open, props.initialData, defaultGroupId])

    // Fetch groups when dialog opens
    useEffect(() => {
        if (open) {
            fetch('/api/ticket/group/list').then(r => r.json()).then(data => {
                if (Array.isArray(data)) setAvailableGroups(data)
            })
        }
    }, [open])

    const handleSave = async () => {
        if (!label) return

        setLoading(true)
        try {
            const isEdit = !!props.initialData?.id
            const url = isEdit ? '/api/ticket/field/update' : '/api/ticket/field/create'
            const method = isEdit ? 'PATCH' : 'POST'

            const payload: any = {
                label,
                key,
                type,
                requiredAtCreation: required,
                priority: parseInt(priority) || 0,
                regex: "", // todo
                multiSelect,
                apiConfig: type.startsWith('API') ? apiConfig : undefined,
                ticketFieldGroupId: groupId !== 'none' ? parseInt(groupId) : undefined,
                activeInCreate,
                activeInRead
            }

            if (isEdit) {
                payload.id = props.initialData.id
            } else {
                payload.applicableCategoryId = categoryId || undefined
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })


            if (!res.ok) {
                const err = await res.json()
                alert(err.error || 'Failed to save')
                return
            }

            setOpen(false)
            onSaved?.()
            // Reset form?
            setLabel('')
            setApiConfig(null)
        } catch (err) {
            console.error(err)
            alert('Error saving field')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <Button>Add Field</Button>}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{props.initialData ? 'Edit Field' : 'Add Custom Field'}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Label</Label>
                            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Customer Name" />
                        </div>
                        <div className="space-y-2">
                            <Label>Key</Label>
                            <Input value={key} onChange={e => setKey(e.target.value)} placeholder="e.g. customer_id" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TEXT">Text</SelectItem>
                                    <SelectItem value="API_SELECT">API Select (Dropdown)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Priority (Order)</Label>
                            <Input
                                type="number"
                                value={priority}
                                onChange={e => setPriority(e.target.value)}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Group</Label>
                            <Select value={groupId} onValueChange={setGroupId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="No Group" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Group</SelectItem>
                                    {availableGroups.map((g: any) => (
                                        <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <div className="flex items-center space-x-2 border p-3 rounded-md">
                            <Checkbox id="req" checked={required} onCheckedChange={(c: any) => setRequired(!!c)} />
                            <Label htmlFor="req">Required</Label>
                        </div>
                        <div className="flex items-center space-x-2 border p-3 rounded-md">
                            <Checkbox id="multi" checked={multiSelect} onCheckedChange={(c: any) => setMultiSelect(!!c)} />
                            <Label htmlFor="multi">Multi-Select</Label>
                        </div>
                        <div className="flex items-center space-x-2 border p-3 rounded-md">
                            <Checkbox id="aic" checked={activeInCreate} onCheckedChange={(c: any) => setActiveInCreate(!!c)} />
                            <Label htmlFor="aic">Show in Create</Label>
                        </div>
                        <div className="flex items-center space-x-2 border p-3 rounded-md">
                            <Checkbox id="air" checked={activeInRead} onCheckedChange={(c: any) => setActiveInRead(!!c)} />
                            <Label htmlFor="air">Show in View</Label>
                        </div>
                    </div>

                    {type.startsWith('API') && (
                        <div className="mt-4">
                            <h4 className="mb-2 text-sm font-semibold">API Configuration</h4>
                            <ApiInspector config={apiConfig} onChange={setApiConfig} />
                        </div>
                    )}

                    <Button onClick={handleSave} disabled={loading} className="w-full mt-4">
                        {loading ? 'Saving...' : 'Save Field'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
