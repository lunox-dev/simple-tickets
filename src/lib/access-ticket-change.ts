import { Ticket } from '@/generated/prisma'
import { TicketAccessForUserResponse } from './access-ticket-user'
import { PermissionError } from './permission-error'

export function verifyChangePermission(
  access: TicketAccessForUserResponse,
  ticket: Ticket & { currentAssignedTo?: { id?: number, userTeamId?: number, teamId?: number } | null, createdBy?: { id?: number, userTeamId?: number, teamId?: number } | null },
  type: 'status' | 'priority' | 'category' | 'assigned',
  fromId: number | 'any',
  toId: number | 'any'
): void {
  // console.log('=== verifyChangePermission DEBUG ===', { type, fromId, toId, actionPermissions: access.actionPermissions })

  for (const p of access.actionPermissions) {
    const parts = p.split(':')

    if (parts[0] !== 'ticket' || parts[1] !== 'action') continue

    if (parts[2] === 'change' && parts[3] === type) {

      // Support permission strings with 'from:' and 'to:' in the nodes
      let pFrom, pTo, pContext, pScope
      if (parts[4] === 'from' && parts[6] === 'to') {
        // Format: ticket:action:change:status:from:any:to:any:assigned:any
        pFrom = parts[5]
        pTo = parts[7]
        pContext = parts[8]
        pScope = parts[9]
      } else {
        // Fallback to old format: ticket:action:change:status:any:any:assigned:any
        pFrom = parts[4]
        pTo = parts[5]
        pContext = parts[6]
        pScope = parts[7]
      }

      if (pFrom !== 'any' && Number(pFrom) !== fromId) continue
      if (pTo !== 'any' && Number(pTo) !== toId) continue

      for (const via of access.accessVia) {

        if (pContext === 'assigned' && via.type === 'assignment' && (ticket.currentAssignedTo?.userTeamId !== undefined || ticket.currentAssignedTo?.teamId !== undefined)) {
          if (
            (via.userTeamId && via.userTeamId === ticket.currentAssignedTo.userTeamId) ||
            (via.teamId && via.teamId === ticket.currentAssignedTo.teamId)
          ) {
            if (
              pScope === 'any' ||
              (pScope === 'team' && via.permission.endsWith(':team:any')) ||
              (pScope === 'self' && via.permission.endsWith(':self'))
            ) {
              return // Authorized
            }
          }
        }
        if (pContext === 'createdby' && via.type === 'creation' && (ticket.createdBy?.userTeamId !== undefined || ticket.createdBy?.teamId !== undefined)) {
          if (
            (via.userTeamId && via.userTeamId === ticket.createdBy.userTeamId) ||
            (via.teamId && via.teamId === ticket.createdBy.teamId)
          ) {
            if (
              pScope === 'any' ||
              (pScope === 'team' && via.permission.endsWith(':team:any')) ||
              (pScope === 'self' && via.permission.endsWith(':self'))
            ) {
              return // Authorized
            }
          }
        }
        // For assignment changes, also allow if user has creation access and the permission allows it
        if (type === 'assigned' && pContext === 'assigned' && via.type === 'creation' && (ticket.createdBy?.userTeamId !== undefined || ticket.createdBy?.teamId !== undefined)) {
          if (
            (via.userTeamId && via.userTeamId === ticket.createdBy.userTeamId) ||
            (via.teamId && via.teamId === ticket.createdBy.teamId)
          ) {
            if (
              pScope === 'any' ||
              (pScope === 'team' && via.permission.endsWith(':team:any')) ||
              (pScope === 'self' && via.permission.endsWith(':self'))
            ) {
              return // Authorized
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
            if (isAssigningToSelf) {
              return // Authorized
            }
          }
        }
      }
    }
  }

  // If we reach here, no matching permission was found.
  // We need to construct a meaningful error message.
  const requiredPermStub = `ticket:action:change:${type}:from:${fromId}:to:${toId}`
  throw new PermissionError(requiredPermStub, 'ticket', {
    ticketId: ticket.id,
    changeType: type,
    fromId,
    toId,
    reason: 'No matching permission rule found for your access level'
  })
}

export function hasChangePermission(
  access: TicketAccessForUserResponse,
  ticket: Ticket & { currentAssignedTo?: { id?: number, userTeamId?: number, teamId?: number } | null, createdBy?: { id?: number, userTeamId?: number, teamId?: number } | null },
  type: 'status' | 'priority' | 'category' | 'assigned',
  fromId: number | 'any',
  toId: number | 'any'
): boolean {
  try {
    verifyChangePermission(access, ticket, type, fromId, toId)
    return true
  } catch (e) {
    return false
  }
}

export function verifyThreadCreatePermission(
  access: TicketAccessForUserResponse,
  ticketEntityId?: number
): void {
  for (const p of access.actionPermissions) {
    const parts = p.split(':')
    if (parts[0] !== 'ticket' || parts[1] !== 'action' || parts[2] !== 'thread' || parts[3] !== 'create') {
      continue
    }

    const pScope = parts[4]

    for (const via of access.accessVia) {
      // Check assignment access
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
            return // Authorized
          }
        }
      }

      // Check creation access - if user has creation access and scope is 'any', allow thread creation
      if (via.type === 'creation') {
        if (
          pScope === 'any' ||
          (pScope === 'team' && via.permission.endsWith(':team:any')) ||
          (pScope === 'self' && via.permission.endsWith(':self'))
        ) {
          return // Authorized
        }
      }
    }
  }

  throw new PermissionError(
    'ticket:action:thread:create',
    'ticket:thread',
    { ticketEntityId }
  )
}

export function hasThreadCreatePermission(
  access: TicketAccessForUserResponse,
  ticketEntityId?: number
): boolean {
  try {
    verifyThreadCreatePermission(access, ticketEntityId)
    return true
  } catch (err) {
    return false
  }
} 