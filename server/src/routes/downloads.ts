import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { LOANEE_ROLES } from '../contracts';
import { ServiceRegistry } from '../services/service.registry';

/**
 * `GET /api/downloads/:token` — the only way a browser actually
 * receives a generated file (labels PDF, list export, etc.).
 *
 * A thin HTTP translation layer only: all "is this token valid, does
 * this user own it" logic lives in
 * `GeneratedFileService.resolveForDownload` (sprint 010 ticket 001).
 * This route's own job is:
 *  - logged-out browser → redirect to Google login via the *existing*
 *    generic `returnTo` mechanism in `routes/auth.ts`, not a JSON 401
 *    (a browser following a link can't do anything useful with JSON);
 *  - logged-in loanee (STUDENT/PARTNER) → denied the same way
 *    `requireAuth`-gated routes deny them today;
 *  - otherwise, translate `resolveForDownload`'s outcome into the
 *    right HTTP response.
 */
export function downloadsRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/downloads/:token', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.params.token as string;

      if (!req.user) {
        const returnTo = `/api/downloads/${token}`;
        return res.redirect(`/api/auth/google?returnTo=${returnTo}`);
      }

      const user = req.user as User;
      if (LOANEE_ROLES.has(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const resolution = await services.generatedFiles.resolveForDownload(token, {
        id: user.id,
        role: user.role,
      });

      if (resolution.outcome === 'not-found') {
        return res.status(404).json({ error: 'Not found' });
      }

      if (resolution.outcome === 'forbidden') {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.setHeader('Content-Type', resolution.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${resolution.filename}"`);
      res.send(resolution.data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
