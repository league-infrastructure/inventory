import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function categoriesRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/categories', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.categories.list());
    } catch (err) { next(err); }
  });

  router.post('/categories', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as any).id;
      res.status(201).json(await services.categories.create(req.body, userId));
    } catch (err) { next(err); }
  });

  router.put('/categories/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as any).id;
      res.json(await services.categories.update(parseInt(req.params.id as string, 10), req.body, userId));
    } catch (err) { next(err); }
  });

  router.delete('/categories/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await services.categories.delete(parseInt(req.params.id as string, 10));
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  return router;
}
