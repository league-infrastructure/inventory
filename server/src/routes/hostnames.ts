import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function hostnamesRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/hostnames', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.hostNames.list());
    } catch (err) { next(err); }
  });

  router.post('/hostnames', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await services.hostNames.create(req.body));
    } catch (err) { next(err); }
  });

  router.delete('/hostnames/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await services.hostNames.delete(parseInt(req.params.id as string, 10));
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  return router;
}
