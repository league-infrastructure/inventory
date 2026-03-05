import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import * as hostNameService from '../services/hostNameService';

export const hostnamesRouter = Router();

hostnamesRouter.get('/hostnames', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await hostNameService.listHostNames());
  } catch (err) { next(err); }
});

hostnamesRouter.post('/hostnames', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await hostNameService.createHostName(req.body));
  } catch (err) { next(err); }
});

hostnamesRouter.delete('/hostnames/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await hostNameService.deleteHostName(parseInt(req.params.id as string, 10));
    res.json({ success: true });
  } catch (err) { next(err); }
});
