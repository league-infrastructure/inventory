import { Router, Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';
import * as siteService from '../services/siteService';

export const sitesRouter = Router();

sitesRouter.get('/sites', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await siteService.listSites());
  } catch (err) { next(err); }
});

sitesRouter.get('/sites/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await siteService.getSite(parseInt(req.params.id as string, 10)));
  } catch (err) { next(err); }
});

sitesRouter.post('/sites', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    res.status(201).json(await siteService.createSite(req.body, user.id));
  } catch (err) { next(err); }
});

sitesRouter.put('/sites/:id', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    res.json(await siteService.updateSite(parseInt(req.params.id as string, 10), req.body, user.id));
  } catch (err) { next(err); }
});

sitesRouter.patch('/sites/:id/deactivate', requireQuartermaster, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as User;
    res.json(await siteService.deactivateSite(parseInt(req.params.id as string, 10), user.id));
  } catch (err) { next(err); }
});

sitesRouter.post('/sites/nearest', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await siteService.findNearestSite(req.body.latitude, req.body.longitude));
  } catch (err) { next(err); }
});
