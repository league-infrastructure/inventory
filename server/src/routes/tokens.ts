import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function tokensRouter(services: ServiceRegistry): Router {
  const router = Router();

  // --- User token routes (session auth only) ---

  router.post('/tokens', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      const label = req.body.label || 'default';
      const result = await services.tokens.create(user.id, label);
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  router.get('/tokens', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.json(await services.tokens.list(user.id));
    } catch (err) { next(err); }
  });

  router.delete('/tokens/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      await services.tokens.revoke(parseInt(req.params.id as string, 10), user.id);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // --- Admin token routes (session auth + Quartermaster) ---

  router.get('/admin/tokens', requireQuartermaster, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.tokens.list());
    } catch (err) { next(err); }
  });

  router.delete('/admin/tokens/:id', requireQuartermaster, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await services.tokens.revoke(parseInt(_req.params.id as string, 10));
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  return router;
}
