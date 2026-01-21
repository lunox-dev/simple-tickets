import type { NextAuthOptions, Session } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email + OTP',
      credentials: {
        email: { label: 'Email', type: 'email' },
        otp: { label: 'OTP', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials) return null

        // Use the internal URL for server-to-server calls if available (e.g. Docker/K8s)
        // extending coverage to cases where the public URL is not resolvable from the container
        const baseUrl = process.env.NEXTAUTH_URL_INTERNAL || process.env.NEXTAUTH_URL

        const res = await fetch(`${baseUrl}/api/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: credentials.email,
            otp: credentials.otp,
          }),
        })

        const user = await res.json()

        // ✅ Check if user is active before allowing login
        if (res.ok && user?.id) {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { Active: true },
          })

          if (!dbUser?.Active) return null
          return user
        }

        return null
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async session({ session, token }: { session: Session; token: JWT }) {
      if (!token.sub) return session

      const user = await prisma.user.findUnique({
        where: { id: Number(token.sub) },
        include: {
          userTeams: {
            where: { Active: true },
            include: {
              team: true,
              entities: true,
            },
          },
          actionUserTeam: {
            include: {
              team: true,
              entities: true,
            },
          },
        },
      })

      if (!user || !user.Active) return session

      const teams = []

      for (const ut of user.userTeams) {
        // ✅ Skip teams where the team itself is not active
        if (!ut.team?.Active) continue

        // ✅ Ensure only one entity per userTeam
        if (ut.entities.length > 1) {
          console.warn(`UserTeam ${ut.id} has multiple entities — removing all.`)
          await prisma.entity.deleteMany({ where: { userTeamId: ut.id } })
          const created = await prisma.entity.create({ data: { userTeamId: ut.id } })
          ut.entities = [created]
        }

        const entityId = ut.entities[0]?.id ?? null

        teams.push({
          userTeamId: ut.id,
          teamId: ut.teamId,
          name: ut.team.name,
          permissions: [...new Set(ut.team.permissions)],
          userTeamPermissions: ut.permissions,
          entityId,
        })
      }

      const atu = user.actionUserTeam
      let actingAs = null
      if (atu && atu.Active && atu.team?.Active) {
        // Find or create the entity for this userTeam
        let entity = atu.entities[0]
        if (!entity) {
          // Create the entity if it doesn't exist (should be rare)
          entity = await prisma.entity.create({ data: { userTeamId: atu.id } })
        }
        actingAs = {
          userTeamId: atu.id,
          userTeamEntityId: entity.id,
          teamName: atu.team.name,
        }
      } else if (teams.length > 0) {
        // Default to the first team if no action team is selected OR selected one is inactive
        const defaultTeam = teams[0]
        // We need to resolve the entity ID for this default team.
        // It should be in the `teams` array already as we populated it above.
        let entityId = defaultTeam.entityId

        if (!entityId) {
          // Just in case entity didn't exist for that userTeam (logic above creates/cleans it though)
          const freshEnt = await prisma.entity.create({ data: { userTeamId: defaultTeam.userTeamId } })
          entityId = freshEnt.id
        }

        actingAs = {
          userTeamId: defaultTeam.userTeamId,
          userTeamEntityId: entityId,
          teamName: defaultTeam.name
        }
        // Ideally we should also update the user's preference in DB so next time it's faster?
        // But for now, just fixing the session is enough to unblock.
      }

      session.user = {
        id: user.id,
        name: user.displayName,
        email: user.email,
        permissions: user.permissions,
        teams,
        actionUserTeamId: user.actionUserTeamId,
        actingAs,
      }

      return session
    },
  },
} 