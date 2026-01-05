import { PermissionError } from './permission-error'

export function verifyAssignmentChangePermission(
    userTeams: any[],
    fromUserTeamId: number,
    toUserTeamId: number
): void {
    for (const team of userTeams) {
        const combinedPerms = [
            ...team.userTeamPermissions.map((p: any) => ({ from: 'userTeam' as const, value: p })),
            ...team.permissions.map((p: any) => ({ from: 'team' as const, value: p }))
        ]

        for (const perm of combinedPerms) {
            const parts = perm.value.split(':')

            // Check for ticket:action:change:assigned:any
            if (parts[0] === 'ticket' && parts[1] === 'action' && parts[2] === 'change' && parts[3] === 'assigned') {
                if (parts[4] === 'any') {
                    return // Allowed
                }

                // Check for specific assignment permissions like ticket:action:change:assigned:from:own:to:any:assigned:own
                if (parts[4] === 'from' && parts[6] === 'to') {
                    const pFrom = parts[5]
                    const pTo = parts[7]
                    const pContext = parts[8]
                    const pScope = parts[9]

                    // Check if from condition matches
                    if (pFrom === 'any' || (pFrom === 'own' && fromUserTeamId === team.userTeamId)) {
                        // Check if to condition matches
                        if (pTo === 'any' || (pTo === 'own' && toUserTeamId === team.userTeamId)) {
                            // Check context and scope
                            if (pContext === 'assigned' && (pScope === 'any' || pScope === 'own')) {
                                return // Allowed
                            }
                        }
                    }
                }
            }
        }
    }

    throw new PermissionError(
        `ticket:action:change:assigned:from:${fromUserTeamId}:to:${toUserTeamId}`,
        'ticket:assignment',
        { fromUserTeamId, toUserTeamId }
    )
}
