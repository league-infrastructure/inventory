import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function computersRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/computers', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters: any = {};
      if (req.query.disposition) filters.disposition = req.query.disposition as string;
      if (req.query.siteId) {
        const parsed = parseInt(req.query.siteId as string, 10);
        if (!isNaN(parsed)) filters.siteId = parsed;
      }
      if (req.query.kitId) {
        const parsed = parseInt(req.query.kitId as string, 10);
        if (!isNaN(parsed)) filters.kitId = parsed;
      }
      if (req.query.unassigned === 'true') filters.unassigned = true;
      res.json(await services.computers.list(filters));
    } catch (err) { next(err); }
  });

  router.get('/computers/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.computers.get(parseInt(req.params.id as string, 10)));
    } catch (err) { next(err); }
  });

  router.post('/computers', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.status(201).json(await services.computers.create(req.body, user.id));
    } catch (err) { next(err); }
  });

  router.put('/computers/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.json(await services.computers.update(parseInt(req.params.id as string, 10), req.body, user.id));
    } catch (err) { next(err); }
  });

  router.patch('/computers/:id/disposition', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.json(await services.computers.changeDisposition(parseInt(req.params.id as string, 10), req.body.disposition, user.id));
    } catch (err) { next(err); }
  });

  return router;
}
