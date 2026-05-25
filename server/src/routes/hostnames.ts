import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function hostnamesRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/hostnames', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.hostNames.list());
    } catch (err) { next(err); }
  });

  // Must be before /:id routes so 'schemes' is not captured as an id.
  router.get('/hostnames/schemes', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await services.prisma.hostName.findMany({
        select: { scheme: true },
        distinct: ['scheme'],
        where: { scheme: { not: null } },
        orderBy: { scheme: 'asc' },
      });
      const schemes = rows.map(r => r.scheme).filter((s): s is string => s !== null);
      res.json(schemes);
    } catch (err) { next(err); }
  });

  router.post('/hostnames', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await services.hostNames.create(req.body));
    } catch (err) { next(err); }
  });

  router.put('/hostnames/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { name, scheme } = req.body as { name?: string; scheme?: string | null };
      res.json(await services.hostNames.update(id, { name, scheme }, (req as any).user?.id ?? 0));
    } catch (err) { next(err); }
  });

  router.delete('/hostnames/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await services.hostNames.delete(parseInt(req.params.id as string, 10));
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  return router;
}
