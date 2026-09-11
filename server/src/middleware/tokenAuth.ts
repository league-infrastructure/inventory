import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../services/token.service';
import { PrismaClient } from '@prisma/client';
import { getPublicUrl } from '../routes/publicUrl';

// Points MCP clients at the RFC 9728 protected-resource metadata document
// per the MCP authorization spec, so a 401 alone is enough for a client to
// discover how to obtain a token — no manual configuration required.
function setWwwAuthenticate(req: Request, res: Response): void {
  const base = getPublicUrl(req);
  res.set('WWW-Authenticate', `Bearer realm="mcp", resource_metadata="${base}/.well-known/oauth-protected-resource"`);
}

export function tokenAuth(tokenService: TokenService, prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      setWwwAuthenticate(req, res);
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      setWwwAuthenticate(req, res);
      return res.status(401).json({ error: 'Bearer token required' });
    }

    try {
      const result = await tokenService.validate(parts[1]);
      const user = await prisma.user.findUnique({ where: { id: result.userId } });
      if (!user) {
        setWwwAuthenticate(req, res);
        return res.status(401).json({ error: 'Token owner not found' });
      }
      req.user = user;
      next();
    } catch {
      setWwwAuthenticate(req, res);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
