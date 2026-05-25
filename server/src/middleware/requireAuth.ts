import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { hasQMAccess, LOANEE_ROLES } from '../contracts';

// Extend Express types so req.user is typed as our Prisma User
declare global {
  namespace Express {
    interface User extends Omit<import('@prisma/client').User, never> {}
  }
}

/** Requires any authenticated Google OAuth user (not a loan-only STUDENT or PARTNER). */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const user = req.user as User;
  if (LOANEE_ROLES.has(user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

/** Requires an authenticated user with QUARTERMASTER or ADMIN role. */
export function requireQuartermaster(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const user = req.user as User;
  if (!hasQMAccess(user.role)) {
    return res.status(403).json({ error: 'Quartermaster access required' });
  }
  next();
}
