"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Settings, Bell, CheckCircle2, AlertCircle } from "lucide-react"
import { Label } from "@/components/ui/label"

// --- Types ---
interface NotificationRule {
  id: string
  description: string
  eventTypes: string[]
  enabled: boolean
  conditions: ConditionGroupType
}

interface ConditionGroupType {
  operator: "and" | "or"
  rules: (AtomicConditionType | ConditionGroupType)[]
}

interface AtomicConditionType {
  field: string
  operator: string
  value?: any
}

const EVENT_TYPE_OPTIONS = [
  { value: "TICKET_CREATED", label: "Ticket Created" },
  { value: "ASSIGNMENT_CHANGED", label: "Assignment Changed" },
  { value: "PRIORITY_CHANGED", label: "Priority Changed" },
  { value: "STATUS_CHANGED", label: "Status Changed" },
  { value: "NEW_THREAD", label: "New Thread" },
]

const FIELD_OPTIONS = [
  { value: "priority", label: "Priority" },
  { value: "status", label: "Status" },
  { value: "category", label: "Category" },
  { value: "assignedToMe", label: "Assigned To Me" },
  { value: "assignedToMyTeams", label: "Assigned To My Teams" },
  { value: "createdByMe", label: "Created By Me" },
]

const OPERATOR_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  priority: [
    { value: "equals", label: "Equals" },
    { value: "in", label: "In" },
    { value: "any", label: "Any" },
  ],
  status: [
    { value: "equals", label: "Equals" },
    { value: "in", label: "In" },
    { value: "any", label: "Any" },
  ],
  category: [
    { value: "equals", label: "Equals" },
    { value: "in", label: "In" },
    { value: "any", label: "Any" },
  ],
  assignedToMe: [
    { value: "isTrue", label: "Is True" },
    { value: "isFalse", label: "Is False" },
  ],
  assignedToMyTeams: [
    { value: "isTrue", label: "Is True" },
    { value: "isFalse", label: "Is False" },
  ],
  createdByMe: [
    { value: "isTrue", label: "Is True" },
    { value: "isFalse", label: "Is False" },
  ],
}

// --- Helper to flatten categories ---
function flattenCategories(categories: any[], parentPath: string[] = [], level = 0): any[] {
  return categories.reduce((acc, cat) => {
    const currentPath = [...parentPath, cat.name]
    acc.push({ id: cat.id, name: cat.name, fullPath: currentPath.join(" > "), level })
    if (cat.children?.length > 0) {
      acc.push(...flattenCategories(cat.children, currentPath, level + 1))
    }
    return acc
  }, [])
}

// --- Atomic Condition Editor ---
function AtomicConditionEditor({
  condition,
  onChange,
  onRemove,
  priorities,
  statuses,
  categories,
}: {
  condition: AtomicConditionType
  onChange: (c: AtomicConditionType) => void
  onRemove: () => void
  priorities: any[]
  statuses: any[]
  categories: any[]
}) {
  const field = condition.field
  const operator = condition.operator
  const value = condition.value

  const handleFieldChange = (newField: string) => {
    onChange({ field: newField, operator: OPERATOR_OPTIONS[newField][0].value, value: undefined })
  }

  const handleOperatorChange = (newOperator: string) => {
    onChange({ ...condition, operator: newOperator, value: undefined })
  }

  const handleValueChange = (newValue: any) => {
    onChange({ ...condition, value: newValue })
  }

  let valueInput = null
  const needsValue = !["any", "isTrue", "isFalse"].includes(operator)

  if (needsValue) {
    if (["priority", "status"].includes(field)) {
      const options = field === "priority" ? priorities : statuses
      if (operator === "equals") {
        valueInput = (
          <Select value={value?.toString()} onValueChange={(v) => handleValueChange(Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.id} value={opt.id.toString()}>
                  {opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      } else if (operator === "in") {
        valueInput = (
          <div className="p-2 border rounded-md max-h-32 overflow-y-auto space-y-1">
            {options.map((opt) => (
              <Label key={opt.id} className="flex items-center gap-2 font-normal">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(opt.id)}
                  onChange={(e) => {
                    const currentSelection = Array.isArray(value) ? value : []
                    const newSelection = e.target.checked
                      ? [...currentSelection, opt.id]
                      : currentSelection.filter((id) => id !== opt.id)
                    handleValueChange(newSelection)
                  }}
                />
                {opt.name}
              </Label>
            ))}
          </div>
        )
      }
    } else if (field === "category") {
      const options = categories
      if (operator === "equals") {
        valueInput = (
          <Select value={value?.toString()} onValueChange={(v) => handleValueChange(Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Select category..." />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.id} value={opt.id.toString()}>
                  <span style={{ paddingLeft: `${opt.level * 1.5}rem` }}>{opt.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      } else if (operator === "in") {
        valueInput = (
          <div className="p-2 border rounded-md max-h-32 overflow-y-auto space-y-1">
            {options.map((opt) => (
              <Label key={opt.id} className="flex items-center gap-2 font-normal">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(opt.id)}
                  onChange={(e) => {
                    const currentSelection = Array.isArray(value) ? value : []
                    const newSelection = e.target.checked
                      ? [...currentSelection, opt.id]
                      : currentSelection.filter((id) => id !== opt.id)
                    handleValueChange(newSelection)
                  }}
                />
                <span style={{ paddingLeft: `${opt.level * 1.5}rem` }}>{opt.name}</span>
              </Label>
            ))}
          </div>
        )
      }
    }
  }

  return (
    <div className="flex items-start gap-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-grow">
        <Select value={field} onValueChange={handleFieldChange}>
          <SelectTrigger>
            <SelectValue placeholder="Field" />
          </SelectTrigger>
          <SelectContent>
            {FIELD_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={operator} onValueChange={handleOperatorChange}>
          <SelectTrigger>
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent>
            {OPERATOR_OPTIONS[field].map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {needsValue && <div className="sm:col-span-1">{valueInput}</div>}
      </div>
      <Button size="icon" variant="ghost" onClick={onRemove}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )
}

// --- Recursive Condition Group ---
function ConditionGroup({
  group,
  onChange,
  onRemove,
  isRoot = false,
  ...props
}: {
  group: ConditionGroupType
  onChange: (g: ConditionGroupType) => void
  onRemove?: () => void
  isRoot?: boolean
  priorities: any[]
  statuses: any[]
  categories: any[]
}) {
  const handleRuleChange = (index: number, newRule: AtomicConditionType | ConditionGroupType) => {
    const newRules = [...group.rules]
    newRules[index] = newRule
    onChange({ ...group, rules: newRules })
  }

  const handleRemoveRule = (index: number) => {
    const newRules = [...group.rules]
    newRules.splice(index, 1)
    onChange({ ...group, rules: newRules })
  }

  const handleAddCondition = () => {
    const newCondition: AtomicConditionType = { field: "priority", operator: "equals" }
    onChange({ ...group, rules: [...group.rules, newCondition] })
  }

  const handleAddGroup = () => {
    const newGroup: ConditionGroupType = { operator: "and", rules: [] }
    onChange({ ...group, rules: [...group.rules, newGroup] })
  }

  const handleOperatorChange = (op: "and" | "or") => {
    onChange({ ...group, operator: op })
  }

  return (
    <div className="bg-gray-50/50 p-4 border-2 border-dashed border-gray-200 rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={group.operator} onValueChange={handleOperatorChange}>
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">AND</SelectItem>
              <SelectItem value="or">OR</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">Group</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleAddCondition}>
            <Plus className="w-4 h-4 mr-1" /> Condition
          </Button>
          <Button size="sm" variant="outline" onClick={handleAddGroup}>
            <Plus className="w-4 h-4 mr-1" /> Group
          </Button>
          {!isRoot && (
            <Button size="icon" variant="ghost" onClick={onRemove}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="pl-6 border-l-2 border-dashed border-gray-200 space-y-4">
        {group.rules.length > 0 ? (
          group.rules.map((rule, index) =>
            "rules" in rule ? (
              <ConditionGroup
                key={index}
                group={rule}
                onChange={(g) => handleRuleChange(index, g)}
                onRemove={() => handleRemoveRule(index)}
                {...props}
                isRoot={false}
              />
            ) : (
              <AtomicConditionEditor
                key={index}
                condition={rule}
                onChange={(c) => handleRuleChange(index, c)}
                onRemove={() => handleRemoveRule(index)}
                {...props}
              />
            ),
          )
        ) : (
          <div className="text-center text-sm text-muted-foreground py-4">No conditions added yet.</div>
        )}
      </div>
    </div>
  )
}

// --- Rule Editor Dialog ---
function RuleEditorDialog({
  open,
  onOpenChange,
  onSave,
  initial,
  ...props
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSave: (r: NotificationRule) => void
  initial: NotificationRule | null
  priorities: any[]
  statuses: any[]
  categories: any[]
}) {
  const [rule, setRule] = useState<NotificationRule | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setRule(
        initial || {
          id: crypto.randomUUID(),
          description: "",
          eventTypes: [],
          enabled: true,
          conditions: { operator: "and", rules: [] },
        },
      )
      setErrors({})
    }
  }, [initial, open])

  const validate = () => {
    if (!rule) return false
    const newErrors: Record<string, string> = {}
    if (!rule.description.trim()) newErrors.description = "Description is required"
    if (rule.eventTypes.length === 0) newErrors.eventTypes = "At least one event type must be selected"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (validate()) {
      onSave(rule!)
    }
  }

  if (!rule) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {initial ? "Edit Notification Rule" : "Add Notification Rule"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div>
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              placeholder="e.g., 'Notify on critical tickets assigned to me'"
              value={rule.description}
              onChange={(e) => setRule({ ...rule, description: e.target.value })}
            />
            {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description}</p>}
          </div>
          <div>
            <Label>Event Types *</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <Label
                  key={opt.value}
                  className={`flex items-center gap-2 p-2 border rounded-md cursor-pointer text-sm ${rule.eventTypes.includes(opt.value) ? "bg-blue-50 border-blue-300" : "hover:bg-gray-50"}`}
                >
                  <input
                    type="checkbox"
                    checked={rule.eventTypes.includes(opt.value)}
                    onChange={(e) => {
                      const newTypes = e.target.checked
                        ? [...rule.eventTypes, opt.value]
                        : rule.eventTypes.filter((t) => t !== opt.value)
                      setRule({ ...rule, eventTypes: newTypes })
                    }}
                  />
                  {opt.label}
                </Label>
              ))}
            </div>
            {errors.eventTypes && <p className="text-sm text-red-500 mt-1">{errors.eventTypes}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Switch id="enabled" checked={rule.enabled} onCheckedChange={(v) => setRule({ ...rule, enabled: v })} />
            <Label htmlFor="enabled">Rule Enabled</Label>
          </div>
          <div>
            <Label>Conditions</Label>
            <div className="mt-2">
              <ConditionGroup
                group={rule.conditions}
                onChange={(c) => setRule({ ...rule, conditions: c })}
                isRoot
                {...props}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{initial ? "Save Changes" : "Add Rule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Main Rule Builder ---
export default function NotificationRuleBuilder({
  value,
  onChange,
  loading,
  type,
}: { value: NotificationRule[]; onChange: (r: NotificationRule[]) => void; loading: boolean; type: "email" | "sms" }) {
  const [priorities, setPriorities] = useState([])
  const [statuses, setStatuses] = useState([])
  const [flatCategories, setFlatCategories] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null)

  useEffect(() => {
    fetch("/api/ticket/priority/list")
      .then((res) => res.json())
      .then((data) => setPriorities(data.priorities || []))
      .catch(console.error)
    fetch("/api/ticket/status/list")
      .then((res) => res.json())
      .then(setStatuses)
      .catch(console.error)
    fetch("/api/ticket/category/list")
      .then((res) => res.json())
      .then((data) => setFlatCategories(flattenCategories(data || [])))
      .catch(console.error)
  }, [])

  const handleOpenAdd = () => {
    setEditingRule(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (rule: NotificationRule) => {
    setEditingRule(rule)
    setDialogOpen(true)
  }

  const handleSave = (ruleToSave: NotificationRule) => {
    const index = value.findIndex((r) => r.id === ruleToSave.id)
    if (index > -1) {
      const newRules = [...value]
      newRules[index] = ruleToSave
      onChange(newRules)
    } else {
      onChange([...value, ruleToSave])
    }
    setDialogOpen(false)
  }

  const handleDelete = (id: string) => {
    onChange(value.filter((r) => r.id !== id))
  }

  const handleToggleEnabled = (id: string) => {
    const index = value.findIndex((r) => r.id === id)
    if (index > -1) {
      const newRules = [...value]
      newRules[index].enabled = !newRules[index].enabled
      onChange(newRules)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {value.length} rule{value.length !== 1 ? "s" : ""} configured
        </p>
        <Button onClick={handleOpenAdd} disabled={loading}>
          <Plus className="w-4 h-4 mr-1" /> Add Rule
        </Button>
      </div>
      {value.length === 0 ? (
        <Card className="text-center py-8">
          <CardContent>
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-2">No rules yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add a rule to get {type} notifications.</p>
            <Button onClick={handleOpenAdd}>Add Your First Rule</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {value.map((rule) => (
            <Card key={rule.id} className={!rule.enabled ? "bg-gray-50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{rule.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {rule.eventTypes.map((et) => (
                        <Badge key={et} variant="outline" className="text-xs">
                          {EVENT_TYPE_OPTIONS.find((o) => o.value === et)?.label || et}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleToggleEnabled(rule.id)} disabled={loading}>
                      {rule.enabled ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-gray-400" />
                      )}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleOpenEdit(rule)} disabled={loading}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(rule.id)} disabled={loading}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <RuleEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        initial={editingRule}
        priorities={priorities}
        statuses={statuses}
        categories={flatCategories}
      />
    </div>
  )
}
