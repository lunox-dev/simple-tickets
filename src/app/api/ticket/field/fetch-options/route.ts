
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const fieldId = searchParams.get('fieldDefinitionId')
    const query = searchParams.get('query') || ''

    if (!fieldId) return NextResponse.json({ error: 'fieldDefinitionId required' }, { status: 400 })

    // 1. Fetch Config
    const fieldDef = await prisma.ticketFieldDefinition.findUnique({
        where: { id: parseInt(fieldId) },
        select: { apiConfig: true, type: true }
    })

    if (!fieldDef) return NextResponse.json({ error: 'Field not found' }, { status: 404 })
    if (fieldDef.type !== 'API_SELECT') {
        return NextResponse.json({ error: 'Not an API field' }, { status: 400 })
    }

    const config = fieldDef.apiConfig as any
    if (!config || !config.url) return NextResponse.json({ error: 'Invalid Configuration' }, { status: 500 })

    try {
        // 2. Execute Request (with query injection if supported, or client-side filtering)
        // For now, we fetch all and filter server-side

        let targetUrl = config.url

        if (config.dependencyMode !== 'LOCAL_FILTER') {
            // Standard URL Param injection
            if (config.dependencyParam) {
                const depVal = searchParams.get(config.dependencyParam)
                if (depVal) {
                    const separator = targetUrl.includes('?') ? '&' : '?'
                    targetUrl = `${targetUrl}${separator}${config.dependencyParam}=${encodeURIComponent(depVal)}`
                }
            }
        }

        const response = await fetch(targetUrl, {
            method: config.method || 'GET',
            headers: config.headers || {}
        })

        const rawData = await response.json()

        // 3. Navigate Path (Array Path)
        let dataList = rawData
        if (config.arrayPath) {
            const path = config.arrayPath.split('.').filter((p: string) => p !== '$') // simple dot notation
            for (const key of path) {
                if (dataList && dataList[key]) {
                    dataList = dataList[key]
                } else {
                    dataList = []
                    break
                }
            }
        }

        if (!Array.isArray(dataList)) {
            return NextResponse.json([], { status: 200 }) // Return empty if not array
        }

        // 3b. Local Filter (If enabled)
        if (config.dependencyMode === 'LOCAL_FILTER' && config.dependencyParam) {
            const depVal = searchParams.get(config.dependencyParam)
            if (depVal) {
                // Find parent item where item[dependencyParam] == depVal
                // We need to resolve the path 'dependencyParam' on the item
                // Usually it's just a key like 'id'
                const parentItem = dataList.find((item: any) => {
                    const itemVal = resolvePath(item, config.dependencyParam!)
                    return String(itemVal) === String(depVal)
                })

                if (parentItem) {
                    // Found parent! Now extract nested path
                    if (config.nestedPath) {
                        dataList = resolvePath(parentItem, config.nestedPath) || []
                    } else {
                        // If no nested path, maybe return the item itself as single option? Or meaningless?
                        // Assume nested path is required for this mode usually.
                        dataList = []
                    }
                } else {
                    dataList = [] // Parent not found
                }
            } else {
                // Dependency value missing? Return empty or all?
                // If it depends on something, probably empty.
                dataList = []
            }
        }

        // 4. Map & Filter
        const options = dataList.map((item: any) => {
            // Resolve Value
            let value = item
            if (config.valuePath) {
                value = resolvePath(item, config.valuePath)
            }

            // Resolve Label
            let label = config.labelPath ? resolvePath(item, config.labelPath) : String(value)

            // Resolve Metadata
            const metadata: any = {}
            if (config.imagePath) metadata.image = resolvePath(item, config.imagePath)
            if (config.descriptionPath) metadata.description = resolvePath(item, config.descriptionPath)

            return { value: String(value), label: String(label), metadata, raw: item }
        })

        // Simple Search
        const filtered = options.filter((o: any) =>
            o.label.toLowerCase().includes(query.toLowerCase()) ||
            o.value.toLowerCase().includes(query.toLowerCase())
        )

        // Remove raw data before sending to client
        const safeOptions = filtered.map(({ raw, ...rest }: any) => rest)

        return NextResponse.json(safeOptions)

    } catch (err) {
        console.error('Proxy Error', err)
        return NextResponse.json({ error: 'External API Error' }, { status: 502 })
    }
}

function resolvePath(obj: any, pathStr: string) {
    const path = pathStr.split('.')
    let current = obj
    for (const key of path) {
        if (current === undefined || current === null) return null
        current = current[key]
    }
    return current
}
