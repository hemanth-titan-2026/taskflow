import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { EmailJobData } from '../services/queue.service';

/**
 * Email worker - processes email sending jobs.
 * In production, integrate with SendGrid, SES, or similar.
 */
export function createEmailWorker(): Worker {
  const worker = new Worker<EmailJobData>(
    'email',
    async (job: Job<EmailJobData>) => {
      const { to, subject, template, context } = job.data;

      logger.info('Processing email job', {
        jobId: job.id,
        to,
        subject,
        template,
      });

      // In production, this would call your email service:
      // await sendgrid.send({ to, subject, templateId, dynamicTemplateData: context });
      // await ses.sendTemplatedEmail({ ... });

      // Simulate email sending
      await simulateEmailSend(to, subject, template, context);

      logger.info('Email sent successfully', { jobId: job.id, to, template });
    },
    {
      connection: redis,
      concurrency: 5,
      limiter: {
        max: 50,
        duration: 60000, // Max 50 emails per minute
      },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('Email job failed', {
      jobId: job?.id,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  return worker;
}

async function simulateEmailSend(
  to: string,
  subject: string,
  template: string,
  context: Record<string, any>
): Promise<void> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Log for development
  logger.debug('Email sent (simulated)', {
    to,
    subject,
    template,
    context: JSON.stringify(context).slice(0, 200),
  });
}
