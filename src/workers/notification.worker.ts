import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { NotificationJobData } from '../services/queue.service';

/**
 * Notification worker - creates in-app notifications and can trigger
 * push notifications or email digests.
 */
export function createNotificationWorker(): Worker {
  const worker = new Worker<NotificationJobData>(
    'notification',
    async (job: Job<NotificationJobData>) => {
      const { userId, type, title, body, metadata } = job.data;

      logger.info('Creating notification', { jobId: job.id, userId, type });

      // Create notification in database
      await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          body,
          metadata,
        },
      });

      // Publish to Redis for real-time delivery via WebSocket
      await redis.publish(
        `notifications:${userId}`,
        JSON.stringify({ type, title, body, metadata, createdAt: new Date().toISOString() })
      );

      logger.info('Notification created', { jobId: job.id, userId, type });
    },
    {
      connection: redis,
      concurrency: 20,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('Notification job failed', {
      jobId: job?.id,
      error: err.message,
    });
  });

  return worker;
}
