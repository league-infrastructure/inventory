import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import * as kitService from '../services/kitService';

export const kitsRouter = Router();

kitsRouter.get('/kits', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await kitService.listKits(req.query.status as string | undefined));
  } catch (err) { next(err); }
});

kitsRouter.get('/kits/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await kitService.getKit(parseInt(req.params.id as string, 10)));
  } catch (err) { next(err); }
});

kitsRouter.post('/kits', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    res.status(201).json(await kitService.createKit(req.body, user.id));
  } catch (err) { next(err); }
});

kitsRouter.put('/kits/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    res.json(await kitService.updateKit(parseInt(req.params.id as string, 10), req.body, user.id));
  } catch (err) { next(err); }
});

kitsRouter.patch('/kits/:id/retire', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    res.json(await kitService.retireKit(parseInt(req.params.id as string, 10), user.id));
  } catch (err) { next(err); }
});

kitsRouter.post('/kits/:id/clone', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    res.status(201).json(await kitService.cloneKit(parseInt(req.params.id as string, 10), user.id));
  } catch (err) { next(err); }
});
