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

  // Look up the pack's kitId internally so the caller only supplies the
  // pack id + requested number, not the kit id. Response is the full
  // renumbered pack list for the kit (not a single pack), since more than
  // one pack's number may change — see PackService.renumber().
  router.patch('/packs/:id/renumber', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      const id = parseInt(req.params.id as string, 10);
      const pack = await services.packs.get(id);
      const result = await services.packs.renumber(pack.kitId, id, req.body.displayNumber, user.id);
      res.json(result);
    } catch (err) { next(err); }
  });

  return router;
}
