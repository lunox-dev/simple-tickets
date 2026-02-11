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
import { ApiSelect } from "@/components/ticket/common/api-select"

interface FilterPanelProps {
  filters: FilterState
  setFilters: Dispatch<SetStateAction<FilterState>>
  statuses: Status[]
  priorities: Priority[]
  flatCategories: FlatCategory[]
  flatEntities: FlatEntity[]
  customFieldDefinitions: any[] // Should define type properly but using any for now or imported type
  onFilterChange: () => void
}

export function FilterPanel({
  filters,
  setFilters,
  statuses,
  priorities,
  flatCategories,
  flatEntities,
  customFieldDefinitions = [],
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
      customFields: {}
    })
    onFilterChange()
  }

  return (
    <aside className="w-72 border-r bg-card h-screen sticky top-0 flex flex-col shadow-sm">
      <div className="px-5 py-6 border-b flex items-center justify-between bg-muted/20">
        <h2 className="text-base font-semibold text-foreground">Filters</h2>
        {(filters.statuses.length > 0 ||
          filters.priorities.length > 0 ||
          filters.categories.length > 0 ||
          filters.assignedEntities.length > 0 ||
          filters.createdByEntities.length > 0 ||
          filters.fromDate ||
          filters.search) && (
            <Button
              variant="ghost"
              className="p-0 h-auto text-xs text-primary hover:text-primary/80 font-medium"
              onClick={clearFilters}
            >
              Clear All
            </Button>
          )}
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8 scrollbar-thin">
        {/* Search */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              className="pl-9 h-9 text-sm bg-background border-border focus:bg-card transition-colors"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</Label>
          <div className="space-y-2.5">
            {statuses.map((status) => (
              <div key={status.id} className="flex items-center space-x-2.5">
                <Checkbox
                  id={`status-${status.id}`}
                  checked={filters.statuses.includes(status.id)}
                  onCheckedChange={() => handleMultiSelectChange("statuses", status.id)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <label
                  htmlFor={`status-${status.id}`}
                  className="flex items-center space-x-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground select-none w-full"
                >
                  <div className="w-2.5 h-2.5 rounded-full ring-1 ring-inset ring-border" style={{ backgroundColor: status.color }} />
                  <span>{status.name}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Filter */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</Label>
          <div className="space-y-2.5">
            {priorities.map((priority) => (
              <div key={priority.id} className="flex items-center space-x-2.5">
                <Checkbox
                  id={`priority-${priority.id}`}
                  checked={filters.priorities.includes(priority.id)}
                  onCheckedChange={() => handleMultiSelectChange("priorities", priority.id)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <label
                  htmlFor={`priority-${priority.id}`}
                  className="flex items-center space-x-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground select-none w-full"
                >
                  <div className="w-2.5 h-2.5 rounded-full ring-1 ring-inset ring-border" style={{ backgroundColor: priority.color }} />
                  <span>{priority.name}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</Label>
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-2 scrollbar-thumb-muted scrollbar-track-transparent scrollbar-thin">
            {flatCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center space-x-2.5"
                style={{ marginLeft: `${category.level * 1.25}rem` }}
              >
                {category.level > 0 && (
                  <div className="w-px h-3 bg-border mr-1 self-center" />
                )}
                <Checkbox
                  id={`category-${category.id}`}
                  checked={filters.categories.includes(category.id)}
                  onCheckedChange={() => handleMultiSelectChange("categories", category.id)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <label
                  htmlFor={`category-${category.id}`}
                  className="text-sm text-muted-foreground cursor-pointer hover:text-foreground select-none w-full truncate"
                >
                  {category.name}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Assigned To Filter */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned To</Label>
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-2 scrollbar-thumb-muted scrollbar-track-transparent scrollbar-thin">
            {flatEntities.map((entity) => (
              <div
                key={entity.entityId}
                className="flex items-center space-x-2.5"
                style={{ marginLeft: `${entity.level * 1.25}rem` }}
              >
                <Checkbox
                  id={`assigned-${entity.entityId}`}
                  checked={filters.assignedEntities.includes(Number(entity.entityId))}
                  onCheckedChange={() => handleMultiSelectChange("assignedEntities", Number(entity.entityId))}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <label
                  htmlFor={`assigned-${entity.entityId}`}
                  className="text-sm text-muted-foreground cursor-pointer hover:text-foreground select-none w-full truncate"
                >
                  {entity.name}
                  <span className="text-xs text-muted-foreground/70 ml-1 font-normal">({entity.type})</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Fields Filter */}
        {customFieldDefinitions.length > 0 && (
          <div className="space-y-6 pt-4 border-t">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom Fields</Label>
            {customFieldDefinitions.map(field => {
              const val = (filters.customFields || {})[field.id] || ""

              // For dependency logic in filters:
              let depParam = undefined
              let depValue = undefined
              if (field.apiConfig?.dependsOnFieldKey) {
                depParam = field.apiConfig.dependencyParam
                const parent = customFieldDefinitions.find((f: any) => f.key === field.apiConfig?.dependsOnFieldKey)
                if (parent) {
                  depValue = (filters.customFields || {})[parent.id]
                }
              }

              return (
                <div key={field.id} className="space-y-2">
                  <Label className="text-xs text-muted-foreground" htmlFor={`filter-field-${field.id}`}>{field.label}</Label>
                  <ApiSelect
                    fieldId={field.id}
                    value={val}
                    onChange={(v) => {
                      const newVal = Array.isArray(v) ? v.join(',') : v
                      const newCustom = { ...(filters.customFields || {}), [field.id]: newVal }
                      if (!newVal) delete newCustom[field.id]
                      setFilters(prev => ({ ...prev, customFields: newCustom }))
                      onFilterChange()
                    }}
                    dependencyParam={depParam}
                    dependencyValue={depValue}
                  // Filtering doesn't usually require validation, so no 'required' passed
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Date Range Filter */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("justify-start text-left font-normal bg-background border-border h-9 px-3 text-xs", !filters.fromDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {filters.fromDate ? format(filters.fromDate, "MMM d") : "Start"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
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
                  className={cn("justify-start text-left font-normal bg-background border-border h-9 px-3 text-xs", !filters.toDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {filters.toDate ? format(filters.toDate, "MMM d") : "End"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
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
