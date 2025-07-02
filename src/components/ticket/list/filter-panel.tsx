"use client"

import type { Dispatch, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Search, CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import type { FilterState, Status, Priority, FlatCategory, FlatEntity } from "./types"

interface FilterPanelProps {
  filters: FilterState
  setFilters: Dispatch<SetStateAction<FilterState>>
  statuses: Status[]
  priorities: Priority[]
  flatCategories: FlatCategory[]
  flatEntities: FlatEntity[]
  onFilterChange: () => void
}

export function FilterPanel({
  filters,
  setFilters,
  statuses,
  priorities,
  flatCategories,
  flatEntities,
  onFilterChange,
}: FilterPanelProps) {
  const handleFilterChange = (change: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...change }))
    onFilterChange()
  }

  const handleMultiSelectChange = (
    field: "statuses" | "priorities" | "categories" | "assignedEntities" | "createdByEntities",
    id: number,
  ) => {
    const currentValues = filters[field] as number[]
    const newValues = currentValues.includes(id) ? currentValues.filter((val) => val !== id) : [...currentValues, id]
    handleFilterChange({ [field]: newValues })
  }

  const clearFilters = () => {
    setFilters({
      search: "",
      statuses: [],
      priorities: [],
      categories: [],
      assignedEntities: [],
      createdByEntities: [],
      fromDate: null,
      toDate: null,
      includeUserTeamsForTeams: false,
      includeUserTeamsForCreatedByTeams: false,
    })
    onFilterChange()
  }

  return (
    <aside className="w-80 border-r border-gray-200 h-screen sticky top-0 flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
        <Button variant="link" className="p-0 h-auto text-sm" onClick={clearFilters}>
          Clear All
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Search */}
        <div className="space-y-2">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <Label>Status</Label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {statuses.map((status) => (
              <div key={status.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${status.id}`}
                  checked={filters.statuses.includes(status.id)}
                  onCheckedChange={() => handleMultiSelectChange("statuses", status.id)}
                />
                <label htmlFor={`status-${status.id}`} className="flex items-center space-x-2 text-sm cursor-pointer">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                  <span>{status.name}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Filter */}
        <div className="space-y-2">
          <Label>Priority</Label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {priorities.map((priority) => (
              <div key={priority.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`priority-${priority.id}`}
                  checked={filters.priorities.includes(priority.id)}
                  onCheckedChange={() => handleMultiSelectChange("priorities", priority.id)}
                />
                <label
                  htmlFor={`priority-${priority.id}`}
                  className="flex items-center space-x-2 text-sm cursor-pointer"
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: priority.color }} />
                  <span>{priority.name}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div className="space-y-2">
          <Label>Category</Label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {flatCategories.map((category) => (
              <div key={category.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category.id}`}
                  checked={filters.categories.includes(category.id)}
                  onCheckedChange={() => handleMultiSelectChange("categories", category.id)}
                />
                <label
                  htmlFor={`category-${category.id}`}
                  className="text-sm cursor-pointer"
                  style={{ paddingLeft: `${category.level * 16}px` }}
                >
                  {category.level > 0 && "└─ "}
                  {category.name}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Assigned To Filter */}
        <div className="space-y-2">
          <Label>Assigned To</Label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {flatEntities.map((entity) => (
              <div key={entity.entityId} className="flex items-center space-x-2">
                <Checkbox
                  id={`assigned-${entity.entityId}`}
                  checked={filters.assignedEntities.includes(Number(entity.entityId))}
                  onCheckedChange={() => handleMultiSelectChange("assignedEntities", Number(entity.entityId))}
                />
                <label
                  htmlFor={`assigned-${entity.entityId}`}
                  className="text-sm cursor-pointer"
                  style={{ paddingLeft: `${entity.level * 16}px` }}
                >
                  {entity.level > 0 && "└─ "}
                  {entity.name} ({entity.type})
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Created By Filter */}
        <div className="space-y-2">
          <Label>Created By</Label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {flatEntities.map((entity) => (
              <div key={entity.entityId} className="flex items-center space-x-2">
                <Checkbox
                  id={`created-by-${entity.entityId}`}
                  checked={filters.createdByEntities.includes(Number(entity.entityId))}
                  onCheckedChange={() => handleMultiSelectChange("createdByEntities", Number(entity.entityId))}
                />
                <label
                  htmlFor={`created-by-${entity.entityId}`}
                  className="text-sm cursor-pointer"
                  style={{ paddingLeft: `${entity.level * 16}px` }}
                >
                  {entity.level > 0 && "└─ "}
                  {entity.name} ({entity.type})
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="space-y-2">
          <Label>Date Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("justify-start text-left font-normal", !filters.fromDate && "text-gray-500")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.fromDate ? format(filters.fromDate, "MMM d") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.fromDate || undefined}
                  onSelect={(date) => handleFilterChange({ fromDate: date || null })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("justify-start text-left font-normal", !filters.toDate && "text-gray-500")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.toDate ? format(filters.toDate, "MMM d") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.toDate || undefined}
                  onSelect={(date) => handleFilterChange({ toDate: date || null })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </aside>
  )
}
