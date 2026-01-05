
import { NextResponse } from 'next/server'

export class PermissionError extends Error {
    public requiredPermission: string
    public scope: string
    public context?: any

    constructor(requiredPermission: string, scope: string = 'unknown', context?: any) {
        super(`Missing permission: ${requiredPermission} for scope: ${scope}`)
        this.name = 'PermissionError'
        this.requiredPermission = requiredPermission
        this.scope = scope
        this.context = context
    }
}

export function handlePermissionError(error: unknown) {
    if (error instanceof PermissionError) {
        return NextResponse.json({
            error: 'Forbidden',
            details: {
                missingPermission: error.requiredPermission,
                scope: error.scope,
                context: error.context
            }
        }, { status: 403 })
    }
    // Let other errors bubble up or be handled by the caller
    // Let other errors bubble up or be handled by the caller
    throw error
}

export function verifyPermission(permissions: Set<string> | string[], required: string, scope: string, context?: any) {
    const has = Array.isArray(permissions) ? permissions.includes(required) : permissions.has(required)
    if (!has) {
        throw new PermissionError(required, scope, context)
    }
}
