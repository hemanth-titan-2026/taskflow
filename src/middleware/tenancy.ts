import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { NotFoundError, ForbiddenError, UnauthorizedError } from '../utils/errors';
import { OrgRole } from '@prisma/client';

/**
 * Resolves the current organization (tenant) from:
 * 1. X-Organization-Id header
 * 2. URL parameter :orgId
 * 3. Query parameter ?org=
 * 
 * Also verifies user has membership in the organization.
 */
export async function resolveTenant(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // If organization was already set by API key auth, skip resolution
    if (req.organization) {
      return next();
    }

    const orgIdentifier =
      (req.headers['x-organization-id'] as string) ||
      (req.params.orgId as string) ||
      (req.query.org as string);

    if (!orgIdentifier) {
      throw new ForbiddenError('Organization context required. Provide X-Organization-Id header, :orgId param, or ?org= query');
    }

    // Try to find by ID or slug
    const organization = await prisma.organization.findFirst({
      where: {
        OR: [
          { id: orgIdentifier },
          { slug: orgIdentifier },
        ],
      },
    });

    if (!organization) {
      throw new NotFoundError('Organization');
    }

    // Verify membership
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: req.user.id,
          organizationId: organization.id,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenError('You are not a member of this organization');
    }

    req.organization = organization;
    req.membership = membership;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Factory: require minimum role in the current organization
 */
export function requireRole(...roles: OrgRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.membership) {
      return next(new ForbiddenError('Organization membership required'));
    }

    if (!roles.includes(req.membership.role)) {
      return next(new ForbiddenError(`Requires one of: ${roles.join(', ')}`));
    }

    next();
  };
}

/**
 * Convenience: require admin or owner role
 */
export const requireAdmin = requireRole(OrgRole.OWNER, OrgRole.ADMIN);

/**
 * Convenience: require owner role
 */
export const requireOwner = requireRole(OrgRole.OWNER);
