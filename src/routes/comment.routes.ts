import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenant, validate } from '../middleware';
import { prisma } from '../config/database';
import { sendSuccess, sendPaginated } from '../utils/response';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { WebhookService } from '../services/webhook.service';

export const commentRouter = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  taskId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(10000),
});

const commentQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20),
  taskId: z.string().uuid(),
});

// All routes require auth + tenant
commentRouter.use(authenticate, resolveTenant);

// ─── Routes ──────────────────────────────────────────────────────────────────

// List comments for a task
commentRouter.get(
  '/',
  validate(commentQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, perPage, taskId } = req.query as any;
      const orgId = req.organization!.id;

      // Verify task belongs to org
      const task = await prisma.task.findFirst({
        where: { id: taskId, project: { organizationId: orgId } },
      });
      if (!task) throw new NotFoundError('Task');

      const where = { taskId, parentId: null }; // Top-level comments only

      const [comments, total] = await Promise.all([
        prisma.comment.findMany({
          where,
          include: {
            author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            replies: {
              include: {
                author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          skip: (page - 1) * perPage,
          take: perPage,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.comment.count({ where }),
      ]);

      sendPaginated(res, comments, total, page, perPage);
    } catch (error) {
      next(error);
    }
  }
);

// Create comment
commentRouter.post(
  '/',
  validate(createCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { content, taskId, parentId } = req.body;
      const orgId = req.organization!.id;

      // Verify task belongs to org
      const task = await prisma.task.findFirst({
        where: { id: taskId, project: { organizationId: orgId } },
      });
      if (!task) throw new NotFoundError('Task');

      // Verify parent comment if provided
      if (parentId) {
        const parent = await prisma.comment.findFirst({
          where: { id: parentId, taskId },
        });
        if (!parent) throw new NotFoundError('Parent comment');
      }

      const comment = await prisma.comment.create({
        data: {
          content,
          taskId,
          authorId: req.user!.id,
          parentId,
        },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      });

      // Record activity
      await prisma.activity.create({
        data: {
          action: 'comment.created',
          taskId,
          userId: req.user!.id,
          metadata: { commentId: comment.id },
        },
      });

      // Dispatch webhook
      WebhookService.dispatchCommentEvent(
        { id: comment.id, content: content, taskId, authorId: req.user!.id },
        { organizationId: req.organization!.id, projectId: task!.projectId, actorId: req.user!.id }
      ).catch(() => {});

      sendSuccess(res, comment, 201);
    } catch (error) {
      next(error);
    }
  }
);

// Update comment
commentRouter.patch(
  '/:commentId',
  validate(updateCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comment = await prisma.comment.findUnique({
        where: { id: req.params.commentId as string },
        include: { task: { include: { project: true } } },
      });

      if (!comment || comment.task.project.organizationId !== req.organization!.id) {
        throw new NotFoundError('Comment');
      }

      // Only the author can edit
      if (comment.authorId !== req.user!.id) {
        throw new ForbiddenError('You can only edit your own comments');
      }

      const updated = await prisma.comment.update({
        where: { id: comment.id },
        data: { content: req.body.content },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }
);

// Delete comment
commentRouter.delete(
  '/:commentId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comment = await prisma.comment.findUnique({
        where: { id: req.params.commentId as string },
        include: { task: { include: { project: true } } },
      });

      if (!comment || comment.task.project.organizationId !== req.organization!.id) {
        throw new NotFoundError('Comment');
      }

      // Author or admin can delete
      const isAuthor = comment.authorId === req.user!.id;
      const isAdmin = req.membership!.role === 'OWNER' || req.membership!.role === 'ADMIN';

      if (!isAuthor && !isAdmin) {
        throw new ForbiddenError('Insufficient permissions to delete this comment');
      }

      await prisma.comment.delete({ where: { id: comment.id } });
      sendSuccess(res, { message: 'Comment deleted' });
    } catch (error) {
      next(error);
    }
  }
);
