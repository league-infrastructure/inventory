import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function sitesRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/sites', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.sites.list());
    } catch (err) { next(err); }
  });

  router.get('/sites/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.sites.get(parseInt(req.params.id as string, 10)));
    } catch (err) { next(err); }
  });

  router.post('/sites', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.status(201).json(await services.sites.create(req.body, user.id));
    } catch (err) { next(err); }
  });

  router.put('/sites/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.json(await services.sites.update(parseInt(req.params.id as string, 10), req.body, user.id));
    } catch (err) { next(err); }
  });

  router.patch('/sites/:id/deactivate', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.json(await services.sites.deactivate(parseInt(req.params.id as string, 10), user.id));
    } catch (err) { next(err); }
  });

  router.post('/sites/:id/geocode', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.json(await services.sites.geocode(parseInt(req.params.id as string, 10), user.id));
    } catch (err) { next(err); }
  });

  router.post('/sites/nearest', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.sites.findNearest(req.body.latitude, req.body.longitude));
    } catch (err) { next(err); }
  });

  return router;
}
