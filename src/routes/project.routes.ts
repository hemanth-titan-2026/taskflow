import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenant, requireAdmin, validate } from '../middleware';
import { prisma } from '../config/database';
import { sendSuccess, sendPaginated } from '../utils/response';
import { NotFoundError, ConflictError } from '../utils/errors';

export const projectRouter = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  key: z.string().min(2).max(10).regex(/^[A-Z0-9]+$/, 'Key must be uppercase alphanumeric'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PRIVATE'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'COMPLETED']).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'COMPLETED']).optional(),
  search: z.string().optional(),
});

// All project routes require auth + tenant context
projectRouter.use(authenticate, resolveTenant);

// ─── Routes ──────────────────────────────────────────────────────────────────

// List projects
projectRouter.get(
  '/',
  validate(querySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, perPage, status, search } = req.query as any;
      const orgId = req.organization!.id;

      const where: any = { organizationId: orgId };
      if (status) where.status = status;
      if (search) where.name = { contains: search, mode: 'insensitive' };

      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          where,
          include: {
            _count: { select: { tasks: true } },
          },
          skip: (page - 1) * perPage,
          take: perPage,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.project.count({ where }),
      ]);

      sendPaginated(res, projects, total, page, perPage);
    } catch (error) {
      next(error);
    }
  }
);

// Create project
projectRouter.post(
  '/',
  requireAdmin,
  validate(createProjectSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organization!.id;
      const { key, ...data } = req.body;

      const existing = await prisma.project.findUnique({
        where: { organizationId_key: { organizationId: orgId, key } },
      });
      if (existing) {
        throw new ConflictError(`Project key "${key}" already exists in this organization`);
      }

      const project = await prisma.project.create({
        data: {
          ...data,
          key,
          organizationId: orgId,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
        },
      });

      sendSuccess(res, project, 201);
    } catch (error) {
      next(error);
    }
  }
);

// Get project by ID
projectRouter.get(
  '/:projectId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await prisma.project.findFirst({
        where: {
          id: req.params.projectId as string,
          organizationId: req.organization!.id,
        },
        include: {
          _count: { select: { tasks: true, sprints: true } },
          labels: true,
        },
      });

      if (!project) throw new NotFoundError('Project');
      sendSuccess(res, project);
    } catch (error) {
      next(error);
    }
  }
);

// Update project
projectRouter.patch(
  '/:projectId',
  requireAdmin,
  validate(updateProjectSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await prisma.project.findFirst({
        where: { id: req.params.projectId as string, organizationId: req.organization!.id },
      });
      if (!project) throw new NotFoundError('Project');

      const updated = await prisma.project.update({
        where: { id: project.id },
        data: {
          ...req.body,
          startDate: req.body.startDate !== undefined
            ? (req.body.startDate ? new Date(req.body.startDate) : null)
            : undefined,
          endDate: req.body.endDate !== undefined
            ? (req.body.endDate ? new Date(req.body.endDate) : null)
            : undefined,
        },
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }
);

// Delete project
projectRouter.delete(
  '/:projectId',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await prisma.project.findFirst({
        where: { id: req.params.projectId as string, organizationId: req.organization!.id },
      });
      if (!project) throw new NotFoundError('Project');

      await prisma.project.delete({ where: { id: project.id } });
      sendSuccess(res, { message: 'Project deleted' });
    } catch (error) {
      next(error);
    }
  }
);
