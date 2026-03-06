import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function searchRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/search', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = String(req.query.q || '');
      const limit = Math.min(parseInt(String(req.query.limit || '20'), 10), 100);
      const results = await services.search.search(query, limit);
      res.json(results);
    } catch (err) { next(err); }
  });

  return router;
}
