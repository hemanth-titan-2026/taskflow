import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { UnauthorizedError } from '../utils/errors';
import { prisma } from '../config/database';

/**
 * Middleware that verifies JWT token and attaches user to request.
 * Supports both Bearer token and API key authentication.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('No authentication token provided');
    }

    // API Key authentication
    if (authHeader.startsWith('ApiKey ')) {
      await authenticateApiKey(req, authHeader.slice(7));
      return next();
    }

    // Bearer token authentication
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Invalid authorization format. Use "Bearer <token>"');
    }

    const token = authHeader.slice(7);
    const payload = AuthService.verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedError('User no longer exists');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

async function authenticateApiKey(req: Request, keyPrefix: string): Promise<void> {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      prefix: keyPrefix.slice(0, 8),
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: { organization: true },
  });

  if (!apiKey) {
    throw new UnauthorizedError('Invalid API key');
  }

  // Update last used
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  // For API key auth, set organization directly
  req.organization = apiKey.organization;
}

/**
 * Optional authentication - attaches user if token present, but doesn't require it
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = AuthService.verifyToken(token);

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (user) {
        req.user = user;
      }
    }

    next();
  } catch {
    // Token invalid, continue without user
    next();
  }
}
