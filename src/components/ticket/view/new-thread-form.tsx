"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, Paperclip, X } from "lucide-react"
import { SimpleRichTextEditor } from "@/components/ui/SimpleRichTextEditor"

interface NewThreadFormProps {
  ticketId: number
  onThreadCreated: () => void
  onCancel: () => void
}

interface Attachment {
  file: File
  id: string
}

export default function NewThreadForm({ ticketId, onThreadCreated, onCancel }: NewThreadFormProps) {
  const [body, setBody] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const newAttachments: Attachment[] = Array.from(files).map((file) => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
    }))

    setAttachments((prev) => [...prev, ...newAttachments])

    // Reset the input
    event.target.value = ""
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id))
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

      // Add attachments
      attachments.forEach((attachment, index) => {
        formData.append(`attachments`, attachment.file)
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
      setAttachments([])
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

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Attachments:</h4>
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                <div className="flex items-center space-x-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium truncate text-foreground">{attachment.file.name}</span>
                  <span className="text-xs text-muted-foreground">({(attachment.file.size / 1024).toFixed(2)} KB)</span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeAttachment(attachment.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center space-x-2">
          <input type="file" id="file-upload" multiple onChange={handleFileSelect} className="hidden" accept="*/*" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("file-upload")?.click()}
            disabled={isSubmitting}
          >
            <Paperclip className="h-4 w-4 mr-2" />
            Attach Files
          </Button>
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
