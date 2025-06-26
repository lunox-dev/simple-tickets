// src/lib/prisma.ts
import { PrismaClient } from '@/generated/prisma'
// import { encrypt, decrypt } from './encryption'

declare global {
  // Prevent multiple instances of Prisma Client in development
  var prisma: PrismaClient
}

export const prisma = global.prisma ||= new PrismaClient()
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

// ────────────────────────────────────────────────────────────────────────────────
// 1) Auto-encrypt before create/update on TicketThread.body & TicketFieldValue.value
// prisma.$use(async (params, next) => {
//   const { model, action } = params
//
//   const shouldEncrypt =
//     ['TicketThread', 'TicketFieldValue'].includes(model!) &&
//     ['create', 'update'].includes(action!)
//
//   if (shouldEncrypt) {
//     const data = params.args?.data as Record<string, any>
//     if (data.body)  data.body  = encrypt(data.body)
//     if (data.value) data.value = encrypt(data.value)
//   }
//
//   return next(params)
// })

// ────────────────────────────────────────────────────────────────────────────────
// 2) Auto-decrypt after any find* on those same models
// prisma.$use(async (params, next) => {
//   const result = await next(params)
//   const { model, action } = params
//
//   const shouldDecrypt =
//     ['TicketThread', 'TicketFieldValue'].includes(model!) &&
//     ['findUnique', 'findFirst', 'findMany'].includes(action!)
//
//   if (shouldDecrypt && result) {
//     const decryptOne = (row: any) => {
//       if (row.body)  row.body  = decrypt(row.body)
//       if (row.value) row.value = decrypt(row.value)
//       return row
//     }
//
//     return Array.isArray(result)
//       ? result.map(decryptOne)
//       : decryptOne(result)
//   }
//
//   return result
// })

// ────────────────────────────────────────────────────────────────────────────────
// 3) Auto-decrypt nested threads & fieldValues in Ticket.find* calls
// prisma.$use(async (params, next) => {
//   const result = await next(params)
//   const { model, action } = params
//
//   if (
//     model === 'Ticket' &&
//     ['findUnique', 'findFirst', 'findMany'].includes(action!)
//   ) {
//     const decryptNested = (ticket: any) => {
//       if (Array.isArray(ticket.threads)) {
//         ticket.threads = ticket.threads.map((t: any) => {
//           if (t.body) {
//             try { t.body = decrypt(t.body) }
//             catch { t.body = '[decryption error]' }
//           }
//           return t
//         })
//       }
//       if (Array.isArray(ticket.fieldValues)) {
//         ticket.fieldValues = ticket.fieldValues.map((fv: any) => {
//           if (fv.value) {
//             try { fv.value = decrypt(fv.value) }
//             catch { fv.value = '[decryption error]' }
//           }
//           return fv
//         })
//       }
//       return ticket
//     }
//
//     if (Array.isArray(result)) {
//       return result.map(decryptNested)
//     } else if (result) {
//       return decryptNested(result)
//     }
//   }
//
//   return result
// })

// ────────────────────────────────────────────────────────────────────────────────
// 4) Your existing helper to ensure one Entity per team/userTeam/apiKey
async function ensureEntityRecords() {
  // Helper: clear invalid or duplicate entities
  async function cleanEntities() {
    const entities = await prisma.entity.findMany()
    const seen = new Set<string>()

    for (const e of entities) {
      const keys = [e.teamId, e.userTeamId, e.apiKeyId]
      const nonNull = keys.filter(k => k !== null)

      // Enforce exactly one parent reference
      if (nonNull.length !== 1) {
        console.warn(`Deleting invalid entity id=${e.id}`)
        await prisma.entity.delete({ where: { id: e.id } })
        continue
      }

      // Deduplicate by composite key
      const key = `t:${e.teamId ?? ''}|ut:${e.userTeamId ?? ''}|api:${e.apiKeyId ?? ''}`
      if (seen.has(key)) {
        console.warn(`Deleting duplicate entity for key=${key} id=${e.id}`)
        await prisma.entity.delete({ where: { id: e.id } })
        continue
      }
      seen.add(key)
    }
  }

  await cleanEntities()

  // Ensure one Entity per Team
  const teams = await prisma.team.findMany({ select: { id: true } })
  for (const { id: teamId } of teams) {
    const exists = await prisma.entity.findFirst({ where: { teamId } })
    if (!exists) {
      await prisma.entity.create({ data: { teamId } })
      console.log(`Created entity for teamId=${teamId}`)
    }
  }

  // Ensure one Entity per UserTeam
  const uts = await prisma.userTeam.findMany({ select: { id: true } })
  for (const { id: userTeamId } of uts) {
    const exists = await prisma.entity.findFirst({ where: { userTeamId } })
    if (!exists) {
      await prisma.entity.create({ data: { userTeamId } })
      console.log(`Created entity for userTeamId=${userTeamId}`)
    }
  }

  // Ensure one Entity per ApiKey
  const keys = await prisma.apiKey.findMany({ select: { id: true } })
  for (const { id: apiKeyId } of keys) {
    const exists = await prisma.entity.findFirst({ where: { apiKeyId } })
    if (!exists) {
      await prisma.entity.create({ data: { apiKeyId } })
      console.log(`Created entity for apiKeyId=${apiKeyId}`)
    }
  }
}

ensureEntityRecords().catch(err => {
  console.error('Error ensuring entity records:', err)
})
