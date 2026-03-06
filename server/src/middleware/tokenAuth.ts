import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../services/token.service';
import { PrismaClient } from '@prisma/client';

export function tokenAuth(tokenService: TokenService, prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Bearer token required' });
    }

    try {
      const result = await tokenService.validate(parts[1]);
      const user = await prisma.user.findUnique({ where: { id: result.userId } });
      if (!user) {
        return res.status(401).json({ error: 'Token owner not found' });
      }
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
