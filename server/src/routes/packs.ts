import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function packsRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/packs', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.packs.listAll());
    } catch (err) { next(err); }
  });

  router.get('/kits/:kitId/packs', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.packs.list(parseInt(req.params.kitId as string, 10)));
    } catch (err) { next(err); }
  });

  router.get('/packs/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.packs.get(parseInt(req.params.id as string, 10)));
    } catch (err) { next(err); }
  });

  router.post('/kits/:kitId/packs', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      const templatePackId = req.body.templatePackId ? parseInt(req.body.templatePackId, 10) : undefined;
      res.status(201).json(await services.packs.create(req.body, user.id, parseInt(req.params.kitId as string, 10), templatePackId));
    } catch (err) { next(err); }
  });

  router.put('/packs/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.json(await services.packs.update(parseInt(req.params.id as string, 10), req.body, user.id));
    } catch (err) { next(err); }
  });

  router.delete('/packs/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      await services.packs.delete(parseInt(req.params.id as string, 10), user.id);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  return router;
}
