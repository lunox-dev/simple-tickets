// src/lib/queues.ts
import { Queue } from 'bullmq'
import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is not set');
}
const connection = new Redis(redisUrl);

export const notificationQueue = new Queue('notifications', { connection })
