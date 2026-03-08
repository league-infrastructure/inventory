import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function notesRouter(services: ServiceRegistry): Router {
  const router = Router();

  // GET /notes?objectType=Kit&objectId=1
  router.get('/notes', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { objectType, objectId } = req.query;
      if (!objectType || !objectId) {
        return res.status(400).json({ error: 'objectType and objectId are required' });
      }
      res.json(await services.notes.list(
        objectType as string,
        parseInt(objectId as string, 10),
      ));
    } catch (err) { next(err); }
  });

  // POST /notes
  router.post('/notes', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as any).id;
      res.status(201).json(await services.notes.create(req.body, userId));
    } catch (err) { next(err); }
  });

  // PUT /notes/:id
  router.put('/notes/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as any).id;
      res.json(await services.notes.update(
        parseInt(req.params.id as string, 10),
        req.body,
        userId,
      ));
    } catch (err) { next(err); }
  });

  // DELETE /notes/:id
  router.delete('/notes/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await services.notes.delete(parseInt(req.params.id as string, 10));
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  return router;
}
