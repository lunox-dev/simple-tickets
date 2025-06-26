import { Queue } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis(process.env.REDIS_URL as string, {
  maxRetriesPerRequest: null,
})

const notificationQueue = new Queue('notifications', { connection })

export async function enqueueNotificationInit(eventId: number) {
  await notificationQueue.add('notification-init', { eventId })
} 