import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function checkoutsRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.post('/checkouts', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.status(201).json(await services.checkouts.checkOut(req.body, user.id));
    } catch (err) { next(err); }
  });

  router.patch('/checkouts/:id/checkin', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.json(await services.checkouts.checkIn(parseInt(req.params.id as string, 10), req.body, user.id));
    } catch (err) { next(err); }
  });

  router.get('/checkouts', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.checkouts.list(req.query.status as string | undefined));
    } catch (err) { next(err); }
  });

  router.get('/checkouts/history/:kitId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.checkouts.getHistory(parseInt(req.params.kitId as string, 10)));
    } catch (err) { next(err); }
  });

  return router;
}
