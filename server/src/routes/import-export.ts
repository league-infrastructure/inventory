import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function importExportRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/export', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const buffer = await services.exports.exportToExcel();
      const filename = `inventory-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) { next(err); }
  });

  router.post('/import/preview', requireAuth, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const diffs = await services.imports.parseAndDiff(req.file.buffer);
      res.json(diffs);
    } catch (err) { next(err); }
  });

  router.post('/import/apply', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as any).id;
      const diffs = req.body.diffs;
      if (!Array.isArray(diffs)) {
        return res.status(400).json({ error: 'diffs array required' });
      }
      const result = await services.imports.applyImport(diffs, userId);
      res.json(result);
    } catch (err) { next(err); }
  });

  return router;
}
