import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenant, requireAdmin, validate } from '../middleware';
import { prisma } from '../config/database';
import { sendSuccess, sendPaginated } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { randomBytes } from 'crypto';

export const webhookRouter = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const webhookEvents = [
  'task.created', 'task.updated', 'task.deleted', 'task.status_changed',
  'comment.created', 'project.created', 'project.updated',
  'member.joined', 'member.removed',
] as const;

const createWebhookSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  events: z.array(z.enum(webhookEvents)).min(1, 'At least one event required'),
});

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(webhookEvents)).min(1).optional(),
  active: z.boolean().optional(),
});

// All routes require auth + tenant + admin
webhookRouter.use(authenticate, resolveTenant, requireAdmin);

// ─── Routes ──────────────────────────────────────────────────────────────────

// List webhooks
webhookRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhooks = await prisma.webhook.findMany({
        where: { organizationId: req.organization!.id },
        include: { _count: { select: { deliveries: true } } },
        orderBy: { createdAt: 'desc' },
      });

      sendSuccess(res, webhooks);
    } catch (error) {
      next(error);
    }
  }
);

// Create webhook
webhookRouter.post(
  '/',
  validate(createWebhookSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url, events } = req.body;

      const webhook = await prisma.webhook.create({
        data: {
          url,
          events,
          secret: randomBytes(32).toString('hex'),
          organizationId: req.organization!.id,
        },
      });

      sendSuccess(res, webhook, 201);
    } catch (error) {
      next(error);
    }
  }
);

// Get webhook details
webhookRouter.get(
  '/:webhookId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhook = await prisma.webhook.findFirst({
        where: { id: req.params.webhookId as string, organizationId: req.organization!.id },
        include: {
          deliveries: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      });

      if (!webhook) throw new NotFoundError('Webhook');
      sendSuccess(res, webhook);
    } catch (error) {
      next(error);
    }
  }
);

// Update webhook
webhookRouter.patch(
  '/:webhookId',
  validate(updateWebhookSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhook = await prisma.webhook.findFirst({
        where: { id: req.params.webhookId as string, organizationId: req.organization!.id },
      });
      if (!webhook) throw new NotFoundError('Webhook');

      const updated = await prisma.webhook.update({
        where: { id: webhook.id },
        data: req.body,
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }
);

// Delete webhook
webhookRouter.delete(
  '/:webhookId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhook = await prisma.webhook.findFirst({
        where: { id: req.params.webhookId as string, organizationId: req.organization!.id },
      });
      if (!webhook) throw new NotFoundError('Webhook');

      await prisma.webhook.delete({ where: { id: webhook.id } });
      sendSuccess(res, { message: 'Webhook deleted' });
    } catch (error) {
      next(error);
    }
  }
);

// Regenerate webhook secret
webhookRouter.post(
  '/:webhookId/rotate-secret',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhook = await prisma.webhook.findFirst({
        where: { id: req.params.webhookId as string, organizationId: req.organization!.id },
      });
      if (!webhook) throw new NotFoundError('Webhook');

      const updated = await prisma.webhook.update({
        where: { id: webhook.id },
        data: { secret: randomBytes(32).toString('hex') },
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }
);
