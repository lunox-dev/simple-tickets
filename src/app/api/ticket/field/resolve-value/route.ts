import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'
import { getAccessibleCategoryIds } from '@/lib/access-ticket-category'

export async function POST(req: NextRequest) {
    // 1. Authenticate
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 2. Parse Payload
    const { fieldDefinitionId, value, dependencyValue, context } = await req.json() as {
        fieldDefinitionId?: number,
        value?: string | string[],
        dependencyValue?: string,
        context?: Record<string, any>
    }

    if (!fieldDefinitionId) return NextResponse.json({ error: 'fieldDefinitionId required' }, { status: 400 })
    if (value === undefined || value === null || value === '') return NextResponse.json({ labels: [] })

    try {
        // ... (existing code 3, 4, 5) ...
        const fieldDef = await prisma.ticketFieldDefinition.findUnique({
            where: { id: fieldDefinitionId }
        })

        if (!fieldDef) return NextResponse.json({ error: 'Field not found' }, { status: 404 })

        // 4. Check permissions (read access to category)
        const allowedCats = await getAccessibleCategoryIds(session.user)
        if (fieldDef.applicableCategoryId && !allowedCats.has(fieldDef.applicableCategoryId)) {
            // ...
            if (fieldDef.applicableCategoryId && !allowedCats.has(fieldDef.applicableCategoryId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }

        // 5. If not API field
        if (fieldDef.type !== 'API_SELECT') {
            return NextResponse.json({ labels: Array.isArray(value) ? value : [value] })
        }

        // 6. Execute API Request (similar to fetch-options)
        const config = fieldDef.apiConfig as any
        if (!config || !config.url) return NextResponse.json({ error: 'Invalid API config' }, { status: 500 })

        // Handle URL Parameters (Dependency Injection)
        let finalUrl = config.url
        // Default to URL_PARAM if dependencyParam is set but nestedPath is not (implies remote fetch)
        const isUrlParamMode = config.dependencyMode === 'URL_PARAM' || (config.dependencyParam && !config.nestedPath)

        if (isUrlParamMode) {
            // We need a dependency value.
            let depVal = dependencyValue

            // If not provided, try to find it in context
            if (!depVal && context && config.dependsOnFieldKey) {
                depVal = context[config.dependsOnFieldKey]
            }


            // If provided (or found in context), use it.
            if (depVal) {
                const separator = finalUrl.includes('?') ? '&' : '?'
                finalUrl = `${finalUrl}${separator}${config.dependencyParam}=${encodeURIComponent(depVal)}`
            } else {
                // Warning: Missing dependency value for a dependent field. 
                // The API might fail (400), which we catch below.
                console.warn(`Field ${fieldDefinitionId} depends on ${config.dependsOnFieldKey} but no value (or context) provided.`)
                console.warn('Context Keys:', context ? Object.keys(context) : 'null')
            }
        }

        const headers = config.headers || {}

        const response = await fetch(finalUrl, {
            method: config.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        })

        if (!response.ok) {
            const errText = await response.text()
            console.warn(`[ResolveValue] API Error: ${response.status} ${response.statusText}`)
            console.warn(`[ResolveValue] Body: ${errText}`)

            // Fallback: If API fails (e.g. 400 due to missing params), return raw value as label
            return NextResponse.json({
                items: Array.isArray(value)
                    ? value.map(v => ({ value: v, label: v }))
                    : [{ value, label: value }]
            })
        }

        const rawData = await response.json()

        // 7. Resolve Path
        const resolvePath = (obj: any, pathStr: string) => {
            if (!pathStr || !obj) return undefined
            const path = pathStr.split('.')
            let current = obj
            for (const key of path) {
                if (current === undefined || current === null) return undefined
                current = current[key]
            }
            return current
        }

        const arrayData = resolvePath(rawData, config.arrayPath || '')
        if (!Array.isArray(arrayData)) return NextResponse.json({ labels: [] })

        let itemsToSearch = arrayData

        // Handle Nested Array (Local Filter Mode) flattening
        // If we are looking for a value in a nested list (e.g. Channels inside Banks), we need to search ALL children.
        if (config.dependencyMode === 'LOCAL_FILTER' && config.nestedPath) {
            itemsToSearch = []
            for (const parent of arrayData) {
                const children = resolvePath(parent, config.nestedPath)
                if (Array.isArray(children)) {
                    itemsToSearch.push(...children)
                }
            }
        }

        // 8. Find Labels
        const valuesToFind = new Set(Array.isArray(value) ? value : [value])
        const resolvedItems: any[] = []

        // Iterate and map
        for (const item of itemsToSearch) {
            const itemVal = resolvePath(item, config.valuePath)
            if (valuesToFind.has(String(itemVal))) {
                const label = String(resolvePath(item, config.labelPath) || itemVal)
                const metadata: any = {}
                if (config.imagePath) metadata.image = resolvePath(item, config.imagePath)
                if (config.descriptionPath) metadata.description = resolvePath(item, config.descriptionPath)

                resolvedItems.push({ value: String(itemVal), label, metadata })
            }
        }

        return NextResponse.json({ items: resolvedItems }) // Changed format to return objects with metadata

    } catch (err: any) {
        console.error(err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
