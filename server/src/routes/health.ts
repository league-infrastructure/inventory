import { Router } from 'express';
import { getConfig } from '../services/config';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

healthRouter.get('/settings/inventory-interval', (_req, res) => {
  const raw = getConfig('INVENTORY_CHECK_INTERVAL_DAYS');
  const days = raw ? parseInt(raw, 10) : 60;
  res.json({ days: isNaN(days) ? 60 : days });
});
