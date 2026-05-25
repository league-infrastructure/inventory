import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function manufacturersRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/manufacturers', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.manufacturers.list());
    } catch (err) { next(err); }
  });

  router.post('/manufacturers', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as any).id;
      res.status(201).json(await services.manufacturers.create(req.body, userId));
    } catch (err) { next(err); }
  });

  router.put('/manufacturers/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as any).id;
      res.json(await services.manufacturers.update(parseInt(req.params.id as string, 10), req.body, userId));
    } catch (err) { next(err); }
  });

  router.delete('/manufacturers/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await services.manufacturers.delete(parseInt(req.params.id as string, 10));
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  return router;
}
