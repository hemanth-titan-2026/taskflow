import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, validate } from '../middleware';
import { prisma } from '../config/database';
import { sendSuccess, sendPaginated } from '../utils/response';

export const notificationRouter = Router();

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20),
  unreadOnly: z.coerce.boolean().default(false),
});

// All routes require auth
notificationRouter.use(authenticate);

// List notifications
notificationRouter.get(
  '/',
  validate(querySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, perPage, unreadOnly } = req.query as any;
      const userId = req.user!.id;

      const where: any = { userId };
      if (unreadOnly) where.read = false;

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip: (page - 1) * perPage,
          take: perPage,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.notification.count({ where }),
      ]);

      sendPaginated(res, notifications, total, page, perPage);
    } catch (error) {
      next(error);
    }
  }
);

// Mark notification as read
notificationRouter.patch(
  '/:notificationId/read',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.notification.updateMany({
        where: { id: req.params.notificationId as string, userId: req.user!.id },
        data: { read: true },
      });
      sendSuccess(res, { message: 'Marked as read' });
    } catch (error) {
      next(error);
    }
  }
);

// Mark all notifications as read
notificationRouter.post(
  '/mark-all-read',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.user!.id, read: false },
        data: { read: true },
      });
      sendSuccess(res, { message: 'All notifications marked as read' });
    } catch (error) {
      next(error);
    }
  }
);

// Get unread count
notificationRouter.get(
  '/unread-count',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const count = await prisma.notification.count({
        where: { userId: req.user!.id, read: false },
      });
      sendSuccess(res, { count });
    } catch (error) {
      next(error);
    }
  }
);
