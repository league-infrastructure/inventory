import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function operatingSystemsRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/operating-systems', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.os.list());
    } catch (err) { next(err); }
  });

  router.post('/operating-systems', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as any).id;
      res.status(201).json(await services.os.create(req.body, userId));
    } catch (err) { next(err); }
  });

  router.delete('/operating-systems/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await services.os.delete(parseInt(req.params.id as string, 10));
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  return router;
}
