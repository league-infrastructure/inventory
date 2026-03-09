import { Router } from 'express';
import { prisma } from '../services/prisma';
import { getConfig } from '../services/config';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'error' });
  }
});

healthRouter.get('/settings/inventory-interval', (_req, res) => {
  const raw = getConfig('INVENTORY_CHECK_INTERVAL_DAYS');
  const days = raw ? parseInt(raw, 10) : 60;
  res.json({ days: isNaN(days) ? 60 : days });
});
