import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenant, validate } from '../middleware';
import { prisma } from '../config/database';
import { sendSuccess, sendPaginated } from '../utils/response';
import { NotFoundError } from '../utils/errors';
import { WebhookService } from '../services/webhook.service';

export const taskRouter = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  projectId: z.string().uuid(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']).default('TODO'),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().positive().optional(),
  parentId: z.string().uuid().optional(),
  sprintId: z.string().uuid().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  labelIds: z.array(z.string().uuid()).optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional().nullable(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedHours: z.number().positive().optional().nullable(),
  actualHours: z.number().positive().optional().nullable(),
  position: z.number().int().min(0).optional(),
  sprintId: z.string().uuid().optional().nullable(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  labelIds: z.array(z.string().uuid()).optional(),
});

const taskQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20),
  projectId: z.string().uuid().optional(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  assigneeId: z.string().uuid().optional(),
  sprintId: z.string().uuid().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'dueDate', 'position']).default('position'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// All task routes require auth + tenant context
taskRouter.use(authenticate, resolveTenant);

// ─── Routes ──────────────────────────────────────────────────────────────────

// List tasks
taskRouter.get(
  '/',
  validate(taskQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, perPage, projectId, status, priority, assigneeId, sprintId, search, sortBy, sortOrder } = req.query as any;
      const orgId = req.organization!.id;

      const where: any = {
        project: { organizationId: orgId },
      };

      if (projectId) where.projectId = projectId;
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (sprintId) where.sprintId = sprintId;
      if (assigneeId) {
        where.assignments = { some: { userId: assigneeId } };
      }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where,
          include: {
            assignments: {
              include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
            },
            taskLabels: { include: { label: true } },
            _count: { select: { comments: true, subtasks: true } },
          },
          skip: (page - 1) * perPage,
          take: perPage,
          orderBy: { [sortBy]: sortOrder },
        }),
        prisma.task.count({ where }),
      ]);

      sendPaginated(res, tasks, total, page, perPage);
    } catch (error) {
      next(error);
    }
  }
);

// Create task
taskRouter.post(
  '/',
  validate(createTaskSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId, assigneeIds, labelIds, ...data } = req.body;
      const orgId = req.organization!.id;

      // Verify project belongs to org
      const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId: orgId },
      });
      if (!project) throw new NotFoundError('Project');

      // Get next task number
      const lastTask = await prisma.task.findFirst({
        where: { projectId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const number = (lastTask?.number ?? 0) + 1;

      const task = await prisma.task.create({
        data: {
          ...data,
          number,
          projectId,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          assignments: assigneeIds?.length
            ? { create: assigneeIds.map((userId: string) => ({ userId })) }
            : undefined,
          taskLabels: labelIds?.length
            ? { create: labelIds.map((labelId: string) => ({ labelId })) }
            : undefined,
        },
        include: {
          assignments: {
            include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
          },
          taskLabels: { include: { label: true } },
        },
      });

      // Record activity
      await prisma.activity.create({
        data: {
          action: 'task.created',
          taskId: task.id,
          userId: req.user!.id,
          metadata: { title: task.title, number: task.number },
        },
      });

      // Dispatch webhook
      WebhookService.dispatchTaskEvent('task.created', {
        id: task.id,
        number: task.number,
        title: task.title,
        status: task.status,
        priority: task.priority,
        projectId,
      }, { organizationId: orgId, actorId: req.user!.id }).catch(() => {});

      sendSuccess(res, task, 201);
    } catch (error) {
      next(error);
    }
  }
);

// Get task by ID
taskRouter.get(
  '/:taskId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organization!.id;

      const task = await prisma.task.findFirst({
        where: {
          id: req.params.taskId as string,
          project: { organizationId: orgId },
        },
        include: {
          project: { select: { id: true, name: true, key: true } },
          assignments: {
            include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } } },
          },
          taskLabels: { include: { label: true } },
          subtasks: {
            select: { id: true, title: true, number: true, status: true, priority: true },
            orderBy: { position: 'asc' },
          },
          parent: { select: { id: true, title: true, number: true } },
          sprint: { select: { id: true, name: true, status: true } },
          _count: { select: { comments: true, attachments: true } },
        },
      });

      if (!task) throw new NotFoundError('Task');
      sendSuccess(res, task);
    } catch (error) {
      next(error);
    }
  }
);

// Update task
taskRouter.patch(
  '/:taskId',
  validate(updateTaskSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organization!.id;
      const { assigneeIds, labelIds, ...data } = req.body;

      const existing = await prisma.task.findFirst({
        where: { id: req.params.taskId as string, project: { organizationId: orgId } },
      });
      if (!existing) throw new NotFoundError('Task');

      // Track changes for activity log
      const changes: Record<string, { from: any; to: any }> = {};
      if (data.status && data.status !== existing.status) {
        changes['status'] = { from: existing.status, to: data.status };
      }
      if (data.priority && data.priority !== existing.priority) {
        changes['priority'] = { from: existing.priority, to: data.priority };
      }

      // Update assignments if provided
      if (assigneeIds !== undefined) {
        await prisma.taskAssignment.deleteMany({ where: { taskId: existing.id } });
        if (assigneeIds.length > 0) {
          await prisma.taskAssignment.createMany({
            data: assigneeIds.map((userId: string) => ({ taskId: existing.id, userId })),
          });
        }
      }

      // Update labels if provided
      if (labelIds !== undefined) {
        await prisma.taskLabel.deleteMany({ where: { taskId: existing.id } });
        if (labelIds.length > 0) {
          await prisma.taskLabel.createMany({
            data: labelIds.map((labelId: string) => ({ taskId: existing.id, labelId })),
          });
        }
      }

      const task = await prisma.task.update({
        where: { id: existing.id },
        data: {
          ...data,
          dueDate: data.dueDate !== undefined
            ? (data.dueDate ? new Date(data.dueDate) : null)
            : undefined,
        },
        include: {
          assignments: {
            include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
          },
          taskLabels: { include: { label: true } },
        },
      });

      // Record activity
      if (Object.keys(changes).length > 0) {
        await prisma.activity.create({
          data: {
            action: 'task.updated',
            taskId: task.id,
            userId: req.user!.id,
            metadata: { changes },
          },
        });
      }

      // Dispatch webhook
      const webhookEvent = changes['status'] ? 'task.status_changed' as const : 'task.updated' as const;
      WebhookService.dispatchTaskEvent(webhookEvent, {
        id: task.id,
        number: existing.number,
        title: task.title,
        status: task.status,
        priority: task.priority,
        projectId: existing.projectId,
      }, { organizationId: orgId, actorId: req.user!.id, changes }).catch(() => {});

      sendSuccess(res, task);
    } catch (error) {
      next(error);
    }
  }
);

// Delete task
taskRouter.delete(
  '/:taskId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organization!.id;

      const task = await prisma.task.findFirst({
        where: { id: req.params.taskId as string, project: { organizationId: orgId } },
      });
      if (!task) throw new NotFoundError('Task');

      await prisma.task.delete({ where: { id: task.id } });

      // Dispatch webhook
      WebhookService.dispatchTaskEvent('task.deleted', {
        id: task.id,
        number: task.number,
        title: task.title,
        status: task.status,
        priority: task.priority,
        projectId: task.projectId,
      }, { organizationId: orgId, actorId: req.user!.id }).catch(() => {});

      sendSuccess(res, { message: 'Task deleted' });
    } catch (error) {
      next(error);
    }
  }
);

// Get task activity/history
taskRouter.get(
  '/:taskId/activities',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organization!.id;

      const task = await prisma.task.findFirst({
        where: { id: req.params.taskId as string, project: { organizationId: orgId } },
      });
      if (!task) throw new NotFoundError('Task');

      const activities = await prisma.activity.findMany({
        where: { taskId: task.id },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      sendSuccess(res, activities);
    } catch (error) {
      next(error);
    }
  }
);
