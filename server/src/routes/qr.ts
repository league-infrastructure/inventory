import { Router, Request, Response, NextFunction } from 'express';
import { ServiceRegistry } from '../services/service.registry';

export function qrRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/qr/k/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.qr.getKitQrInfo(parseInt(req.params.id as string, 10)));
    } catch (err) { next(err); }
  });

  router.get('/qr/c/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.qr.getComputerQrInfo(parseInt(req.params.id as string, 10)));
    } catch (err) { next(err); }
  });

  router.get('/qr/p/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await services.qr.getPackQrInfo(parseInt(req.params.id as string, 10)));
    } catch (err) { next(err); }
  });

  return router;
}
