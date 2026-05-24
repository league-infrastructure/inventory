import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { ServiceRegistry } from '../services/service.registry';

export function kitsRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/kits', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.kits.list(req.query.status as string | undefined));
    } catch (err) { next(err); }
  });

  // Trash list — must be before /kits/:id
  router.get('/kits/deleted', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.kits.listDeleted());
    } catch (err) { next(err); }
  });

  router.get('/kits/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.kits.get(parseInt(req.params.id as string, 10)));
    } catch (err) { next(err); }
  });

  router.post('/kits', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.status(201).json(await services.kits.create(req.body, user.id));
    } catch (err) { next(err); }
  });

  router.put('/kits/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.json(await services.kits.update(parseInt(req.params.id as string, 10), req.body, user.id));
    } catch (err) { next(err); }
  });

  router.patch('/kits/:id/retire', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.json(await services.kits.retire(parseInt(req.params.id as string, 10), user.id));
    } catch (err) { next(err); }
  });

  router.post('/kits/:id/clone', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      res.status(201).json(await services.kits.clone(parseInt(req.params.id as string, 10), user.id));
    } catch (err) { next(err); }
  });

  // Soft delete
  router.delete('/kits/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      await services.kits.softDelete(parseInt(req.params.id as string, 10), user.id);
      res.json({ deleted: true });
    } catch (err) { next(err); }
  });

  // Restore
  router.post('/kits/:id/restore', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      await services.kits.restore(parseInt(req.params.id as string, 10), user.id);
      res.json({ restored: true });
    } catch (err) { next(err); }
  });

  // Permanent delete
  router.delete('/kits/:id/permanent', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await services.kits.permanentDelete(parseInt(req.params.id as string, 10));
      res.json({ deleted: true });
    } catch (err) { next(err); }
  });

  return router;
}
