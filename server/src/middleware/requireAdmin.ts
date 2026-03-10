import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    isAdmin?: boolean;
    returnTo?: string;
    pendingOAuth?: {
      client_id: string;
      redirect_uri: string;
      state?: string;
      code_challenge?: string;
      code_challenge_method?: string;
    };
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.isAdmin) {
    return next();
  }
  const user = req.user as any;
  if (user?.role === 'ADMIN') {
    return next();
  }
  res.status(401).json({ error: 'Admin authentication required' });
}
