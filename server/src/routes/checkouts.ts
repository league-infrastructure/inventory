import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth';
import * as checkoutService from '../services/checkoutService';

export const checkoutsRouter = Router();

checkoutsRouter.post('/checkouts', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    res.status(201).json(await checkoutService.checkOut(req.body, user.id));
  } catch (err) { next(err); }
});

checkoutsRouter.patch('/checkouts/:id/checkin', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    res.json(await checkoutService.checkIn(parseInt(req.params.id as string, 10), req.body, user.id));
  } catch (err) { next(err); }
});

checkoutsRouter.get('/checkouts', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await checkoutService.listCheckouts(req.query.status as string | undefined));
  } catch (err) { next(err); }
});

checkoutsRouter.get('/checkouts/history/:kitId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await checkoutService.getCheckoutHistory(parseInt(req.params.kitId as string, 10)));
  } catch (err) { next(err); }
});
