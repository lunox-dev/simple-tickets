import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions'
import { prisma } from '@/lib/prisma'
import { getTicketAccessForUser } from '@/lib/access-ticket-user'
import { hasThreadCreatePermission } from '@/lib/access-ticket-change'
import { enqueueNotificationInit } from '@/lib/notification-queue'

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = Number((session.user as any).id)
    const actingAs = (session.user as any).actingAs

    const { ticketId: tid, fieldDefinitionId: fdid, value, context: reqContext } = await req.json()

    if (!tid || !fdid || value === undefined) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const ticketId = Number(tid)
    const fieldDefinitionId = Number(fdid)

    // 1. Check Ticket Access
    const access = await getTicketAccessForUser(userId, ticketId)
    if (!access) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. Get Current Value
    const existingValue = await prisma.ticketFieldValue.findFirst({
        where: {
            ticketId,
            ticketFieldDefinitionId: fieldDefinitionId
        }
    })

    // 3. Permission Check
    // Logic: "Fresh entry" allowed for people who have access to reply.
    // "Modify" for people who have proper permission (ticket:properties:manage).

    // We need ticket details for 'canReply' logic
    const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: {
            currentStatusId: true,
            currentAssignedTo: { select: { id: true, teamId: true, userTeamId: true, userTeam: { select: { teamId: true } } } }
        }
    })

    // Merge global permissions
    const allPermissions = [
        ...((session.user as any).permissions || []),
        ...access.actionPermissions
    ]

    const canReply = ticket && ticket.currentStatusId !== 4 && hasThreadCreatePermission(access, (ticket.currentAssignedTo as any)?.id)

    const isFreshEntry = !existingValue || !existingValue.value || existingValue.value === ''

    let canUpdate = false
    if (isFreshEntry) {
        // Allow if user can reply or manage properties
        canUpdate = !!canReply || allPermissions.includes('ticket:properties:manage')
    } else {
        // Strictly require manage properties for modification
        canUpdate = allPermissions.includes('ticket:properties:manage')
    }

    if (!canUpdate) {
        return NextResponse.json({ error: 'You do not have permission to update this field' }, { status: 403 })
    }

    // 4. Update Value & Log Change
    try {
        const valueFrom = existingValue ? existingValue.value : null
        const valueTo = String(value)

        if (valueFrom === valueTo) {
            return NextResponse.json({ message: 'No change' })
        }

        // --- NEW: Capture Context (Parent Value) ---
        let contextData: Record<string, any> | null = null

        const currentFieldConfig = await prisma.ticketFieldDefinition.findUnique({
            where: { id: fieldDefinitionId },
            select: { key: true, apiConfig: true }
        })

        if (currentFieldConfig?.apiConfig) {
            const config = currentFieldConfig.apiConfig as any
            if (config.dependsOnFieldKey) {
                // Fetch the parent's current value from the ticket
                // Note: If we are clearing the child, the parent might have JUST changed (if frontend sends 2 requests).
                // But usually frontend clears child *then* updates parent? Or updates parent *then* clears child?
                // If parent changed first, we get new parent value. That's bad.
                // But wait, if parent changed, the *previous* value of parent is what we want? 
                // No, if I change Org A -> Org B. 
                // If frontend sends "Clear Service" first: Parent is still A. We capture A. Correct.
                // If frontend sends "Update Org" first: Parent is B. Then "Clear Service": We capture B. Incorrect.

                // However, let's look at the "Previous Value" of the parent? 
                // We can't easily know history here.
                // BUT, if the frontend sends the clearing request, the *activity log* for that clear should reflect the state *at that moment*.

                const parentValue = await prisma.ticketFieldValue.findFirst({
                    where: {
                        ticketId,
                        ticketFieldDefinition: { key: config.dependsOnFieldKey }
                    },
                    select: { value: true }
                })

                if (parentValue) {
                    contextData = { [config.dependsOnFieldKey]: parentValue.value }
                }
            }
        }


        // --- NEW: Find dependents and clear them ---
        // 1. Get the key of the field being updated
        const currentFieldDef = await prisma.ticketFieldDefinition.findUnique({
            where: { id: fieldDefinitionId },
            select: { key: true }
        })

        const dependentUpdates = []
        if (currentFieldDef && currentFieldDef.key) {
            // 2. Find fields that depend on this key
            const allDefinitions = await prisma.ticketFieldDefinition.findMany({
                select: { id: true, apiConfig: true }
            })

            const dependentDefIds = allDefinitions.filter(def => {
                const config = def.apiConfig as any
                return config && config.dependsOnFieldKey === currentFieldDef.key
            }).map(d => d.id)

            if (dependentDefIds.length > 0) {
                // Determine which of these actually have values for this ticket
                const dependentValues = await prisma.ticketFieldValue.findMany({
                    where: {
                        ticketId,
                        ticketFieldDefinitionId: { in: dependentDefIds },
                        value: { not: '' } // Only clear if not already empty
                    }
                })

                for (const dv of dependentValues) {
                    // Context for the dependent clear log: OLD value of the parent
                    // Use DB value first, fallback to request context (which frontend sends as lastValidContext)
                    let oldParentValue = existingValue?.value
                    if (!oldParentValue && reqContext && currentFieldDef.key && reqContext[currentFieldDef.key]) {
                        oldParentValue = reqContext[currentFieldDef.key]
                    }

                    const dependentClearContext = oldParentValue
                        ? { [currentFieldDef.key]: oldParentValue }
                        : undefined

                    dependentUpdates.push(
                        // Update to empty
                        prisma.ticketFieldValue.update({
                            where: { id: dv.id },
                            data: { value: '' }
                        }),
                        // Log the clear
                        prisma.ticketChangeCustomField.create({
                            data: {
                                ticketId,
                                ticketFieldDefinitionId: dv.ticketFieldDefinitionId,
                                changedById: actingAs.userTeamEntityId,
                                valueFrom: dv.value,
                                valueTo: '', // Cleared
                                changedAt: new Date(),
                                context: dependentClearContext
                            }
                        })
                    )
                }
            }
        }

        // Transaction: Update Value + Create Log + Clear Dependents
        const [updatedValue, change] = await prisma.$transaction([
            // Upsert Current Field Value
            prisma.ticketFieldValue.upsert({
                where: {
                    id: existingValue ? existingValue.id : -1
                },
                update: { value: valueTo },
                create: {
                    ticketId,
                    ticketFieldDefinitionId: fieldDefinitionId,
                    value: valueTo
                }
            }),
            // Create Change Log for Current Field
            prisma.ticketChangeCustomField.create({
                data: {
                    ticketId,
                    ticketFieldDefinitionId: fieldDefinitionId,
                    changedById: actingAs.userTeamEntityId,
                    valueFrom,
                    valueTo,
                    changedAt: new Date(),
                    context: contextData || undefined
                }
            }),
            ...dependentUpdates
        ])

        // Create Notification Event separately
        const event = await prisma.notificationEvent.create({
            data: {
                type: 'TICKET_CUSTOM_FIELD_CHANGED',
                onCustomFieldChangeId: change.id
            }
        })

        await enqueueNotificationInit(event.id)

        return NextResponse.json(updatedValue)

    } catch (error) {
        console.error('Error updating field:', error)
        return NextResponse.json({ error: 'Failed to update field' }, { status: 500 })
    }
}
