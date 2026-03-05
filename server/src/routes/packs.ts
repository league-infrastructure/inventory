import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import * as packService from '../services/packService';

export const packsRouter = Router();

packsRouter.get('/kits/:kitId/packs', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await packService.listPacks(parseInt(req.params.kitId as string, 10)));
  } catch (err) { next(err); }
});

packsRouter.get('/packs/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await packService.getPack(parseInt(req.params.id as string, 10)));
  } catch (err) { next(err); }
});

packsRouter.post('/kits/:kitId/packs', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    res.status(201).json(await packService.createPack(parseInt(req.params.kitId as string, 10), req.body, user.id));
  } catch (err) { next(err); }
});

packsRouter.put('/packs/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    res.json(await packService.updatePack(parseInt(req.params.id as string, 10), req.body, user.id));
  } catch (err) { next(err); }
});

packsRouter.delete('/packs/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    await packService.deletePack(parseInt(req.params.id as string, 10), user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});
