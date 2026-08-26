import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { AnalyticsJobData } from '../services/queue.service';

/**
 * Analytics worker - processes event tracking for usage metrics and reporting.
 * In production, this would forward to a data warehouse (BigQuery, Redshift, etc.)
 */
export function createAnalyticsWorker(): Worker {
  const worker = new Worker<AnalyticsJobData>(
    'analytics',
    async (job: Job<AnalyticsJobData>) => {
      const { event, orgId, metadata, timestamp } = job.data;

      // Increment daily counters in Redis
      const dayKey = timestamp.split('T')[0]; // YYYY-MM-DD
      const counterKey = `analytics:${orgId}:${dayKey}:${event}`;

      await redis.incr(counterKey);
      await redis.expire(counterKey, 90 * 24 * 60 * 60); // Keep 90 days

      // Increment total event counter
      await redis.hincrby(`analytics:${orgId}:totals`, event, 1);

      logger.debug('Analytics event tracked', { event, orgId, timestamp });

      // In production, batch and forward to analytics service:
      // await bigquery.insertRows('events', [{ event, orgId, metadata, timestamp }]);
    },
    {
      connection: redis,
      concurrency: 20,
      limiter: {
        max: 500,
        duration: 60000,
      },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('Analytics job failed', {
      jobId: job?.id,
      error: err.message,
    });
  });

  return worker;
}
