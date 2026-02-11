'use client'

import React, { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from '@/components/ui/badge'

interface ApiSelectProps {
    fieldId: number
    value: string | string[] // ID or array of IDs
    onChange: (val: string | string[]) => void
    multiSelect?: boolean
    disabled?: boolean
    error?: boolean
    dependencyParam?: string
    dependencyValue?: string
    required?: boolean
}

export function ApiSelect(props: ApiSelectProps) {
    const { fieldId, value, onChange, multiSelect, disabled, error, dependencyParam, dependencyValue, required } = props
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [options, setOptions] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    // Clear selection if dependency changes and current value is not valid anymore?
    // Or just refetch options.
    useEffect(() => {
        if (dependencyParam && !dependencyValue) {
            setOptions([])
            return
        }
        fetchOptions(query)
    }, [query, fieldId, dependencyValue])

    const fetchOptions = async (q: string) => {
        setLoading(true)
        try {
            let url = `/api/ticket/field/fetch-options?fieldDefinitionId=${fieldId}&query=${encodeURIComponent(q)}`
            if (dependencyParam && dependencyValue) {
                url += `&${dependencyParam}=${encodeURIComponent(dependencyValue)}`
            }

            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data)) setOptions(data)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    // Handle Selection
    const handleSelect = (val: string) => {
        if (multiSelect) {
            const current = Array.isArray(value) ? value : (value ? [value] : [])
            if (current.includes(val)) {
                onChange(current.filter(c => c !== val))
            } else {
                onChange([...current, val])
            }
        } else {
            onChange(val)
            setOpen(false)
        }
    }

    // Display text logic
    const selectedLabel = React.useMemo(() => {
        if (multiSelect) {
            const current = Array.isArray(value) ? value : (value ? [value] : [])
            return current.length > 0 ? `${current.length} selected` : "Select..."
        }
        const opt = options.find(o => o.value === value)
        return opt ? opt.label : (value || "Select...")
    }, [value, options, multiSelect])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", error && "border-destructive")}
                    disabled={disabled}
                >
                    <div className="flex items-center gap-2 truncate">
                        {(() => {
                            if (multiSelect) return selectedLabel
                            const opt = options.find(o => o.value === value)
                            // If option not found (not loaded yet?), just show value or label if we have it? 
                            // Actually selectedLabel handles the fallback.
                            // But for image, we need the opt.
                            return (
                                <>
                                    {opt?.metadata?.image && (
                                        <img src={opt.metadata.image} alt="" className="w-5 h-5 rounded object-contain bg-white border" />
                                    )}
                                    <span className="truncate">{selectedLabel}</span>
                                </>
                            )
                        })()}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Search..." value={query} onValueChange={setQuery} />
                    <CommandList>
                        {loading && <div className="p-2 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>}
                        {!loading && options.length === 0 && <CommandEmpty>No results found.</CommandEmpty>}
                        <CommandGroup>
                            {/* Clear Option for optional fields */}
                            {!multiSelect && !disabled && !props.required && value && (
                                <CommandItem
                                    value="__clear__"
                                    onSelect={() => {
                                        onChange("")
                                        setOpen(false)
                                    }}
                                    className="text-muted-foreground italic"
                                >
                                    <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                                    -- Select --
                                </CommandItem>
                            )}

                            {options.map((option) => {
                                const isSelected = multiSelect
                                    ? (Array.isArray(value) && value.includes(option.value))
                                    : value === option.value

                                const hasMetadata = option.metadata && Object.keys(option.metadata).length > 0

                                return (
                                    <CommandItem
                                        key={option.value}
                                        value={option.value}
                                        onSelect={() => handleSelect(option.value)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                isSelected ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col">
                                            <span>{option.label}</span>
                                            {option.metadata?.description && <span className="text-xs text-muted-foreground">{option.metadata.description}</span>}
                                        </div>
                                        {option.metadata?.image && (
                                            <img
                                                src={option.metadata.image}
                                                alt=""
                                                className="ml-auto w-6 h-6 rounded object-contain bg-white border"
                                            />
                                        )}
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
