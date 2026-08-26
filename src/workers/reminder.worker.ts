import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { ReminderJobData, QueueService } from '../services/queue.service';

/**
 * Reminder worker - sends task due date reminders via notifications and email.
 */
export function createReminderWorker(): Worker {
  const worker = new Worker<ReminderJobData>(
    'reminder',
    async (job: Job<ReminderJobData>) => {
      const { taskId, userId, taskTitle, dueDate } = job.data;

      logger.info('Processing reminder', { jobId: job.id, taskId, userId });

      // Create in-app notification
      await QueueService.createNotification({
        userId,
        type: 'task.due_reminder',
        title: 'Task Due Soon',
        body: `"${taskTitle}" is due on ${new Date(dueDate).toLocaleDateString()}`,
        metadata: { taskId, dueDate },
      });

      // Send email reminder
      await QueueService.sendEmail({
        to: userId, // Will be resolved to email in email worker
        subject: `Reminder: "${taskTitle}" is due soon`,
        template: 'task-reminder',
        context: { taskTitle, dueDate, taskId },
      });

      logger.info('Reminder processed', { jobId: job.id, taskId });
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('Reminder job failed', {
      jobId: job?.id,
      error: err.message,
    });
  });

  return worker;
}
