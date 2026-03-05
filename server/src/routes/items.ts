import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import * as itemService from '../services/itemService';

export const itemsRouter = Router();

itemsRouter.get('/packs/:packId/items', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await itemService.listItems(parseInt(req.params.packId as string, 10)));
  } catch (err) { next(err); }
});

itemsRouter.post('/packs/:packId/items', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    res.status(201).json(await itemService.createItem(parseInt(req.params.packId as string, 10), req.body, user.id));
  } catch (err) { next(err); }
});

itemsRouter.put('/items/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    res.json(await itemService.updateItem(parseInt(req.params.id as string, 10), req.body, user.id));
  } catch (err) { next(err); }
});

itemsRouter.delete('/items/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    await itemService.deleteItem(parseInt(req.params.id as string, 10), user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});
