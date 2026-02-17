"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Paperclip, X, Link, FileText } from "lucide-react"
import { SimpleRichTextEditor } from "@/components/ui/SimpleRichTextEditor"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface NewThreadFormProps {
  ticketId: number
  onThreadCreated: () => void
  onCancel: () => void
}

export default function NewThreadForm({ ticketId, onThreadCreated, onCancel }: NewThreadFormProps) {
  const [body, setBody] = useState("")
  const [files, setFiles] = useState<File[]>([])

  // URL Dialog state
  const [urlDialogOpen, setUrlDialogOpen] = useState(false)
  const [urlName, setUrlName] = useState("")
  const [urlValue, setUrlValue] = useState("")
  const [urlAttachments, setUrlAttachments] = useState<{ name: string; url: string }[]>([])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (!selectedFiles) return
    setFiles((prev) => [...prev, ...Array.from(selectedFiles)])
    // Reset the input
    event.target.value = ""
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!body.trim()) {
      setError("Please enter a message")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("ticketId", ticketId.toString())
      formData.append("body", body)

      // Serialize URL attachments
      if (urlAttachments.length > 0) {
        formData.append("urlAttachments", JSON.stringify(urlAttachments))
      }

      // Append files
      files.forEach((file) => {
        formData.append("files", file)
      })

      const response = await fetch("/api/ticket/thread/new", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create thread")
      }

      // Reset form
      setBody("")
      setFiles([])
      setUrlAttachments([])
      onThreadCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create thread")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Rich Text Editor */}
      <div className="space-y-2">
        <SimpleRichTextEditor
          value={body}
          onChange={setBody}
          placeholder="Type your reply..."
          className="min-h-[120px] border border-border rounded-md"
        />
      </div>

      {/* Attachments Section */}
      {(files.length > 0 || urlAttachments.length > 0) && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Attachments:</h4>
          <div className="space-y-2">
            {/* Files */}
            {files.map((file, i) => (
              <div key={`file-${i}`} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                <div className="flex items-center space-x-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate text-foreground">{file.name}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">({(file.size / 1024).toFixed(2)} KB)</span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* URLs */}
            {urlAttachments.map((att, i) => (
              <div key={`url-${i}`} className="flex items-center justify-between p-2 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-md">
                <div className="flex items-center space-x-2 min-w-0">
                  <Link className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="text-sm font-medium truncate text-blue-700 dark:text-blue-300">{att.name}</span>
                  <span className="text-xs text-blue-600/70 dark:text-blue-400/70 truncate max-w-[200px]">{att.url}</span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeUrlAttachment(i)}>
                  <X className="h-4 w-4 text-blue-500 hover:text-blue-700" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center space-x-2">
          <input type="file" id="thread-file-upload" multiple onChange={handleFileSelect} className="hidden" accept="*/*" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("thread-file-upload")?.click()}
            disabled={isSubmitting}
          >
            <Paperclip className="h-4 w-4 mr-2" />
            Attach Files
          </Button>

          <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Link className="h-4 w-4 mr-2" />
                Add Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add URL</DialogTitle>
                <DialogDescription>Add a web link to your reply</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="thread-url-name">Link Name</Label>
                  <Input
                    id="thread-url-name"
                    placeholder="e.g., Related Issue"
                    value={urlName}
                    onChange={(e) => setUrlName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="thread-url-value">URL</Label>
                  <Input
                    id="thread-url-value"
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

        <div className="flex items-center space-x-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !body.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Reply"
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
