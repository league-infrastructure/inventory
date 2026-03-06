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
      const packIds: number[] = req.body.packIds || [];
      const pdf = await services.labels.generateBatchLabels(id, packIds);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="kit-${id}-labels.pdf"`);
      res.send(pdf);
    } catch (err) { next(err); }
  });

  return router;
}
