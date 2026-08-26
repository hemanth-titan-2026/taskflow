import { logger } from '../utils/logger';
import { createEmailWorker } from './email.worker';
import { createWebhookWorker } from './webhook.worker';
import { createNotificationWorker } from './notification.worker';
import { createReminderWorker } from './reminder.worker';
import { createAnalyticsWorker } from './analytics.worker';
import { initializeQueueEvents } from '../services/queue.service';

/**
 * Worker process entry point.
 * Run with: npm run worker
 * 
 * Starts all BullMQ workers and queue event listeners.
 * Can be scaled horizontally by running multiple instances.
 */
async function startWorkers(): Promise<void> {
  logger.info('Starting TaskFlow workers...');

  // Initialize queue event listeners
  initializeQueueEvents();

  // Start all workers
  const workers = [
    { name: 'Email', worker: createEmailWorker() },
    { name: 'Webhook', worker: createWebhookWorker() },
    { name: 'Notification', worker: createNotificationWorker() },
    { name: 'Reminder', worker: createReminderWorker() },
    { name: 'Analytics', worker: createAnalyticsWorker() },
  ];

  for (const { name } of workers) {
    logger.info(`${name} worker started`);
  }

  logger.info(`All ${workers.length} workers running`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down workers...`);

    await Promise.all(
      workers.map(async ({ name, worker }) => {
        await worker.close();
        logger.info(`${name} worker stopped`);
      })
    );

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startWorkers().catch((error) => {
  logger.error('Failed to start workers', { error });
  process.exit(1);
});
