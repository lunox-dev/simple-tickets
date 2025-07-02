// src/notifications/evaluateRules.ts

type AtomicCondition = {
    field: string
    operator: 'equals' | 'in' | 'isTrue' | 'isFalse' | 'any'
    value?: any
  }
  
  type Condition = {
    operator: 'and' | 'or'
    rules: (AtomicCondition | Condition)[]
  }
  
  type NotificationRule = {
    id: string
    eventTypes: string[]
    conditions: Condition
    enabled?: boolean
  }
  
  type NotificationPreferences = {
    rules: NotificationRule[]
  }
  
  type NotificationContext = Record<string, any>
  
  export type { NotificationPreferences };
  export function evaluateNotificationRules(
    preferences: NotificationPreferences,
    eventType: string,
    context: NotificationContext
  ): boolean {
    if (!preferences?.rules) return false
  
    for (const rule of preferences.rules) {
      if (!rule.enabled) continue
      if (!rule.eventTypes.includes(eventType)) continue
  
      const matched = evaluateCondition(rule.conditions, context)
      if (matched) return true
    }
  
    return false
  }
  
  function evaluateCondition(condition: Condition, context: NotificationContext): boolean {
    const results = condition.rules.map(rule => {
      if ('operator' in rule && 'rules' in rule) {
        return evaluateCondition(rule, context)
      }
      return evaluateAtomic(rule as AtomicCondition, context)
    })
  
    return condition.operator === 'and'
      ? results.every(Boolean)
      : results.some(Boolean)
  }
  
  function evaluateAtomic(condition: AtomicCondition, context: NotificationContext): boolean {
    const actualValue = context[condition.field]
  
    switch (condition.operator) {
      case 'equals':
        return actualValue === condition.value
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(actualValue)
      case 'isTrue':
        return Boolean(actualValue) === true
      case 'isFalse':
        return Boolean(actualValue) === false
      case 'any':
        return true
      default:
        return false
    }
  }
  