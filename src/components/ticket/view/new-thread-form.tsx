"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Send, AlertCircle } from "lucide-react"
import { SimpleRichTextEditor } from "@/components/ui/SimpleRichTextEditor"

interface NewThreadFormProps {
  ticketId: number
  onThreadCreated: () => void
}

export default function NewThreadForm({ ticketId, onThreadCreated }: NewThreadFormProps) {
  const [body, setBody] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!body.trim()) {
      setError("Comment cannot be empty")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/ticket/thread/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          body: body.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to add comment")
      }

      setBody("")
      onThreadCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment")
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

      <SimpleRichTextEditor
        value={body}
        onChange={setBody}
        placeholder="Add a comment..."
        className="min-h-[120px]"
        autofocus
      />

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !body.trim()}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Adding Comment...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Add Comment
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
