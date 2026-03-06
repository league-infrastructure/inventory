import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { ServiceRegistry } from '../services/service.registry';

export function reportsRouter(services: ServiceRegistry): Router {
  const router = Router();

  router.get('/reports/audit-log', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await services.reports.queryAuditLog({
        objectType: req.query.objectType as string | undefined,
        objectId: req.query.objectId ? parseInt(String(req.query.objectId), 10) : undefined,
        userId: req.query.userId ? parseInt(String(req.query.userId), 10) : undefined,
        field: req.query.field as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
        pageSize: req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : undefined,
      });
      res.json(result);
    } catch (err) { next(err); }
  });

  router.get('/reports/user-activity/:userId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.userId as string, 10);
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const records = await services.reports.getUserActivity(userId, limit);
      res.json(records);
    } catch (err) { next(err); }
  });

  router.get('/reports/inventory-age', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await services.reports.getInventoryAge();
      res.json(rows);
    } catch (err) { next(err); }
  });

  router.get('/reports/checked-out-by-person', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await services.reports.getCheckedOutByPerson();
      res.json(data);
    } catch (err) { next(err); }
  });

  return router;
}
