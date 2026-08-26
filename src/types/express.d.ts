import { User, Organization, Membership } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      organization?: Organization;
      membership?: Membership;
    }
  }
}

export {};
