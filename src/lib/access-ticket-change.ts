import { Ticket } from '@/generated/prisma'
import { TicketAccessForUserResponse } from './access-ticket-user'

export function hasChangePermission(
  access: TicketAccessForUserResponse,
  ticket: Ticket & { currentAssignedTo?: { id?: number } | null, createdBy?: { id?: number } | null },
  type: 'status' | 'priority' | 'category' | 'assigned',
  fromId: number | 'any',
  toId: number | 'any'
): boolean {
  for (const p of access.actionPermissions) {
    const parts = p.split(':')
    if (parts[0] !== 'ticket' || parts[1] !== 'action') continue

    if (parts[2] === 'change' && parts[3] === type) {
      if (type === 'status' || type === 'priority' || type === 'category') {
        // ticket:action:change:<type>:<from>:<to>:<context>:<scope>
        const pFrom = parts[4]
        const pTo = parts[5]
        const pContext = parts[6]
        const pScope = parts[7]

        if (pFrom !== 'any' && Number(pFrom) !== fromId) continue
        if (pTo !== 'any' && Number(pTo) !== toId) continue

        for (const via of access.accessVia) {
          // Use entityId for assignment/creation context
          if (pContext === 'assigned' && via.type === 'assignment' && ticket.currentAssignedTo?.id !== undefined) {
            if (
              (via.userTeamId && via.userTeamId === ticket.currentAssignedTo.id) ||
              (via.teamId && via.teamId === ticket.currentAssignedTo.id)
            ) {
              if (
                pScope === 'any' ||
                (pScope === 'team' && via.permission.endsWith(':team:any')) ||
                (pScope === 'self' && via.permission.endsWith(':self'))
              ) {
                return true
              }
            }
          }
          if (pContext === 'createdby' && via.type === 'creation' && ticket.createdBy?.id !== undefined) {
            if (
              (via.userTeamId && via.userTeamId === ticket.createdBy.id) ||
              (via.teamId && via.teamId === ticket.createdBy.id)
            ) {
              if (
                pScope === 'any' ||
                (pScope === 'team' && via.permission.endsWith(':team:any')) ||
                (pScope === 'self' && via.permission.endsWith(':self'))
              ) {
                return true
              }
            }
          }
        }
      } else if (type === 'assigned') {
        // ticket:action:change:assigned:<scope>
        // fromId is the userTeamId being assigned FROM
        // toId is the userTeamId being assigned TO
        const pScope = parts[4]
        for (const via of access.accessVia) {
          if (via.type === 'assignment' && ticket.currentAssignedTo?.id !== undefined) {
            if (
              (via.userTeamId && via.userTeamId === ticket.currentAssignedTo.id) ||
              (via.teamId && via.teamId === ticket.currentAssignedTo.id)
            ) {
              if (
                pScope === 'any' ||
                (pScope === 'team' && via.permission.endsWith(':team:any')) ||
                (pScope === 'self' && via.permission.endsWith(':self')) ||
                (pScope === 'team:unclaimed' && via.permission.endsWith(':team:unclaimed'))
              ) {
                return true
              }
            }
          }
        }
      }
    } else if (parts[2] === 'claim' && type === 'assigned') {
      // ticket:action:claim:<scope>
      // This is for assigning an unassigned ticket to yourself.
      // fromId should be null/0 and toId should be one of the user's userTeamIds
      const pScope = parts[3]
      if (fromId === 'any' || fromId === 0) { // Unassigned
         for (const via of access.accessVia) {
            if (
              (pScope === 'any' && via.type === 'assignment') ||
              (pScope === 'unclaimed' && via.permission.endsWith(':team:unclaimed'))
            ) {
              // Check if the user is assigning to themselves
              const isAssigningToSelf = access.accessVia.some(v => v.userTeamId === toId)
              if (isAssigningToSelf) return true
            }
        }
      }
    }
  }

  return false
}

export function hasThreadCreatePermission(
  access: TicketAccessForUserResponse,
  ticketEntityId?: number
): boolean {
  for (const p of access.actionPermissions) {
    const parts = p.split(':')
    if (parts[0] !== 'ticket' || parts[1] !== 'action' || parts[2] !== 'thread' || parts[3] !== 'create') {
      continue
    }

    const pScope = parts[4]

    for (const via of access.accessVia) {
      if (via.type === 'assignment' && ticketEntityId !== undefined) {
        if (
          (via.userTeamId && via.userTeamId === ticketEntityId) ||
          (via.teamId && via.teamId === ticketEntityId)
        ) {
          if (
            pScope === 'any' ||
            (pScope === 'team' && via.permission.endsWith(':team:any')) ||
            (pScope === 'self' && via.permission.endsWith(':self')) ||
            (pScope === 'team:unclaimed' && via.permission.endsWith(':team:unclaimed'))
          ) {
            return true
          }
        }
      }
    }
  }

  return false
} 