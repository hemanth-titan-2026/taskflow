import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { AuthService } from '../services/auth.service';
import { sendSuccess } from '../utils/response';

export const authRouter = Router();

// ─── Validation Schemas ──────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

authRouter.post(
  '/register',
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, tokens } = await AuthService.register(req.body);
      sendSuccess(res, {
        user: AuthService.sanitizeUser(user),
        ...tokens,
      }, 201);
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, tokens } = await AuthService.login(req.body);
      sendSuccess(res, {
        user: AuthService.sanitizeUser(user),
        ...tokens,
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post(
  '/refresh',
  validate(refreshSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await AuthService.refreshToken(req.body.refreshToken);
      sendSuccess(res, tokens);
    } catch (error) {
      next(error);
    }
  }
);

authRouter.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const memberships = await (await import('../config/database')).prisma.membership.findMany({
        where: { userId: user.id },
        include: { organization: true },
      });

      sendSuccess(res, {
        user: AuthService.sanitizeUser(user),
        organizations: memberships.map(m => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          role: m.role,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);
