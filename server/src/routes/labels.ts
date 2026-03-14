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

  // Compact (89x28mm) computer label — must be before /labels/computer/:id
  router.get('/labels/computer/:id/compact', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const pdf = await services.labels.generateComputerLabel89x28(id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="computer-${id}-compact-label.pdf"`);
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

  // QR code image (PNG) for display on detail pages
  router.get('/labels/qr/:type/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const t = req.params.type as string;
      const objId = parseInt(req.params.id as string, 10);
      const png = await services.labels.generateQrBuffer(`/qr/${t}/${objId}`);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(png);
    } catch (err) { next(err); }
  });

  router.post('/labels/computers/batch', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const computerIds: number[] = Array.isArray(req.body.computerIds) ? req.body.computerIds : [];
      if (!computerIds.length) {
        res.status(400).json({ error: 'computerIds array is required and must not be empty' });
        return;
      }
      const pdf = await services.labels.generateComputerBatchLabels(computerIds);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="computer-labels-batch.pdf"`);
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

  router.post('/labels/kit/:id/batch-pdf', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const packIds: number[] = Array.isArray(req.body.packIds) ? req.body.packIds : [];
      const includeKit: boolean = req.body.includeKit !== false;
      const pdf = await services.labels.generateBatchLabels(id, packIds, includeKit);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="kit-${id}-labels.pdf"`);
      res.send(pdf);
    } catch (err) { next(err); }
  });

  return router;
}
