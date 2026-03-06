import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function transfersRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.post('/transfers', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.status(201).json(await services.transfers.transfer(req.body, user.id));
    } catch (err) { next(err); }
  });

  router.get('/transfers/history/:objectType/:objectId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const objectType = req.params.objectType as string;
      const objectId = parseInt(req.params.objectId as string, 10);
      res.json(await services.transfers.getHistory(objectType, objectId));
    } catch (err) { next(err); }
  });

  router.get('/transfers/out', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.transfers.getTransferredOut());
    } catch (err) { next(err); }
  });

  return router;
}
