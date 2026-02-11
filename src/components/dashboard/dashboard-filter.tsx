"use client"

import * as React from "react"
import { Check, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { DashboardFilterState } from "./types"

interface DashboardFilterProps {
    statuses: { id: number; name: string; color: string }[]
    priorities: { id: number; name: string; color: string }[]
    filters: DashboardFilterState
    setFilters: React.Dispatch<React.SetStateAction<DashboardFilterState>>
}

export function DashboardFilter({
    statuses,
    priorities,
    filters,
    setFilters,
}: DashboardFilterProps) {
    const selectedStatusIds = new Set(filters.statusIds)
    const selectedPriorityIds = new Set(filters.priorityIds)
    const count = selectedStatusIds.size + selectedPriorityIds.size

    const toggleStatus = (id: number) => {
        const newIds = new Set(selectedStatusIds)
        if (newIds.has(id)) {
            newIds.delete(id)
        } else {
            newIds.add(id)
        }
        setFilters({ ...filters, statusIds: Array.from(newIds) })
    }

    const togglePriority = (id: number) => {
        const newIds = new Set(selectedPriorityIds)
        if (newIds.has(id)) {
            newIds.delete(id)
        } else {
            newIds.add(id)
        }
        setFilters({ ...filters, priorityIds: Array.from(newIds) })
    }

    const clearFilters = () => {
        setFilters({ statusIds: [], priorityIds: [] })
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 border-dashed">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                    {count > 0 && (
                        <>
                            <div className="mx-2 h-4 w-[1px] bg-border" />
                            <Badge
                                variant="secondary"
                                className="rounded-sm px-1 font-normal lg:hidden"
                            >
                                {count}
                            </Badge>
                            <div className="hidden space-x-1 lg:flex">
                                {count > 2 ? (
                                    <Badge
                                        variant="secondary"
                                        className="rounded-sm px-1 font-normal"
                                    >
                                        {count} selected
                                    </Badge>
                                ) : (
                                    <>
                                        {statuses
                                            .filter((s) => selectedStatusIds.has(s.id))
                                            .map((s) => (
                                                <Badge
                                                    key={`s-${s.id}`}
                                                    variant="secondary"
                                                    className="rounded-sm px-1 font-normal"
                                                    style={{
                                                        backgroundColor: `${s.color}20`,
                                                        color: s.color,
                                                        borderColor: `${s.color}40`,
                                                        borderWidth: 1
                                                    }}
                                                >
                                                    {s.name}
                                                </Badge>
                                            ))}
                                        {priorities
                                            .filter((p) => selectedPriorityIds.has(p.id))
                                            .map((p) => (
                                                <Badge
                                                    key={`p-${p.id}`}
                                                    variant="secondary"
                                                    className="rounded-sm px-1 font-normal"
                                                    style={{
                                                        backgroundColor: `${p.color}20`,
                                                        color: p.color,
                                                        borderColor: `${p.color}40`,
                                                        borderWidth: 1
                                                    }}
                                                >
                                                    {p.name}
                                                </Badge>
                                            ))}
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Filter..." />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup heading="Status">
                            {statuses.map((status) => {
                                const isSelected = selectedStatusIds.has(status.id)
                                return (
                                    <CommandItem
                                        key={status.id}
                                        onSelect={() => toggleStatus(status.id)}
                                    >
                                        <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}
                                        >
                                            <Check className={cn("h-4 w-4")} />
                                        </div>
                                        <span>{status.name}</span>
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup heading="Priority">
                            {priorities.map((priority) => {
                                const isSelected = selectedPriorityIds.has(priority.id)
                                return (
                                    <CommandItem
                                        key={priority.id}
                                        onSelect={() => togglePriority(priority.id)}
                                    >
                                        <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}
                                        >
                                            <Check className={cn("h-4 w-4")} />
                                        </div>
                                        <span>{priority.name}</span>
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                        {count > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={clearFilters}
                                        className="justify-center text-center"
                                    >
                                        Clear filters
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
