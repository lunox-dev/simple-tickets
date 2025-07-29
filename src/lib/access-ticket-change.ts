import { Ticket } from '@/generated/prisma'
import { TicketAccessForUserResponse } from './access-ticket-user'

export function hasChangePermission(
  access: TicketAccessForUserResponse,
  ticket: Ticket & { currentAssignedTo?: { id?: number, userTeamId?: number, teamId?: number } | null, createdBy?: { id?: number, userTeamId?: number, teamId?: number } | null },
  type: 'status' | 'priority' | 'category' | 'assigned',
  fromId: number | 'any',
  toId: number | 'any'
): boolean {
  console.log('=== hasChangePermission DEBUG ===')
  console.log('Type:', type)
  console.log('FromId:', fromId)
  console.log('ToId:', toId)
  console.log('ActionPermissions:', access.actionPermissions)
  
  for (const p of access.actionPermissions) {
    const parts = p.split(':')
    console.log('Checking permission:', p)
    console.log('Parts:', parts)
    
    if (parts[0] !== 'ticket' || parts[1] !== 'action') {
      console.log('Skipping - not ticket:action')
      continue
    }

    if (parts[2] === 'change' && parts[3] === type) {
      console.log('Found matching change permission')
      
      // Support permission strings with 'from:' and 'to:' in the nodes
      let pFrom, pTo, pContext, pScope
      if (parts[4] === 'from' && parts[6] === 'to') {
        // Format: ticket:action:change:status:from:any:to:any:assigned:any
        pFrom = parts[5]
        pTo = parts[7]
        pContext = parts[8]
        pScope = parts[9]
        console.log('New format - pFrom:', pFrom, 'pTo:', pTo, 'pContext:', pContext, 'pScope:', pScope)
      } else {
        // Fallback to old format: ticket:action:change:status:any:any:assigned:any
        pFrom = parts[4]
        pTo = parts[5]
        pContext = parts[6]
        pScope = parts[7]
        console.log('Old format - pFrom:', pFrom, 'pTo:', pTo, 'pContext:', pContext, 'pScope:', pScope)
      }

      if (pFrom !== 'any' && Number(pFrom) !== fromId) {
        console.log('FromId mismatch - skipping')
        continue
      }
      if (pTo !== 'any' && Number(pTo) !== toId) {
        console.log('ToId mismatch - skipping')
        continue
      }

      console.log('FromId and ToId match, checking accessVia')
      for (const via of access.accessVia) {
        console.log('Checking via:', via)
        
        if (pContext === 'assigned' && via.type === 'assignment' && (ticket.currentAssignedTo?.userTeamId !== undefined || ticket.currentAssignedTo?.teamId !== undefined)) {
          console.log('Checking assigned context with assignment access')
          if (
            (via.userTeamId && via.userTeamId === ticket.currentAssignedTo.userTeamId) ||
            (via.teamId && via.teamId === ticket.currentAssignedTo.teamId)
          ) {
            console.log('Assignment access matches')
            if (
              pScope === 'any' ||
              (pScope === 'team' && via.permission.endsWith(':team:any')) ||
              (pScope === 'self' && via.permission.endsWith(':self'))
            ) {
              console.log('Scope check passed - returning true')
              return true
            } else {
              console.log('Scope check failed - pScope:', pScope, 'via.permission:', via.permission)
            }
          } else {
            console.log('Assignment access does not match')
          }
        }
        if (pContext === 'createdby' && via.type === 'creation' && (ticket.createdBy?.userTeamId !== undefined || ticket.createdBy?.teamId !== undefined)) {
          console.log('Checking createdby context with creation access')
          if (
            (via.userTeamId && via.userTeamId === ticket.createdBy.userTeamId) ||
            (via.teamId && via.teamId === ticket.createdBy.teamId)
          ) {
            console.log('Creation access matches')
            if (
              pScope === 'any' ||
              (pScope === 'team' && via.permission.endsWith(':team:any')) ||
              (pScope === 'self' && via.permission.endsWith(':self'))
            ) {
              console.log('Scope check passed - returning true')
              return true
            } else {
              console.log('Scope check failed - pScope:', pScope, 'via.permission:', via.permission)
            }
          } else {
            console.log('Creation access does not match')
          }
        }
        // For assignment changes, also allow if user has creation access and the permission allows it
        if (type === 'assigned' && pContext === 'assigned' && via.type === 'creation' && (ticket.createdBy?.userTeamId !== undefined || ticket.createdBy?.teamId !== undefined)) {
          console.log('Checking assignment change with creation access (assigned context)')
          if (
            (via.userTeamId && via.userTeamId === ticket.createdBy.userTeamId) ||
            (via.teamId && via.teamId === ticket.createdBy.teamId)
          ) {
            console.log('Creation access matches for assignment change')
            if (
              pScope === 'any' ||
              (pScope === 'team' && via.permission.endsWith(':team:any')) ||
              (pScope === 'self' && via.permission.endsWith(':self'))
            ) {
              console.log('Scope check passed for assignment change - returning true')
              return true
            } else {
              console.log('Scope check failed for assignment change - pScope:', pScope, 'via.permission:', via.permission)
            }
          } else {
            console.log('Creation access does not match for assignment change')
          }
        }
      }
    } else if (parts[2] === 'claim' && type === 'assigned') {
      console.log('Checking claim permission')
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
                console.log('Claim permission check passed - returning true')
                return true
              }
            }
        }
      }
    }
  }

  console.log('No matching permissions found - returning false')
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
            return true
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
          return true
        }
      }
    }
  }

  return false
} 