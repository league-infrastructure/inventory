import { Router, Request, Response, NextFunction } from 'express';
import { SchedulerService } from '../services/scheduler.service';
import { requireAdmin } from '../middleware/requireAdmin';

export function schedulerRouter(schedulerService: SchedulerService): Router {
  const router = Router();

  // Public tick endpoint — called by internal middleware or external cron.
  // Returns only a count; no sensitive data exposed.
  router.get('/scheduler/tick', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const executed = await schedulerService.tick();
      res.json({ executed });
    } catch (err) { next(err); }
  });

  // Admin-only: list all scheduled jobs
  router.get('/scheduler/jobs', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const jobs = await schedulerService.listJobs();
      res.json(jobs);
    } catch (err) { next(err); }
  });

  // Admin-only: update a job (enable/disable)
  router.put('/scheduler/jobs/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid job ID' });
      const { enabled } = req.body;
      await schedulerService.updateJob(id, { enabled });
      res.json({ updated: true });
    } catch (err) { next(err); }
  });

  // Admin-only: run a job immediately
  router.post('/scheduler/jobs/:id/run', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid job ID' });
      await schedulerService.runJobNow(id);
      res.json({ executed: true });
    } catch (err) { next(err); }
  });

  return router;
}
