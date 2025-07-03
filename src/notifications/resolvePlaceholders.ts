// src/notifications/resolvePlaceholders.ts

export function resolvePlaceholders(template: string, context: Record<string, any>): string {
    console.log(`[resolvePlaceholders] Resolving template with context:`, JSON.stringify(context))
    return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
      const keys = key.trim().split('.')
      let value: any = context
  
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k]
        } else {
          return '' // fallback to empty string if value missing
        }
      }
  
      return String(value)
    })
  }
  