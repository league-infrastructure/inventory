import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../../services/prisma';
import { getConfig } from '../../services/config';

function getAppVersion(): string {
  // In production: dist/routes/admin/ → ../../.. → server root (package.json)
  // In development: src/routes/admin/ → ../../.. → server root (package.json)
  const candidates = [
    path.join(__dirname, '..', '..', '..', 'package.json'),
    path.join(process.cwd(), 'package.json'),
  ];
  for (const p of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (pkg.version) return pkg.version;
    } catch { /* try next */ }
  }
  return 'unknown';
}

export const adminEnvRouter = Router();

adminEnvRouter.get('/env', async (_req, res) => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  res.json({
    version: getAppVersion(),
    node: process.version,
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: process.memoryUsage().rss,
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
    },
    deployment: process.env.NODE_ENV || 'development',
    database: dbStatus,
    integrations: {
      github: {
        configured: !!(getConfig('GITHUB_CLIENT_ID') && getConfig('GITHUB_CLIENT_SECRET')),
      },
      google: {
        configured: !!(getConfig('GOOGLE_CLIENT_ID') && getConfig('GOOGLE_CLIENT_SECRET')),
      },
      pike13: {
        configured: !!(getConfig('PIKE13_CLIENT_ID') && getConfig('PIKE13_CLIENT_SECRET')),
      },
      githubToken: {
        configured: !!getConfig('GITHUB_TOKEN'),
      },
      anthropic: {
        configured: !!getConfig('ANTHROPIC_API_KEY'),
      },
      openai: {
        configured: !!getConfig('OPENAI_API_KEY'),
      },
    },
  });
});
