import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { verifyPermission, handlePermissionError } from '@/lib/permission-error'

export async function POST(req: NextRequest) {
  // 1. Authenticate (session or x-api-key)
  const session = await getServerSession(authOptions)
  let permSet = new Set<string>()

  if (session) {
    // User-level permission only (not team/userteam)
    const userPerms = (session.user as any).permissions as string[]
    userPerms.forEach(p => permSet.add(p))
  } else {
    // API-key flow
    const key = req.headers.get('x-api-key')
    if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ak = await prisma.apiKey.findUnique({
      where: { key },
      select: { permissions: true }
    })
    if (!ak) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    ak.permissions.forEach(p => permSet.add(p))
  }

  // 2. Permission check
  try {
    verifyPermission(permSet, 'ticketcategory:manage:any', 'ticket_category')
  } catch (err) {
    return handlePermissionError(err)
  }

  // 3. Parse & validate payload
  const body = await req.json()
  const {
    label,
    key,
    applicableCategoryId,
    requiredAtCreation,
    priority,
    regex,
    type,
    multiSelect,
    apiConfig,
    ticketFieldGroupId,
    activeInCreate,
    activeInRead,
    displayOnList
  } = body as {
    label?: string
    key?: string
    applicableCategoryId?: number
    requiredAtCreation?: boolean
    priority?: number
    regex?: string
    type?: string
    multiSelect?: boolean
    apiConfig?: any
    ticketFieldGroupId?: number
    activeInCreate?: boolean
    activeInRead?: boolean
    displayOnList?: boolean
  }

  if (typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 })
  }
  // applicableCategoryId is now optional
  if (ticketFieldGroupId && typeof ticketFieldGroupId !== 'number') {
    return NextResponse.json({ error: 'ticketFieldGroupId must be a number' }, { status: 400 })
  }

  if (typeof requiredAtCreation !== 'boolean') {
    return NextResponse.json({ error: 'requiredAtCreation (boolean) is required' }, { status: 400 })
  }
  if (typeof priority !== 'number') {
    return NextResponse.json({ error: 'priority (number) is required' }, { status: 400 })
  }

  // New validations
  if (type && !['TEXT', 'API_SELECT'].includes(type)) {
    return NextResponse.json({ error: 'Invalid field type' }, { status: 400 })
  }

  if (type === 'API_SELECT' && !apiConfig) {
    return NextResponse.json({ error: 'apiConfig is required for API fields' }, { status: 400 })
  }

  // DisplayOnList Validation
  if (displayOnList) {
    if (type !== 'API_SELECT') {
      return NextResponse.json({ error: 'DisplayOnList is only allowed for API Fetched fields (Dropdowns)' }, { status: 400 })
    }
    // Check dependency
    if (apiConfig && apiConfig.dependsOnFieldKey) {
      // Find parent field
      const parent = await prisma.ticketFieldDefinition.findFirst({
        where: { key: apiConfig.dependsOnFieldKey }
      })
      if (!parent) {
        return NextResponse.json({ error: `Parent field ${apiConfig.dependsOnFieldKey} not found` }, { status: 400 })
      }
      if (!parent.displayOnList) {
        return NextResponse.json({ error: `Parent field ${parent.label} must also have DisplayOnList enabled` }, { status: 400 })
      }
    }
  }

  // 4. Create the custom field
  try {
    const field = await prisma.ticketFieldDefinition.create({
      data: {
        label: label.trim(),
        key: key?.trim() || "",
        applicableCategoryId: (applicableCategoryId || undefined) as any,
        requiredAtCreation,
        priority,
        regex: regex?.trim() || "", // regex optional now? or empty string
        type: type || 'TEXT',
        multiSelect: multiSelect || false,
        apiConfig: apiConfig || undefined,
        ticketFieldGroupId: ticketFieldGroupId || null,
        activeInCreate: activeInCreate ?? true,
        activeInRead: activeInRead ?? true,
        displayOnList: displayOnList || false
      }
    })
    return NextResponse.json({ field }, { status: 201 })
  } catch (err: any) {
    console.error('Error creating custom field:', err)
    return NextResponse.json({ error: 'Failed to create custom field' }, { status: 500 })
  }
}
