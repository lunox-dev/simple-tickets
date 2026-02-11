"use client"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings } from "lucide-react"

type ColumnVisibility = {
    [key: string]: boolean
}

interface ColumnConfigProps {
    columnVisibility: ColumnVisibility
    onVisibilityChange: (visibility: ColumnVisibility) => void
    displayFields: any[]
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

const DEFAULT_COLUMNS = [
    { key: "id", label: "ID", mandatory: true },
    { key: "status", label: "Status", mandatory: false },
    { key: "priority", label: "Priority", mandatory: false },
    { key: "subject", label: "Subject", mandatory: false },
    { key: "requester", label: "Requester", mandatory: false },
    { key: "assignedTo", label: "Assigned To", mandatory: false },
    { key: "updated", label: "Updated", mandatory: false },
]

export function ColumnConfig({
    columnVisibility,
    onVisibilityChange,
    displayFields,
    isOpen,
    onOpenChange,
}: ColumnConfigProps) {
    const handleToggle = (key: string, isMandatory: boolean) => {
        if (isMandatory) return // Prevent toggling mandatory columns
        onVisibilityChange({
            ...columnVisibility,
            [key]: !columnVisibility[key],
        })
    }

    return (
        <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="border-border hover:bg-muted"
                >
                    <Settings className="h-4 w-4 mr-2" />
                    Columns
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">
                    Standard Columns
                </DropdownMenuLabel>
                {DEFAULT_COLUMNS.map((col) => (
                    <DropdownMenuCheckboxItem
                        key={col.key}
                        checked={columnVisibility[col.key] ?? true}
                        onCheckedChange={() => handleToggle(col.key, col.mandatory)}
                        disabled={col.mandatory}
                        className={col.mandatory ? "opacity-50 cursor-not-allowed" : ""}
                    >
                        <div className="flex items-center gap-2 w-full">
                            <span className="flex-1">{col.label}</span>
                            {col.mandatory && (
                                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    Required
                                </span>
                            )}
                        </div>
                    </DropdownMenuCheckboxItem>
                ))}

                {displayFields.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">
                            Custom Fields
                        </DropdownMenuLabel>
                        {displayFields.map((field) => (
                            <DropdownMenuCheckboxItem
                                key={`field_${field.id}`}
                                checked={columnVisibility[`field_${field.id}`] ?? true}
                                onCheckedChange={() => handleToggle(`field_${field.id}`, false)}
                            >
                                {field.label}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
