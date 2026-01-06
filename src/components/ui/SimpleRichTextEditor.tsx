"use client"

import type React from "react"
import { useRef, useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Bold, Italic, Underline } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface SimpleRichTextEditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
  editorContentClassName?: string
  placeholder?: string
  autofocus?: boolean
  editable?: boolean
}

export const SimpleRichTextEditor: React.FC<SimpleRichTextEditorProps> = ({
  value,
  onChange,
  className,
  editorContentClassName,
  placeholder = "Start typing...",
  autofocus,
  editable = true,
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [formats, setFormats] = useState<string[]>([])
  const [isEmpty, setIsEmpty] = useState(true)
  const [isFocused, setIsFocused] = useState(false)

  const getActiveFormats = useCallback((): string[] => {
    if (!editorRef.current) return []

    const formats: string[] = []
    try {
      if (document.queryCommandState("bold")) formats.push("bold")
      if (document.queryCommandState("italic")) formats.push("italic")
      if (document.queryCommandState("underline")) formats.push("underline")
    } catch (e) {
      // queryCommandState can throw in some browsers
      console.warn("Error checking command state:", e)
    }
    return formats
  }, [])

  const updateFormats = useCallback(() => {
    const activeFormats = getActiveFormats()
    setFormats(activeFormats)
  }, [getActiveFormats])

  const checkIfEmpty = useCallback((content: string) => {
    // Remove HTML tags and check if there's any actual text content
    const textContent = content
      .replace(/<br\s*\/?>/gi, "") // Remove <br> tags
      .replace(/<[^>]*>/g, "") // Remove all other HTML tags
      .replace(/&nbsp;/g, " ") // Replace &nbsp; with regular spaces
      .trim()

    setIsEmpty(textContent.length === 0)
  }, [])

  useEffect(() => {
    if (editorRef.current) {
      const currentContent = editorRef.current.innerHTML
      if (currentContent !== value) {
        editorRef.current.innerHTML = value || ""
        checkIfEmpty(value || "")
      }
    }
  }, [value, checkIfEmpty])

  useEffect(() => {
    if (autofocus && editorRef.current) {
      editorRef.current.focus()
      setIsFocused(true)
    }
  }, [autofocus])

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML
      onChange(content)
      checkIfEmpty(content)
      updateFormats()
    }
  }, [onChange, checkIfEmpty, updateFormats])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    updateFormats()
  }, [updateFormats])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Handle keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault()
            document.execCommand("bold", false)
            updateFormats()
            break
          case "i":
            e.preventDefault()
            document.execCommand("italic", false)
            updateFormats()
            break
          case "u":
            e.preventDefault()
            document.execCommand("underline", false)
            updateFormats()
            break
        }
      }
    },
    [updateFormats],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData.getData("text/plain")
      document.execCommand("insertText", false, text)
      handleInput()
    },
    [handleInput],
  )

  const handleSelectionChange = useCallback(() => {
    if (document.activeElement === editorRef.current) {
      updateFormats()
    }
  }, [updateFormats])

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange)
    return () => document.removeEventListener("selectionchange", handleSelectionChange)
  }, [handleSelectionChange])

  const handleFormatChange = useCallback(
    (values: string[]) => {
      if (!editorRef.current) return

      // Focus the editor first
      editorRef.current.focus()

      // Get current selection
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const current = getActiveFormats()

        // Toggle each format based on difference
        ;["bold", "italic", "underline"].forEach((fmt) => {
          const shouldBeOn = values.includes(fmt)
          const isOn = current.includes(fmt)
          if (shouldBeOn !== isOn) {
            try {
              document.execCommand(fmt, false)
            } catch (e) {
              console.warn(`Error executing command ${fmt}:`, e)
            }
          }
        })

      // Update formats and trigger change
      updateFormats()
      handleInput()
    },
    [getActiveFormats, updateFormats, handleInput],
  )

  const showPlaceholder = isEmpty && !isFocused && placeholder

  return (
    <div className={cn("flex flex-col border rounded-md overflow-hidden", className)}>
      {editable && (
        <div className="border-b bg-muted/50">
          <ToggleGroup
            variant="outline"
            type="multiple"
            value={formats}
            onValueChange={handleFormatChange}
            className="p-2 border-none bg-transparent"
          >
            <ToggleGroupItem value="bold" aria-label="Toggle bold" size="sm" className="h-8 w-8 p-0">
              <Bold className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="italic" aria-label="Toggle italic" size="sm" className="h-8 w-8 p-0">
              <Italic className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="underline" aria-label="Toggle underline" size="sm" className="h-8 w-8 p-0">
              <Underline className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}
      <div className="relative flex-1">
        <div
          ref={editorRef}
          className={cn(
            "min-h-[120px] p-4 outline-none focus:outline-none bg-background text-base resize-none relative z-0",
            "focus:ring-0 focus:border-transparent",
            editorContentClassName,
          )}
          contentEditable={editable}
          suppressContentEditableWarning
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          style={{
            whiteSpace: "pre-wrap",
            wordWrap: "break-word",
            overflowWrap: "break-word",
          }}
          aria-label={placeholder}
          role="textbox"
          aria-multiline="true"
        />
        {showPlaceholder && (
          <div
            className={cn(
              "absolute top-4 left-4 text-muted-foreground pointer-events-none select-none z-10",
              "text-base opacity-60",
            )}
            style={{
              color: "rgb(107 114 128)", // Ensure visible gray color
            }}
          >
            {placeholder}
          </div>
        )}
      </div>
    </div>
  )
}

export default SimpleRichTextEditor
