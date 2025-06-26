import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: number
      name?: string | null
      email?: string | null
      image?: string | null
      permissions: string[]
      teams: Array<{
        userTeamId: number
        teamId: number
        name: string
        permissions: string[]
        userTeamPermissions: string[]
        entityId: number | null
      }>
      actionUserTeamId: number | null
      actingAs: {
        userTeamId: number
        userTeamEntityId: number
        teamName: string
      } | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub?: string
  }
} 