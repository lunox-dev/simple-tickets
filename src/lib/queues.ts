// src/lib/queues.ts
import { Queue } from 'bullmq'
import Redis from 'ioredis'

const connection = new Redis(process.env.REDIS_URL)

export const notificationQueue = new Queue('notifications', { connection })
