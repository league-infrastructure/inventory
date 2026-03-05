import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function itemsRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/packs/:packId/items', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.items.list(parseInt(req.params.packId as string, 10)));
    } catch (err) { next(err); }
  });

  router.post('/packs/:packId/items', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.status(201).json(await services.items.create(req.body, user.id, parseInt(req.params.packId as string, 10)));
    } catch (err) { next(err); }
  });

  router.put('/items/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.json(await services.items.update(parseInt(req.params.id as string, 10), req.body, user.id));
    } catch (err) { next(err); }
  });

  router.delete('/items/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      await services.items.delete(parseInt(req.params.id as string, 10), user.id);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  return router;
}
