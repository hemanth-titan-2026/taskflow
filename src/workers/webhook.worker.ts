import { Worker, Job } from 'bullmq';
import { createHmac } from 'crypto';
import { redis } from '../config/redis';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { WebhookJobData } from '../services/queue.service';

/**
 * Webhook delivery worker - sends webhook payloads to registered URLs with HMAC signatures.
 */
export function createWebhookWorker(): Worker {
  const worker = new Worker<WebhookJobData>(
    'webhook',
    async (job: Job<WebhookJobData>) => {
      const { webhookId, event, payload, url, secret } = job.data;

      logger.info('Delivering webhook', { jobId: job.id, webhookId, event, url });

      // Generate HMAC signature
      const body = JSON.stringify(payload);
      const signature = createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      const startTime = Date.now();

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event,
            'X-Webhook-Signature': `sha256=${signature}`,
            'X-Webhook-Id': webhookId,
            'X-Delivery-Id': job.id || '',
            'User-Agent': 'TaskFlow-Webhook/1.0',
          },
          body,
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        const responseBody = await response.text().catch(() => '');
        const duration = Date.now() - startTime;

        // Record delivery
        await prisma.webhookDelivery.create({
          data: {
            webhookId,
            event,
            payload,
            responseStatus: response.status,
            responseBody: responseBody.slice(0, 1000),
            success: response.ok,
            attempts: job.attemptsMade + 1,
            deliveredAt: new Date(),
          },
        });

        if (!response.ok) {
          throw new Error(`Webhook delivery failed with status ${response.status}: ${responseBody.slice(0, 200)}`);
        }

        logger.info('Webhook delivered successfully', {
          jobId: job.id,
          webhookId,
          status: response.status,
          duration,
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;

        // Record failed delivery
        await prisma.webhookDelivery.create({
          data: {
            webhookId,
            event,
            payload,
            responseStatus: null,
            responseBody: error.message?.slice(0, 1000),
            success: false,
            attempts: job.attemptsMade + 1,
          },
        });

        logger.error('Webhook delivery failed', {
          jobId: job.id,
          webhookId,
          error: error.message,
          duration,
          attempt: job.attemptsMade + 1,
        });

        throw error; // Re-throw to trigger retry
      }
    },
    {
      connection: redis,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 60000,
      },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('Webhook job failed permanently', {
      jobId: job?.id,
      error: err.message,
      attempts: job?.attemptsMade,
    });

    // Disable webhook after max failures
    if (job && job.attemptsMade >= 5) {
      disableWebhookAfterFailure(job.data.webhookId).catch(() => {});
    }
  });

  return worker;
}

async function disableWebhookAfterFailure(webhookId: string): Promise<void> {
  try {
    await prisma.webhook.update({
      where: { id: webhookId },
      data: { active: false },
    });
    logger.warn('Webhook disabled due to repeated failures', { webhookId });
  } catch {
    // Ignore errors during cleanup
  }
}
