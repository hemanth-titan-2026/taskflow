import { Queue, QueueEvents } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

// ─── Queue Definitions ───────────────────────────────────────────────────────

const connection = { connection: redis };

export const emailQueue = new Queue('email', {
  ...connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const webhookQueue = new Queue('webhook', {
  ...connection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 1000,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const notificationQueue = new Queue('notification', {
  ...connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 1000,
    },
  },
});

export const analyticsQueue = new Queue('analytics', {
  ...connection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 1,
  },
});

export const reminderQueue = new Queue('reminder', {
  ...connection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
  },
});

// ─── Queue Event Logging ─────────────────────────────────────────────────────

const queues = [
  { name: 'email', queue: emailQueue },
  { name: 'webhook', queue: webhookQueue },
  { name: 'notification', queue: notificationQueue },
  { name: 'analytics', queue: analyticsQueue },
  { name: 'reminder', queue: reminderQueue },
];

export function initializeQueueEvents(): void {
  for (const { name, queue } of queues) {
    const events = new QueueEvents(name, { connection: redis });

    events.on('completed', ({ jobId }) => {
      logger.debug(`Job completed`, { queue: name, jobId });
    });

    events.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Job failed`, { queue: name, jobId, reason: failedReason });
    });
  }
}

// ─── Job Dispatchers ─────────────────────────────────────────────────────────

export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

export interface WebhookJobData {
  webhookId: string;
  event: string;
  payload: Record<string, any>;
  url: string;
  secret: string;
}

export interface NotificationJobData {
  userId: string;
  type: string;
  title: string;
  body?: string;
  metadata?: Record<string, any>;
}

export interface ReminderJobData {
  taskId: string;
  userId: string;
  taskTitle: string;
  dueDate: string;
}

export interface AnalyticsJobData {
  event: string;
  orgId: string;
  metadata: Record<string, any>;
  timestamp: string;
}

export class QueueService {
  static async sendEmail(data: EmailJobData): Promise<void> {
    await emailQueue.add('send', data, {
      priority: data.template === 'password-reset' ? 1 : 3,
    });
  }

  static async dispatchWebhook(data: WebhookJobData): Promise<void> {
    await webhookQueue.add('deliver', data);
  }

  static async createNotification(data: NotificationJobData): Promise<void> {
    await notificationQueue.add('create', data);
  }

  static async scheduleReminder(data: ReminderJobData, delayMs: number): Promise<void> {
    await reminderQueue.add('remind', data, { delay: delayMs });
  }

  static async trackAnalytics(data: AnalyticsJobData): Promise<void> {
    await analyticsQueue.add('track', data);
  }

  static async getQueueStats() {
    const stats = await Promise.all(
      queues.map(async ({ name, queue }) => {
        const counts = await queue.getJobCounts();
        return { name, ...counts };
      })
    );
    return stats;
  }
}
