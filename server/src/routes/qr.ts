import { Router, Request, Response, NextFunction } from 'express';
import * as qrService from '../services/qrService';

export const qrRouter = Router();

qrRouter.get('/qr/k/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await qrService.getKitQrInfo(parseInt(req.params.id as string, 10)));
  } catch (err) { next(err); }
});

qrRouter.get('/qr/c/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await qrService.getComputerQrInfo(parseInt(req.params.id as string, 10)));
  } catch (err) { next(err); }
});

qrRouter.get('/qr/p/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await qrService.getPackQrInfo(parseInt(req.params.id as string, 10)));
  } catch (err) { next(err); }
});
