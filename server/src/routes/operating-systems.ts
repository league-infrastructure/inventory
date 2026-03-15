import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function operatingSystemsRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/operating-systems', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.os.list());
    } catch (err) { next(err); }
  });

  return router;
}
