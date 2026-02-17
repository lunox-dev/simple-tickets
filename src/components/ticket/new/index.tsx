"use client"

import { useState, useEffect, useCallback, useMemo, type ChangeEvent, type FormEvent } from "react"
import { ApiSelect } from "@/components/ticket/common/api-select"
import type { Content } from "@tiptap/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Loader2,
  AlertCircle,
  X,
  Link,
  Check,
  ChevronsUpDown,
  Users,
  FileText,
  Calendar,
  Flag,
  ArrowLeft,
} from "lucide-react"
import { SimpleRichTextEditor } from "@/components/ui/SimpleRichTextEditor"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

// Define types for API responses
interface Category {
  id: number
  name: string
  childDropdownLabel: string | null
  children: Category[]
}

interface FlatCategory {
  id: number
  name: string
  fullPath: string
  level: number
}

interface Priority {
  id: number
  name: string
  color: string
}

interface Status {
  id: number
  name: string
  color: string
}

interface Entity {
  entityId: string
  type: "team" | "user"
  name: string
  children?: Entity[]
}

interface FlatEntity {
  entityId: string
  name: string
  type: "team" | "user"
  fullPath: string
  level: number
}

interface CustomFieldDefinition {
  id: number
  label: string
  key: string
  regex: string | null
  required?: boolean
  type: string
  multiSelect: boolean
  ticketFieldGroup?: {
    id: number
    name: string
    description: string | null
  } | null
  apiConfig?: {
    dependsOnFieldKey?: string
    dependencyParam?: string
  }
}

interface CustomFieldValue {
  fieldDefinitionId: number
  value: string
}

export default function NewTicketForm() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState<Content>("")
  const [categories, setCategories] = useState<Category[]>([])
  const [flatCategories, setFlatCategories] = useState<FlatCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [selectedPriority, setSelectedPriority] = useState<string>("")
  const [statuses, setStatuses] = useState<Status[]>([])
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [entities, setEntities] = useState<Entity[]>([])
  const [flatEntities, setFlatEntities] = useState<FlatEntity[]>([])
  const [selectedEntity, setSelectedEntity] = useState<string>("")
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({})
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<number, string>>({})
  const [files, setFiles] = useState<File[]>([])

  // URL Dialog state
  const [urlDialogOpen, setUrlDialogOpen] = useState(false)
  const [urlName, setUrlName] = useState("")
  const [urlValue, setUrlValue] = useState("")
  const [urlAttachments, setUrlAttachments] = useState<{ name: string; url: string }[]>([])

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState("")

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { data: session } = useSession()

  // Function to flatten categories into a single list with full paths and hierarchy
  const flattenCategories = (categories: Category[], parentPath: string[] = [], level = 0): FlatCategory[] => {
    let result: FlatCategory[] = []
    categories.forEach((category) => {
      const currentPath = [...parentPath, category.name]
      result.push({
        id: category.id,
        name: category.name,
        fullPath: currentPath.join(" > "),
        level,
      })
      if (category.children && category.children.length > 0) {
        result = result.concat(flattenCategories(category.children, currentPath, level + 1))
      }
    })
    return result
  }

  // Function to flatten entities into a single list with full paths
  const flattenEntities = (entities: Entity[], parentPath: string[] = [], level = 0): FlatEntity[] => {
    let result: FlatEntity[] = []
    entities.forEach((entity) => {
      const currentPath = [...parentPath, entity.name]
      result.push({
        entityId: entity.entityId,
        name: entity.name,
        type: entity.type,
        fullPath: currentPath.join(" > "),
        level,
      })
      if (entity.children && entity.children.length > 0) {
        result = result.concat(flattenEntities(entity.children, currentPath, level + 1))
      }
    })
    return result
  }

  // Show full category path when selected (Parent > Child)
  const getSelectedCategoryDisplay = () => {
    if (!selectedCategory) return ""
    const category = flatCategories.find((cat) => cat.id.toString() === selectedCategory)
    return category ? category.fullPath : ""
  }

  // Get selected entity display name
  const getSelectedEntityDisplay = () => {
    if (!selectedEntity) return ""
    const entity = flatEntities.find((ent) => ent.entityId === selectedEntity)
    return entity ? `${entity.fullPath} (${entity.type})` : ""
  }

  // Debounce utility function
  function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout
    return ((...args: any[]) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }) as T
  }

  // Debounced validation function
  const debouncedValidation = useCallback(
    debounce((fieldId: number, value: string) => {
      const fieldDef = customFields.find((f) => f.id === fieldId)
      if (fieldDef && fieldDef.regex && value.trim() !== "") {
        try {
          const regex = new RegExp(fieldDef.regex)
          if (!regex.test(value)) {
            setCustomFieldErrors((prev) => ({
              ...prev,
              [fieldId]: `Invalid format for ${fieldDef.label}`,
            }))
          } else {
            setCustomFieldErrors((prev) => {
              const newErrors = { ...prev }
              delete newErrors[fieldId]
              return newErrors
            })
          }
        } catch {
          console.warn("Invalid regex in field definition:", fieldDef.regex)
        }
      } else {
        setCustomFieldErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors[fieldId]
          return newErrors
        })
      }
    }, 500),
    [customFields],
  )

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, priRes, statRes, entRes] = await Promise.all([
          fetch("/api/ticket/category/list"),
          fetch("/api/ticket/priority/list"),
          fetch("/api/ticket/status/list?createTicket=true"),
          fetch("/api/entity/list"),
        ])

        if (!catRes.ok || !priRes.ok || !statRes.ok || !entRes.ok) {
          throw new Error("Failed to fetch initial data")
        }

        const catData = await catRes.json()
        const priData = await priRes.json()
        const statData = await statRes.json()
        const entData = await entRes.json()

        setCategories(catData)
        setFlatCategories(flattenCategories(catData))
        setPriorities(priData.priorities || priData)
        setStatuses(statData)
        setEntities(entData)
        setFlatEntities(flattenEntities(entData))
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred")
      }
    }

    fetchData()
  }, [])

  // Fetch custom fields when category is selected
  useEffect(() => {
    if (selectedCategory) {
      const fetchCustomFields = async () => {
        try {
          const res = await fetch(`/api/ticket/field/list?categoryId=${selectedCategory}`)
          if (!res.ok) {
            const errorData = await res.json()
            throw new Error(errorData.error || `Failed to fetch custom fields`)
          }
          const data: CustomFieldDefinition[] = await res.json()
          setCustomFields(data)
          const initialValues: Record<number, string> = {}
          data.forEach((field) => {
            initialValues[field.id] = ""
          })
          setCustomFieldValues(initialValues)
          setCustomFieldErrors({})
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to fetch custom fields")
          setCustomFields([])
        }
      }
      fetchCustomFields()
    } else {
      setCustomFields([])
      setCustomFieldValues({})
      setCustomFieldErrors({})
    }
  }, [selectedCategory])

  const handleCustomFieldChange = (fieldId: number, value: string) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }))
    debouncedValidation(fieldId, value)
  }

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddUrl = () => {
    if (!urlName || !urlValue) return
    setUrlAttachments(prev => [...prev, { name: urlName, url: urlValue }])
    setUrlName("")
    setUrlValue("")
    setUrlDialogOpen(false)
  }

  const removeUrlAttachment = (index: number) => {
    setUrlAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!session?.user?.actingAs?.userTeamEntityId) {
      setError("No active team selected. Please refresh the page or contact support.")
      return
    }

    if (!title.trim() || !body || (typeof body === "string" && !body.trim())) {
      setError("Title and Body are required.")
      return
    }

    if (!selectedCategory) {
      setError("Please select a category.")
      return
    }

    if (!selectedEntity) {
      setError("Please assign the ticket.")
      return
    }

    for (const field of customFields) {
      if (field.required && !customFieldValues[field.id]?.trim()) {
        setError(`Field "${field.label}" is required.`)
        return
      }
      if (customFieldErrors[field.id]) {
        setError(`Please fix validation errors for "${field.label}".`)
        return
      }
    }

    setIsLoading(true)

    try {
      const payload: any = {
        title,
        body: typeof body === "string" ? body : ((body as any)?.toString?.() ?? ""),
        category: Number.parseInt(selectedCategory, 10),
        assignto: Number.parseInt(selectedEntity, 10),
        status: selectedStatus ? Number.parseInt(selectedStatus, 10) : 1,
        priority: selectedPriority ? Number.parseInt(selectedPriority, 10) : 2,
        fields: Object.entries(customFieldValues)
          .filter(([_, value]) => value && value.trim() !== "")
          .map(([id, value]) => ({
            fieldDefinitionId: Number.parseInt(id, 10),
            value,
          })),
        attachments: urlAttachments.map(u => ({ filePath: u.url, fileName: u.name, fileType: 'url' })),
        userTeamEntityId: session.user.actingAs.userTeamEntityId,
      }

      const formData = new FormData()
      formData.append('data', JSON.stringify(payload))

      files.forEach((f) => {
        formData.append('files', f)
      })

      const response = await fetch("/api/ticket/create", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create ticket")
      }

      const result = await response.json()
      setSuccessMessage(`Ticket created successfully! Ticket ID: ${result.ticket.id}`)

      // Reset
      setTitle("")
      setBody("")
      setSelectedCategory("")
      setSelectedEntity("")
      setSelectedStatus("")
      setSelectedPriority("")
      setCustomFields([])
      setCustomFieldValues({})
      setFiles([])

      // Navigate
      router.push(`/ticket/${result.ticket.id}`)

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }


  const filteredEntities = useMemo(() => {
    if (!assignSearch) return flatEntities
    return flatEntities.filter(
      (entity) =>
        entity.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
        entity.fullPath.toLowerCase().includes(assignSearch.toLowerCase()),
    )
  }, [flatEntities, assignSearch])

  const getEntityInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const renderField = (field: CustomFieldDefinition) => {
    const val = customFieldValues[field.id]
    const valParsed = field.multiSelect && val ? val.split(',') : (field.multiSelect ? [] : val)

    // Resolve Dependency
    let depParam: string | undefined
    let depValue: string | undefined

    if (field.apiConfig?.dependsOnFieldKey) {
      depParam = field.apiConfig.dependencyParam
      const parentField = customFields.find(f => f.key === field.apiConfig?.dependsOnFieldKey)
      if (parentField) {
        depValue = customFieldValues[parentField.id]
      }
    }

    return (
      <div key={field.id} className="space-y-2">
        <Label htmlFor={`custom-field-${field.id}`} className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>

        {(field.type === 'API_SELECT' || field.type === 'API_COMBINE') ? (
          <ApiSelect
            fieldId={field.id}
            value={valParsed}
            onChange={(v) => {
              handleCustomFieldChange(field.id, v as any)
            }}
            multiSelect={field.multiSelect}
            error={!!customFieldErrors[field.id]}
            dependencyParam={depParam}
            dependencyValue={depValue}
            required={field.required}
          />
        ) : (
          <Input
            id={`custom-field-${field.id}`}
            value={val as string || ""}
            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            className={cn("h-11", customFieldErrors[field.id] && "border-destructive focus:ring-destructive")}
          />
        )}

        {customFieldErrors[field.id] && <p className="text-xs text-destructive">{customFieldErrors[field.id]}</p>}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">

      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Create Ticket</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Fill in the details to create a new support ticket</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => router.back()} className="h-10">
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading} className="h-10 min-w-[140px]">
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isLoading ? "Creating..." : "Create Ticket"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error & Success Alerts */}
          {error && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="border-green-900/50 bg-green-900/20 text-green-300">
              <Check className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title Card */}
              <Card className="border-border/40 shadow-sm">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-semibold">
                      Ticket Title
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Brief description of the issue..."
                      className="h-12 text-base placeholder:text-muted-foreground/50"
                      required
                    />
                    <p className="text-xs text-muted-foreground">Provide a clear, concise title for your ticket</p>
                  </div>
                </CardContent>
              </Card>

              {/* Custom Fields Card */}
              {customFields.length > 0 && (() => {
                // Group fields
                const ungrouped = customFields.filter(f => !f.ticketFieldGroup)
                const grouped = customFields.reduce((acc, f) => {
                  if (f.ticketFieldGroup) {
                    const gid = f.ticketFieldGroup.id
                    if (!acc[gid]) acc[gid] = { group: f.ticketFieldGroup, fields: [] }
                    acc[gid].fields.push(f)
                  }
                  return acc
                }, {} as Record<number, { group: any, fields: CustomFieldDefinition[] }>)

                return (
                  <div className="space-y-6">
                    {/* Render Groups */}
                    {Object.values(grouped).map(({ group, fields }) => (
                      <Card key={group.id} className="border-border/40 shadow-sm">
                        <CardContent className="pt-6">
                          <h3 className="text-sm font-semibold mb-1">{group.name}</h3>
                          {group.description && <p className="text-xs text-muted-foreground mb-4">{group.description}</p>}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {fields.map(renderField)}
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* Render Ungrouped */}
                    {ungrouped.length > 0 && (
                      <Card className="border-border/40 shadow-sm">
                        <CardContent className="pt-6">
                          <h3 className="text-sm font-semibold mb-4">Additional Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {ungrouped.map(renderField)}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )
              })()}

              {/* Description + Attachments in ONE container */}
              <Card className="border-border/40 shadow-sm">
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Description</Label>
                      <div className="border border-border/40 rounded-lg overflow-hidden">
                        <SimpleRichTextEditor value={typeof body === "string" ? body : ""} onChange={(val) => setBody(val)} />
                      </div>
                      <p className="text-xs text-muted-foreground">Provide detailed information about the issue</p>
                    </div>

                    <div className="pt-4 border-t border-border/40">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Label className="text-sm font-semibold block">Attachments</Label>
                          <p className="text-xs text-muted-foreground mt-1">Add files or links to help describe your issue</p>
                        </div>

                        <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
                          <DialogTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="bg-transparent">
                              <Link className="h-4 w-4 mr-2" />
                              Add Link
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add URL</DialogTitle>
                              <DialogDescription>Add a web link to your ticket</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="url-name">Link Name</Label>
                                <Input
                                  id="url-name"
                                  placeholder="e.g., Related Issue"
                                  value={urlName}
                                  onChange={(e) => setUrlName(e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="url-value">URL</Label>
                                <Input
                                  id="url-value"
                                  placeholder="https://example.com"
                                  value={urlValue}
                                  onChange={(e) => setUrlValue(e.target.value)}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setUrlDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleAddUrl}>Add Link</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>

                      {/* URL Attachment List */}
                      {urlAttachments.length > 0 && (
                        <div className="space-y-2 mt-4 mb-4">
                          {urlAttachments.map((att, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 group"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <Link className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate text-blue-700 dark:text-blue-300">{att.name}</p>
                                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 truncate">
                                    {att.url}
                                  </p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeUrlAttachment(i)}
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100 dark:hover:bg-blue-900/30"
                              >
                                <X className="h-4 w-4 text-blue-500 hover:text-blue-700" />
                                <span className="sr-only">Remove</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* File Upload */}
                      <div className="mt-4">
                        <Label htmlFor="file-upload" className="sr-only">Upload files</Label>
                        <Input
                          id="file-upload"
                          type="file"
                          multiple
                          onChange={handleFileSelect}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF supported</p>
                      </div>

                      {/* Attachment List */}
                      {files.length > 0 && (
                        <div className="space-y-2 mt-4">
                          {files.map((file, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40 group"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{file.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {(file.size / 1024).toFixed(1)} KB
                                  </p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(i)}
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                <span className="sr-only">Remove</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>


            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* ONE container for Category, Status, Priority, Assign To */}
              <Card className="border-border/40 shadow-sm overflow-hidden">
                <div className="bg-muted/10 px-6 py-4 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Ticket Properties</h3>
                  </div>
                </div>
                <CardContent className="pt-6">

                  <div className="space-y-4">
                    {/* Category */}
                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-sm font-semibold">
                        Category
                      </Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger id="category" className="h-11">
                          <span className={cn("truncate", !selectedCategory && "text-muted-foreground")}>
                            {selectedCategory ? getSelectedCategoryDisplay() : "Select a category..."}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {flatCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              <span className="flex items-center">
                                {category.level > 0 && (
                                  <span className="mr-2 text-muted-foreground/40">
                                    {"\u00A0\u00A0".repeat(category.level)}↳
                                  </span>
                                )}
                                {category.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                      <Label htmlFor="status" className="text-sm font-semibold flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Status
                      </Label>
                      <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                        <SelectTrigger id="status" className="h-11">
                          <span className={cn(!selectedStatus && "text-muted-foreground")}>
                            {selectedStatus
                              ? statuses.find((s) => s.id.toString() === selectedStatus)?.name ?? "Selected"
                              : "Select status..."}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((status) => (
                            <SelectItem key={status.id} value={status.id.toString()}>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
                                {status.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Priority */}
                    <div className="space-y-2">
                      <Label htmlFor="priority" className="text-sm font-semibold flex items-center gap-2">
                        <Flag className="h-4 w-4" />
                        Priority
                      </Label>
                      <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                        <SelectTrigger id="priority" className="h-11">
                          <span className={cn(!selectedPriority && "text-muted-foreground")}>
                            {selectedPriority
                              ? priorities.find((p) => p.id.toString() === selectedPriority)?.name ?? "Selected"
                              : "Select priority..."}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {priorities.map((priority) => (
                            <SelectItem key={priority.id} value={priority.id.toString()}>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: priority.color }} />
                                {priority.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Assign To */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Assign To
                      </Label>
                      <Popover open={assignOpen} onOpenChange={setAssignOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={assignOpen}
                            className="w-full h-11 justify-between bg-transparent"
                          >
                            <span className="truncate">{selectedEntity ? getSelectedEntityDisplay() : "Select assignee..."}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Search teams or users..."
                              value={assignSearch}
                              onValueChange={setAssignSearch}
                            />
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandList>
                              <CommandGroup>
                                {filteredEntities.map((entity) => (
                                  <CommandItem
                                    key={entity.entityId}
                                    value={entity.entityId}
                                    onSelect={() => {
                                      setSelectedEntity(entity.entityId)
                                      setAssignOpen(false)
                                      setAssignSearch("")
                                    }}
                                    className="cursor-pointer aria-selected:bg-muted/50"
                                  >
                                    <div
                                      className="flex items-center gap-2 w-full"
                                      style={{ paddingLeft: `${entity.level * 1}rem` }}
                                    >
                                      {entity.level > 0 && (
                                        <span className="text-muted-foreground/40 mr-1">↳</span>
                                      )}
                                      <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                          {getEntityInitials(entity.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate text-foreground">{entity.name}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">{entity.type === 'team' ? 'Team' : entity.fullPath}</p>
                                      </div>
                                      <Badge variant="secondary" className="text-[10px] h-4 px-1 rounded-sm border-border text-muted-foreground font-normal ml-auto flex-shrink-0">
                                        {entity.type === 'team' ? 'Team' : 'User'}
                                      </Badge>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      {selectedEntity && (
                        <div className="p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                          <p className="font-medium text-foreground">{getSelectedEntityDisplay()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
