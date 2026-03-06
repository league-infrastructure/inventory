import { Router, Request, Response, NextFunction } from 'express';
import { BackupService } from '../../services/backup.service';

export const adminBackupRouter = Router();
const backupService = new BackupService();

adminBackupRouter.get('/backups', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const backups = await backupService.listBackups();
    res.json(backups);
  } catch (err) { next(err); }
});

adminBackupRouter.post('/backups', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const info = await backupService.createBackup();
    res.json(info);
  } catch (err) { next(err); }
});

adminBackupRouter.post('/backups/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'filename required' });
    await backupService.restoreBackup(filename);
    res.json({ restored: true, filename });
  } catch (err) { next(err); }
});

adminBackupRouter.delete('/backups/:filename', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await backupService.deleteBackup(req.params.filename as string);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});
