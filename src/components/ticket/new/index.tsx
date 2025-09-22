"use client"

import { useState, useEffect, useCallback, useMemo, type ChangeEvent, type FormEvent } from "react"
import type { Content } from "@tiptap/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
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
  UploadCloud,
  X,
  Link,
  Check,
  ChevronsUpDown,
  Users,
  User,
  FileText,
  Calendar,
  Flag,
  Target,
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
  regex: string | null
  required?: boolean
}

interface CustomFieldValue {
  fieldDefinitionId: number
  value: string
}

interface AttachmentFile {
  id: string
  name: string
  url: string
  size?: number
  type: "file" | "url"
  uploading?: boolean
  error?: string
  file?: File
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
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState("")

  // URL Dialog state
  const [urlDialogOpen, setUrlDialogOpen] = useState(false)
  const [urlName, setUrlName] = useState("")
  const [urlValue, setUrlValue] = useState("")

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { data: session } = useSession()

  // Function to flatten categories into a single list with full paths and hierarchy
  const flattenCategories = (categories: Category[], parentPath: string[] = [], level = 0): FlatCategory[] => {
    let result: FlatCategory[] = []
    categories.forEach((category) => {
      const currentPath = [...parentPath, category.name]
      // Add current category (both parent and leaf categories are selectable)
      result.push({
        id: category.id,
        name: category.name,
        fullPath: currentPath.join(" > "),
        level,
      })
      // Recursively add children
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
      // Add current entity
      result.push({
        entityId: entity.entityId,
        name: entity.name,
        type: entity.type,
        fullPath: currentPath.join(" > "),
        level,
      })
      // Recursively add children
      if (entity.children && entity.children.length > 0) {
        result = result.concat(flattenEntities(entity.children, currentPath, level + 1))
      }
    })
    return result
  }

  // Get selected category display name
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
        } catch (e) {
          console.warn("Invalid regex in field definition:", fieldDef.regex)
        }
      } else {
        // Clear error if field is empty or no regex
        setCustomFieldErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors[fieldId]
          return newErrors
        })
      }
    }, 500),
    [customFields],
  )

  // Debounce utility function
  function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout
    return ((...args: any[]) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }) as T
  }

  // Upload file to attachment endpoint
  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("path", "ticket-attachments")

    const response = await fetch("/api/attachment/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Upload failed")
    }

    const data = await response.json()
    return data.filePath
  }

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, priRes, statRes, entRes] = await Promise.all([
          fetch("/api/ticket/category/list"),
          fetch("/api/ticket/priority/list"),
          fetch("/api/ticket/status/list"),
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
    // Use debounced validation
    debouncedValidation(fieldId, value)
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files).map((file) => ({
        id: Math.random().toString(36).substring(2, 15),
        name: file.name,
        url: "",
        size: file.size,
        type: "file" as const,
        uploading: true,
        file,
      }))

      setAttachments((prev) => [...prev, ...newFiles])

      // Upload each file
      for (const attachment of newFiles) {
        try {
          const url = await uploadFile(attachment.file!)
          setAttachments((prev) =>
            prev.map((att) => (att.id === attachment.id ? { ...att, url, uploading: false } : att)),
          )
        } catch (error) {
          setAttachments((prev) =>
            prev.map((att) =>
              att.id === attachment.id
                ? { ...att, uploading: false, error: error instanceof Error ? error.message : "Upload failed" }
                : att,
            ),
          )
        }
      }
    }
  }

  const handleAddUrl = () => {
    if (!urlName.trim() || !urlValue.trim()) {
      return
    }

    try {
      // Validate URL
      new URL(urlValue)
      const newAttachment: AttachmentFile = {
        id: Math.random().toString(36).substring(2, 15),
        name: urlName.trim(),
        url: urlValue.trim(),
        type: "url",
      }

      setAttachments((prev) => [...prev, newAttachment])
      setUrlName("")
      setUrlValue("")
      setUrlDialogOpen(false)
    } catch (error) {
      // Invalid URL
      setError("Please enter a valid URL")
    }
  }

  const removeAttachment = (idToRemove: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== idToRemove))
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

    if (!selectedStatus) {
      setError("Please select a status.")
      return
    }

    if (!selectedPriority) {
      setError("Please select a priority.")
      return
    }

    // Check if any files are still uploading
    const uploadingFiles = attachments.filter((att) => att.uploading)
    if (uploadingFiles.length > 0) {
      setError("Please wait for all files to finish uploading.")
      return
    }

    // Check for upload errors
    const failedUploads = attachments.filter((att) => att.error)
    if (failedUploads.length > 0) {
      setError("Some files failed to upload. Please remove them and try again.")
      return
    }

    // Validate required custom fields
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

    const payloadFields: CustomFieldValue[] = Object.entries(customFieldValues)
      .filter(([_, value]) => value.trim() !== "")
      .map(([id, value]) => ({
        fieldDefinitionId: Number.parseInt(id, 10),
        value,
      }))

    // Build attachment payload
    const attachmentPayload = attachments
      .filter((att) => att.url && !att.error)
      .map((att) => ({
        filePath: att.url,
        ...(att.size && { fileSize: att.size }),
        ...(att.file && { fileType: att.file.type }),
      }))

    const ticketData = {
      title,
      body: typeof body === "string" ? body : ((body as any)?.toString?.() ?? ""),
      category: Number.parseInt(selectedCategory, 10),
      assignto: Number.parseInt(selectedEntity, 10),
      status: Number.parseInt(selectedStatus, 10),
      priority: Number.parseInt(selectedPriority, 10),
      fields: payloadFields,
      attachments: attachmentPayload,
      userTeamEntityId: session?.user?.actingAs?.userTeamEntityId, // Add this line
    }

    try {
      const response = await fetch("/api/ticket/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ticketData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create ticket")
      }

      const result = await response.json()
      setSuccessMessage(`Ticket created successfully! Ticket ID: ${result.ticket.id}`)

      // Reset form
      setTitle("")
      setBody("")
      setSelectedCategory("")
      setSelectedEntity("")
      setSelectedStatus("")
      setSelectedPriority("")
      setCustomFields([])
      setCustomFieldValues({})
      setAttachments([])
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-8">
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main Content - Left Side */}
          <div className="xl:col-span-2 space-y-6">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/50">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {successMessage && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-200">
                <Check className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Ticket Details</CardTitle>
                <CardDescription>Provide the essential information for your ticket</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Title */}
                  <div className="space-y-3">
                    <Label htmlFor="title" className="text-base font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Title
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter a clear, descriptive title for your ticket"
                      className="text-base h-12 bg-white dark:bg-slate-900"
                      required
                    />
                  </div>

                  {/* Custom Fields */}
                  {customFields.length > 0 && (
                    <div className="space-y-4">
                      <Separator />
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Additional Information</h3>
                        {customFields.map((field) => (
                          <div key={field.id} className="space-y-2">
                            <Label htmlFor={`custom-field-${field.id}`} className="flex items-center gap-2">
                              {field.label}
                              {field.required && (
                                <Badge variant="destructive" className="text-xs">
                                  Required
                                </Badge>
                              )}
                            </Label>
                            <Input
                              id={`custom-field-${field.id}`}
                              value={customFieldValues[field.id] || ""}
                              onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                              placeholder={`Enter ${field.label}`}
                              pattern={field.regex || undefined}
                              required={field.required}
                              className="bg-white dark:bg-slate-900"
                            />
                            {customFieldErrors[field.id] && (
                              <p className="text-sm text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {customFieldErrors[field.id]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Body */}
                  <div className="space-y-3">
                    <Separator />
                    <Label className="text-base font-medium">Description</Label>
                    <div className="border rounded-lg bg-white dark:bg-slate-900">
                      <SimpleRichTextEditor
                        value={typeof body === "string" ? body : ""}
                        onChange={setBody}
                        placeholder="Provide a detailed description of the issue or request..."
                        className="min-h-[200px] w-full"
                        editorContentClassName="p-5 rounded"
                        autofocus
                        editable
                      />
                    </div>
                  </div>

                  {/* Attachments */}
                  <div className="space-y-4">
                    <Separator />
                    <Label className="text-base font-medium flex items-center gap-2">
                      <UploadCloud className="h-4 w-4" />
                      Attachments
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* File Upload */}
                      <Label
                        htmlFor="attachments"
                        className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-900"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <UploadCloud className="w-5 h-5 text-slate-500" />
                          <div className="text-center">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-slate-500">Files up to 10MB</p>
                          </div>
                        </div>
                        <Input id="attachments" type="file" className="hidden" multiple onChange={handleFileChange} />
                      </Label>

                      {/* URL Input */}
                      <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-24 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-900"
                            type="button"
                          >
                            <div className="flex items-center justify-center space-x-2">
                              <Link className="w-5 h-5 text-slate-500" />
                              <div className="text-center">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  <span className="font-semibold">Add URL</span>
                                </p>
                                <p className="text-xs text-slate-500">Link to external resource</p>
                              </div>
                            </div>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Add URL Attachment</DialogTitle>
                            <DialogDescription>
                              Enter a name and URL for the attachment you want to add.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="url-name">Name</Label>
                              <Input
                                id="url-name"
                                value={urlName}
                                onChange={(e) => setUrlName(e.target.value)}
                                placeholder="Enter attachment name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="url-value">URL</Label>
                              <Input
                                id="url-value"
                                value={urlValue}
                                onChange={(e) => setUrlValue(e.target.value)}
                                placeholder="https://example.com/file.pdf"
                                type="url"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setUrlDialogOpen(false)
                                setUrlName("")
                                setUrlValue("")
                              }}
                            >
                              Cancel
                            </Button>
                            <Button type="button" onClick={handleAddUrl} disabled={!urlName.trim() || !urlValue.trim()}>
                              Add Attachment
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {attachments.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-slate-600 dark:text-slate-400">Attached Files:</h4>
                        <div className="space-y-2">
                          {attachments.map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border"
                            >
                              <div className="flex items-center space-x-3 flex-1">
                                <div className="flex items-center space-x-2">
                                  {att.type === "file" ? (
                                    <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded">
                                      <UploadCloud className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                  ) : (
                                    <div className="p-1 bg-green-100 dark:bg-green-900 rounded">
                                      <Link className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-sm font-medium">{att.name}</span>
                                    {att.size && (
                                      <span className="text-xs text-slate-500 block">
                                        {(att.size / 1024).toFixed(2)} KB
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {att.uploading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                                  {att.error && (
                                    <Badge variant="destructive" className="text-xs">
                                      {att.error}
                                    </Badge>
                                  )}
                                  {att.url && !att.uploading && !att.error && att.type === "file" && (
                                    <Badge variant="secondary" className="text-xs">
                                      Uploaded
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAttachment(att.id)}
                                className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                                disabled={att.uploading}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-6">
                    <Button type="submit" disabled={isLoading} size="lg" className="px-8">
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Ticket
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Properties Panel - Right Side */}
          <div className="xl:col-span-1 space-y-6">
            <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Ticket Properties
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Category */}
                <div className="space-y-3">
                  <Label htmlFor="category" className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    Category
                  </Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger id="category" className="w-full h-11 bg-white dark:bg-slate-900">
                      <SelectValue placeholder="Select category">
                        {selectedCategory && <span className="truncate">{getSelectedCategoryDisplay()}</span>}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="w-[400px] max-h-[300px]">
                      {flatCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()} className="cursor-pointer">
                          <span className="block w-full">
                            {"\u00A0".repeat(cat.level * 4)}
                            {cat.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4" />
                    Assign To
                  </Label>
                  <Popover open={assignOpen} onOpenChange={setAssignOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={assignOpen}
                        className="w-full justify-between h-11 bg-white dark:bg-slate-900"
                      >
                        {selectedEntity ? (
                          <div className="flex items-center gap-2 truncate">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {getEntityInitials(flatEntities.find((e) => e.entityId === selectedEntity)?.name || "")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{getSelectedEntityDisplay()}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Select team or user...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search teams and users..."
                          value={assignSearch}
                          onValueChange={setAssignSearch}
                        />
                        <CommandList>
                          <CommandEmpty>No teams or users found.</CommandEmpty>
                          <CommandGroup>
                            {filteredEntities.map((entity, idx) => (
                              <CommandItem
                                key={entity.entityId}
                                value={entity.entityId}
                                onSelect={(currentValue) => {
                                  setSelectedEntity(currentValue === selectedEntity ? "" : currentValue)
                                  setAssignOpen(false)
                                  setAssignSearch("")
                                }}
                                className={cn(
                                  "cursor-pointer",
                                  entity.type === "team"
                                    ? "bg-slate-50 dark:bg-slate-900 font-medium"
                                    : "pl-2 border-l-2 border-slate-200 dark:border-slate-700",
                                  entity.type === "team" && idx > 0
                                    ? "mt-1 pt-1 border-t border-slate-200 dark:border-slate-700"
                                    : "",
                                )}
                              >
                                <div className="flex items-center gap-3 w-full">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs">
                                      {getEntityInitials(entity.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium truncate">
                                        {"\u00A0".repeat(entity.level * 2)}
                                        {entity.name}
                                      </span>
                                      <Badge
                                        variant={entity.type === "team" ? "default" : "secondary"}
                                        className="text-xs"
                                      >
                                        {entity.type === "team" ? (
                                          <>
                                            <Users className="h-3 w-3 mr-1" />
                                            Team
                                          </>
                                        ) : (
                                          <>
                                            <User className="h-3 w-3 mr-1" />
                                            User
                                          </>
                                        )}
                                      </Badge>
                                    </div>
                                    {entity.level > 0 && (
                                      <p className="text-xs text-muted-foreground truncate">{entity.fullPath}</p>
                                    )}
                                  </div>
                                  <Check
                                    className={cn(
                                      "ml-auto h-4 w-4",
                                      selectedEntity === entity.entityId ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <Separator />

                {/* Status */}
                <div className="space-y-3">
                  <Label htmlFor="status" className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4" />
                    Status
                  </Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger id="status" className="w-full h-11 bg-white dark:bg-slate-900">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="w-[350px]">
                      {statuses.map((stat) => (
                        <SelectItem key={stat.id} value={stat.id.toString()}>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: stat.color }}
                            />
                            <span className="truncate">{stat.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="space-y-3">
                  <Label htmlFor="priority" className="flex items-center gap-2 text-sm font-medium">
                    <Flag className="h-4 w-4" />
                    Priority
                  </Label>
                  <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                    <SelectTrigger id="priority" className="w-full h-11 bg-white dark:bg-slate-900">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent className="w-[300px]">
                      {priorities.map((prio) => (
                        <SelectItem key={prio.id} value={prio.id.toString()}>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: prio.color }}
                            />
                            <span className="truncate">{prio.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
