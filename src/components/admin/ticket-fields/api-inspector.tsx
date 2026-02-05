'use client'

import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash, Play, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ApiConfig {
    url: string
    method: string
    headers: Record<string, string>
    arrayPath: string
    valuePath: string
    labelPath: string
    imagePath?: string
    descriptionPath?: string
    dependsOnFieldKey?: string
    dependencyParam?: string
    dependencyMode?: 'URL_PARAM' | 'LOCAL_FILTER'
    nestedPath?: string
}

interface ApiInspectorProps {
    config?: ApiConfig
    onChange: (config: ApiConfig) => void
}

export function ApiInspector({ config, onChange }: ApiInspectorProps) {
    const [url, setUrl] = useState(config?.url || '')
    const [method, setMethod] = useState(config?.method || 'GET')
    const [headers, setHeaders] = useState<{ key: string, value: string }[]>(
        config?.headers ? Object.entries(config.headers).map(([k, v]) => ({ key: k, value: v })) : []
    )

    // Path selection state
    const [arrayPath, setArrayPath] = useState(config?.arrayPath || '')
    const [valuePath, setValuePath] = useState(config?.valuePath || '')
    const [labelPath, setLabelPath] = useState(config?.labelPath || '')

    const [loading, setLoading] = useState(false)
    const [response, setResponse] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [step, setStep] = useState<'config' | 'inspect' | 'fields'>('config')

    // Helper to update parent
    const updateConfig = (updates: Partial<ApiConfig>) => {
        const headerObj = headers.reduce((acc, curr) => {
            if (curr.key) acc[curr.key] = curr.value
            return acc
        }, {} as Record<string, string>)

        onChange({
            ...config!, // Persist existing props (like dependency settings)
            url,
            method,
            headers: headerObj,
            arrayPath,
            valuePath,
            labelPath,
            ...updates
        })
    }

    const runTest = async () => {
        setLoading(true)
        setError(null)
        setResponse(null)
        try {
            const headerObj = headers.reduce((acc, curr) => {
                if (curr.key) acc[curr.key] = curr.value
                return acc
            }, {} as Record<string, string>)

            const res = await fetch('/api/ticket/field/test-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, method, headers: headerObj })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Request failed')
            setResponse(data)
            setStep('inspect')
            updateConfig({}) // save current url/method
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleHeaderChange = (index: number, field: 'key' | 'value', val: string) => {
        const newHeaders = [...headers]
        newHeaders[index][field] = val
        setHeaders(newHeaders)
    }

    const addHeader = () => setHeaders([...headers, { key: '', value: '' }])
    const removeHeader = (index: number) => setHeaders(headers.filter((_, i) => i !== index))

    // Resolving data for preview
    const resolvedArray = resolvePath(response, arrayPath)
    const isArrayValid = Array.isArray(resolvedArray)
    const firstItem = isArrayValid && resolvedArray.length > 0 ? resolvedArray[0] : null

    return (
        <div className="space-y-4 border rounded-md p-4 bg-card">
            <div className="grid gap-4">
                <div className="grid grid-cols-[1fr,120px] gap-2">
                    <div className="space-y-1">
                        <Label>API Endpoint URL</Label>
                        <Input
                            placeholder="https://api.example.com/v1/data"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Method</Label>
                        <Select value={method} onValueChange={setMethod}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Headers</Label>
                        <Button variant="ghost" size="sm" onClick={addHeader}><Plus className="w-3 h-3 mr-1" />Add</Button>
                    </div>
                    {headers.map((h, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <Input placeholder="Key" value={h.key} onChange={e => handleHeaderChange(i, 'key', e.target.value)} className="h-8" />
                            <Input placeholder="Value" value={h.value} onChange={e => handleHeaderChange(i, 'value', e.target.value)} className="h-8" />
                            <Button variant="ghost" size="icon" onClick={() => removeHeader(i)} className="h-8 w-8"><Trash className="w-3 h-3 text-destructive" /></Button>
                        </div>
                    ))}
                </div>

                <Button onClick={runTest} disabled={loading || !url}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    Test API & Configure Paths
                </Button>
            </div>

            {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
                    Error: {error}
                </div>
            )}

            {response && (
                <div className="mt-4 border-t pt-4">
                    <h3 className="font-medium mb-3">Response Inspector</h3>
                    <Tabs value={step} onValueChange={(v: any) => setStep(v)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="inspect" className="text-xs">1. Select Array</TabsTrigger>
                            <TabsTrigger value="fields" disabled={!isArrayValid} className="text-xs">2. Select Fields</TabsTrigger>
                        </TabsList>

                        <TabsContent value="inspect" className="space-y-2 mt-2">
                            <p className="text-xs text-muted-foreground">Click on the array property you want to iterate over.</p>
                            {Array.isArray(response) && (
                                <div className="flex items-center justify-between border p-2 rounded bg-muted/50">
                                    <span className="text-xs">API returned a list as the root element.</span>
                                    <Button size="sm" variant="secondary" onClick={() => {
                                        setArrayPath('$')
                                        updateConfig({ arrayPath: '$' })
                                        setStep('fields')
                                    }}>Use Root List</Button>
                                </div>
                            )}
                            <Card className="h-[300px] overflow-hidden border-dashed">
                                <ScrollArea className="h-full p-2 font-mono text-xs">
                                    <JsonViewer
                                        data={response}
                                        onSelect={(path: string, val: any) => {
                                            if (Array.isArray(val)) {
                                                setArrayPath(path)
                                                updateConfig({ arrayPath: path })
                                                setStep('fields')
                                            }
                                        }}
                                        selectedPath={arrayPath}
                                        filter={(val: any) => Array.isArray(val)}
                                    />
                                </ScrollArea>
                            </Card>
                            {arrayPath && (
                                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                                    <Check className="w-4 h-4" /> Selected Array: <strong>{arrayPath || '(root)'}</strong>
                                    <span className="text-muted-foreground ml-auto">Found {resolvedArray?.length ?? 0} items</span>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="fields" className="space-y-4 mt-2">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Value Field (ID)</Label>
                                        <Input value={valuePath} onChange={e => { setValuePath(e.target.value); updateConfig({ valuePath: e.target.value }) }} placeholder="e.g. id" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Label Field</Label>
                                        <Input value={labelPath} onChange={e => { setLabelPath(e.target.value); updateConfig({ labelPath: e.target.value }) }} placeholder="e.g. name" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Image Path (Optional)</Label>
                                        <Input value={config?.imagePath || ''} onChange={e => updateConfig({ imagePath: e.target.value })} placeholder="e.g. logo" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Description Path (Optional)</Label>
                                        <Input value={config?.descriptionPath || ''} onChange={e => updateConfig({ descriptionPath: e.target.value })} placeholder="e.g. email" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">Select properties from the first item:</p>
                                <Card className="h-[200px] overflow-hidden bg-muted/30">
                                    <ScrollArea className="h-full p-2 font-mono text-xs">
                                        {firstItem ? (
                                            <JsonViewer
                                                data={firstItem}
                                                onSelect={(path: string, val: any) => {
                                                    // Simple heuristic: if looks like name, propose key + label?
                                                    // Just allow assigning to active input? 
                                                    // For now, toggle: if valuePath empty, fill it. else fill labelPath.
                                                    if (!valuePath) {
                                                        setValuePath(path)
                                                        updateConfig({ valuePath: path })
                                                    } else if (!labelPath) {
                                                        setLabelPath(path)
                                                        updateConfig({ labelPath: path })
                                                    } else {
                                                        // Toggle between image and description if value/label set?
                                                        // Maybe just fill into the last focused field? 
                                                        // Or just prompt? 
                                                        // Let's cycle: Value -> Label -> Image -> Description
                                                        if (!config?.imagePath) updateConfig({ imagePath: path })
                                                        else updateConfig({ descriptionPath: path })
                                                    }
                                                }}
                                                rootName="item"
                                            />
                                        ) : (
                                            <div className="p-4 text-muted-foreground">No items in array to inspect</div>
                                        )}
                                    </ScrollArea>
                                </Card>
                            </div>

                            <div className="border rounded p-2 bg-muted/10">
                                <p className="text-xs font-medium mb-1">Preview (First 3 items):</p>
                                {isArrayValid && resolvedArray?.slice(0, 3).map((item: any, i: number) => {
                                    const val = resolvePath(item, valuePath)
                                    const lab = resolvePath(item, labelPath)
                                    const img = resolvePath(item, config?.imagePath || '')
                                    const desc = resolvePath(item, config?.descriptionPath || '')

                                    return (
                                        <div key={i} className="text-xs flex gap-2 border-b last:border-0 py-1 items-center">
                                            {img && <img src={String(img)} alt="" className="w-5 h-5 rounded object-cover" />}
                                            <div className="flex flex-col">
                                                <div className="flex gap-2 items-center">
                                                    <Badge variant="outline" className="h-4 text-[10px]">{String(val)}</Badge>
                                                    <span className="font-medium">{String(lab)}</span>
                                                </div>
                                                {desc && <span className="text-muted-foreground text-[10px]">{String(desc)}</span>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="pt-2 border-t">
                                <p className="text-xs font-medium mb-2">Dependency Configuration (Optional)</p>
                                <div className="grid grid-cols-2 gap-4 mb-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Depends On (Field Key)</Label>
                                        <Input value={config?.dependsOnFieldKey || ''} onChange={e => updateConfig({ dependsOnFieldKey: e.target.value })} placeholder="e.g. bank_id" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Mode</Label>
                                        <Select value={config?.dependencyMode || 'URL_PARAM'} onValueChange={v => updateConfig({ dependencyMode: v as any })}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="URL_PARAM">URL Parameter</SelectItem>
                                                <SelectItem value="LOCAL_FILTER">Local Filter (Nested)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs">
                                            {config?.dependencyMode === 'LOCAL_FILTER' ? 'Match Property (Parent ID)' : 'Inject into API Param'}
                                        </Label>
                                        <Input value={config?.dependencyParam || ''} onChange={e => updateConfig({ dependencyParam: e.target.value })} placeholder={config?.dependencyMode === 'LOCAL_FILTER' ? 'e.g. id' : 'e.g. brandId'} />
                                    </div>
                                    {config?.dependencyMode === 'LOCAL_FILTER' && (
                                        <div className="space-y-1">
                                            <Label className="text-xs">Sub-Array Path</Label>
                                            <Input value={config?.nestedPath || ''} onChange={e => updateConfig({ nestedPath: e.target.value })} placeholder="e.g. channels" />
                                        </div>
                                    )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    {config?.dependencyMode === 'LOCAL_FILTER'
                                        ? "Fetches the list, finds the item where 'Match Property' equals the parent value, then extracts 'Sub-Array Path'."
                                        : "Reloads options when parent changes, filtering by appending ?param=value."}
                                </p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            )}
        </div>
    )
}

// Simple recursive JSON viewer with selection
function JsonViewer({ data, path = '', onSelect, selectedPath, filter, rootName }: any) { // Keeping structure simple, but explicit types would be better.
    if (typeof data === 'object' && data !== null) {
        const isArray = Array.isArray(data)
        const entries = Object.entries(data)

        return (
            <ul className="pl-3 border-l ml-1">
                {path === '' && rootName && <li className="text-muted-foreground mb-1">{rootName}:</li>}
                {entries.map(([key, value]) => {
                    // Use simple dot notation
                    const cleanPath = path ? `${path}.${key}` : key

                    const isSelected = selectedPath === cleanPath
                    const canSelect = onSelect && (!filter || filter(value))

                    return (
                        <li key={key} className="my-0.5">
                            <span
                                className={cn(
                                    "mr-1 text-muted-foreground",
                                    canSelect && "cursor-pointer hover:text-primary hover:underline",
                                    isSelected && "font-bold text-primary bg-primary/10 px-1 rounded"
                                )}
                                onClick={(e) => {
                                    if (canSelect) {
                                        e.stopPropagation()
                                        onSelect(cleanPath, value)
                                    }
                                }}
                            >
                                {key}:
                            </span>
                            {typeof value === 'object' && value !== null ? (
                                <span className="text-muted-foreground/50 text-[10px]">{Array.isArray(value) ? `Array[${value.length}]` : '{...}'}</span>
                            ) : (
                                <span className="text-green-600 dark:text-green-400">"{String(value)}"</span>
                            )}

                            {(typeof value === 'object' && value !== null) && (
                                <JsonViewer data={value} path={cleanPath} onSelect={onSelect} selectedPath={selectedPath} filter={filter} />
                            )}
                        </li>
                    )
                })}
            </ul>
        )
    }
    return null
}

function resolvePath(obj: any, pathStr: string) {
    if (pathStr === '$') return obj
    if (!pathStr || !obj) return undefined
    const path = pathStr.split('.')
    let current = obj
    for (const key of path) {
        if (current === undefined || current === null) return undefined
        current = current[key]
    }
    return current
}
