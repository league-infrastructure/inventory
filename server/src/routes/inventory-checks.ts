import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function inventoryChecksRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.post('/inventory-checks/kit/:kitId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      const kitId = parseInt(req.params.kitId as string, 10);
      res.status(201).json(await services.inventoryChecks.startKitCheck(kitId, user.id));
    } catch (err) { next(err); }
  });

  router.post('/inventory-checks/pack/:packId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      const packId = parseInt(req.params.packId as string, 10);
      res.status(201).json(await services.inventoryChecks.startPackCheck(packId, user.id));
    } catch (err) { next(err); }
  });

  router.patch('/inventory-checks/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      const id = parseInt(req.params.id as string, 10);
      res.json(await services.inventoryChecks.submitCheck(id, req.body, user.id));
    } catch (err) { next(err); }
  });

  // History routes must come before the :id route
  router.get('/inventory-checks/history/kit/:kitId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const kitId = parseInt(req.params.kitId as string, 10);
      res.json(await services.inventoryChecks.getHistory(kitId));
    } catch (err) { next(err); }
  });

  router.get('/inventory-checks/history/pack/:packId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const packId = parseInt(req.params.packId as string, 10);
      res.json(await services.inventoryChecks.getHistory(undefined, packId));
    } catch (err) { next(err); }
  });

  router.get('/inventory-checks/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      res.json(await services.inventoryChecks.getCheck(id));
    } catch (err) { next(err); }
  });

  return router;
}
