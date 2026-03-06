import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function computerCheckoutsRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.post('/computer-checkouts', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.status(201).json(await services.computerCheckouts.checkOut(req.body, user.id));
    } catch (err) { next(err); }
  });

  router.patch('/computer-checkouts/:id/checkin', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.json(await services.computerCheckouts.checkIn(parseInt(req.params.id as string, 10), req.body, user.id));
    } catch (err) { next(err); }
  });

  router.get('/computer-checkouts', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.computerCheckouts.list(req.query.status as string | undefined));
    } catch (err) { next(err); }
  });

  router.get('/computer-checkouts/history/:computerId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.computerCheckouts.getHistory(parseInt(req.params.computerId as string, 10)));
    } catch (err) { next(err); }
  });

  return router;
}
