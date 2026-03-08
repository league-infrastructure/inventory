import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function labelsRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/labels/kit/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const pdf = await services.labels.generateKitLabel(id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="kit-${id}-label.pdf"`);
      res.send(pdf);
    } catch (err) { next(err); }
  });

  router.get('/labels/pack/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const pdf = await services.labels.generatePackLabel(id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="pack-${id}-label.pdf"`);
      res.send(pdf);
    } catch (err) { next(err); }
  });

  router.get('/labels/computer/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const pdf = await services.labels.generateComputerLabel(id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="computer-${id}-label.pdf"`);
      res.send(pdf);
    } catch (err) { next(err); }
  });

  router.post('/labels/kit/:id/batch', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const packIds: number[] = Array.isArray(req.body.packIds) ? req.body.packIds : [];
      const includeKit: boolean = req.body.includeKit !== false;
      console.log('[labels] batch request:', { kitId: id, packIds, includeKit, rawBody: req.body });
      const html = await services.labels.generateBatchHtml(id, packIds, includeKit);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err) { next(err); }
  });

  return router;
}
