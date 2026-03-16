import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function importExportRouter(services: ServiceRegistry): Router {
  const router = Router();

  // Excel export
  router.get('/export', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const buffer = await services.exports.exportToExcel();
      const filename = `inventory-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) { next(err); }
  });

  // JSON export
  router.get('/export/json', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await services.exports.exportToJson();
      const filename = `inventory-export-${new Date().toISOString().split('T')[0]}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(data);
    } catch (err) { next(err); }
  });

  // Excel import preview
  router.post('/import/preview', requireAuth, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const diffs = await services.imports.parseAndDiff(req.file.buffer);
      res.json(diffs);
    } catch (err) { next(err); }
  });

  // Excel import apply
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

  // CSV computer import — preview (diff against DB)
  router.post('/import/computers-csv/preview', requireAuth, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const matchBy = (req.body.matchBy === 'serialNumber') ? 'serialNumber' as const : 'hostName' as const;
      const csvText = req.file.buffer.toString('utf-8');
      const diffs = await services.imports.previewComputersCsv(csvText, matchBy);
      res.json({ diffs, csvText, matchBy });
    } catch (err) { next(err); }
  });

  // CSV computer import — apply
  router.post('/import/computers-csv/apply', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as any).id;
      const { csvText, matchBy } = req.body;
      if (!csvText) return res.status(400).json({ error: 'csvText required' });
      const result = await services.imports.applyComputersCsv(csvText, matchBy || 'hostName', userId);
      res.json(result);
    } catch (err) { next(err); }
  });

  return router;
}
