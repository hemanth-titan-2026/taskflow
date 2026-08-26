import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, resolveTenant, requireAdmin, requireOwner, validate } from '../middleware';
import { prisma } from '../config/database';
import { sendSuccess, sendPaginated } from '../utils/response';
import { ConflictError, NotFoundError } from '../utils/errors';
import { OrgRole } from '@prisma/client';

export const organizationRouter = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logo: z.string().url().optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// List user's organizations
organizationRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const memberships = await prisma.membership.findMany({
        where: { userId: req.user!.id },
        include: {
          organization: {
            include: { _count: { select: { members: true, projects: true } } },
          },
        },
      });

      const orgs = memberships.map(m => ({
        ...m.organization,
        role: m.role,
        memberCount: m.organization._count.members,
        projectCount: m.organization._count.projects,
      }));

      sendSuccess(res, orgs);
    } catch (error) {
      next(error);
    }
  }
);

// Create organization
organizationRouter.post(
  '/',
  authenticate,
  validate(createOrgSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, slug } = req.body;

      const existing = await prisma.organization.findUnique({ where: { slug } });
      if (existing) {
        throw new ConflictError('An organization with this slug already exists');
      }

      const org = await prisma.organization.create({
        data: {
          name,
          slug,
          members: {
            create: {
              userId: req.user!.id,
              role: OrgRole.OWNER,
            },
          },
        },
        include: { _count: { select: { members: true } } },
      });

      sendSuccess(res, org, 201);
    } catch (error) {
      next(error);
    }
  }
);

// Get organization details
organizationRouter.get(
  '/:orgId',
  authenticate,
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: req.organization!.id },
        include: {
          _count: { select: { members: true, projects: true } },
        },
      });

      sendSuccess(res, { ...org, role: req.membership!.role });
    } catch (error) {
      next(error);
    }
  }
);

// Update organization
organizationRouter.patch(
  '/:orgId',
  authenticate,
  resolveTenant,
  requireAdmin,
  validate(updateOrgSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await prisma.organization.update({
        where: { id: req.organization!.id },
        data: req.body,
      });

      sendSuccess(res, org);
    } catch (error) {
      next(error);
    }
  }
);

// List members
organizationRouter.get(
  '/:orgId/members',
  authenticate,
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const members = await prisma.membership.findMany({
        where: { organizationId: req.organization!.id },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: 'asc' },
      });

      sendSuccess(res, members);
    } catch (error) {
      next(error);
    }
  }
);

// Invite member
organizationRouter.post(
  '/:orgId/invite',
  authenticate,
  resolveTenant,
  requireAdmin,
  validate(inviteMemberSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, role } = req.body;
      const { randomUUID } = await import('crypto');

      // Check if user is already a member
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        const existingMembership = await prisma.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: existingUser.id,
              organizationId: req.organization!.id,
            },
          },
        });
        if (existingMembership) {
          throw new ConflictError('User is already a member');
        }
      }

      const invitation = await prisma.invitation.create({
        data: {
          email,
          role: role as OrgRole,
          token: randomUUID(),
          organizationId: req.organization!.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      sendSuccess(res, invitation, 201);
    } catch (error) {
      next(error);
    }
  }
);

// Remove member
organizationRouter.delete(
  '/:orgId/members/:userId',
  authenticate,
  resolveTenant,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params as { userId: string };

      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: req.organization!.id,
          },
        },
      });

      if (!membership) {
        throw new NotFoundError('Membership');
      }

      if (membership.role === OrgRole.OWNER) {
        throw new ConflictError('Cannot remove the organization owner');
      }

      await prisma.membership.delete({ where: { id: membership.id } });
      sendSuccess(res, { message: 'Member removed' });
    } catch (error) {
      next(error);
    }
  }
);
