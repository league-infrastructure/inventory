import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function issuesRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/issues', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters: any = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.packId) filters.packId = parseInt(req.query.packId as string, 10);
      if (req.query.kitId) filters.kitId = parseInt(req.query.kitId as string, 10);
      if (req.query.computerId) filters.computerId = parseInt(req.query.computerId as string, 10);
      if (req.query.type) filters.type = req.query.type;
      res.json(await services.issues.list(filters));
    } catch (err) { next(err); }
  });

  router.get('/issues/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      res.json(await services.issues.get(id));
    } catch (err) { next(err); }
  });

  router.post('/issues', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.status(201).json(await services.issues.create(req.body, user.id));
    } catch (err) { next(err); }
  });

  router.patch('/issues/:id/resolve', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      const id = parseInt(req.params.id as string, 10);
      res.json(await services.issues.resolve(id, req.body, user.id));
    } catch (err) { next(err); }
  });

  return router;
}
