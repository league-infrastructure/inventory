import { Request, Response, NextFunction } from 'express';

const TICK_INTERVAL_MS = parseInt(process.env.SCHEDULER_TICK_INTERVAL_MS || '300000', 10);

let nextTickTime = 0;

export function schedulerTickMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  const now = Date.now();
  if (now >= nextTickTime) {
    nextTickTime = now + TICK_INTERVAL_MS;
    const port = process.env.PORT || 3000;
    // Fire-and-forget: don't await, don't block the request
    fetch(`http://localhost:${port}/api/scheduler/tick`).catch(() => {
      // Silently ignore errors — the tick route logs its own failures
    });
  }
  next();
}

/** Reset the timer (useful for testing). */
export function resetTickTimer(): void {
  nextTickTime = 0;
}
