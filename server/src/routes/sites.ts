import { Router, Request, Response } from 'express';
import { User } from '@prisma/client';
import { prisma } from '../services/prisma';
import { writeAuditLog, diffForAudit } from '../services/auditLog';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';

export const sitesRouter = Router();

const SITE_FIELDS = ['name', 'address', 'latitude', 'longitude', 'isHomeSite', 'isActive'];

// List all active sites (any authenticated user)
sitesRouter.get('/sites', requireAuth, async (_req: Request, res: Response) => {
  const sites = await prisma.site.findMany({
    where: { isActive: true },
    orderBy: [{ isHomeSite: 'desc' }, { name: 'asc' }],
  });
  res.json(sites);
});

// Get site detail (any authenticated user)
sitesRouter.get('/sites/:id', requireAuth, async (req: Request, res: Response) => {
  const site = await prisma.site.findUnique({
    where: { id: parseInt(req.params.id as string, 10) },
  });
  if (!site) {
    return res.status(404).json({ error: 'Site not found' });
  }
  res.json(site);
});

// Create a site (Quartermaster only)
sitesRouter.post('/sites', requireQuartermaster, async (req: Request, res: Response) => {
  const { name, address, latitude, longitude, isHomeSite } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (latitude != null && (typeof latitude !== 'number' || isNaN(latitude))) {
    return res.status(400).json({ error: 'Latitude must be a valid number' });
  }
  if (longitude != null && (typeof longitude !== 'number' || isNaN(longitude))) {
    return res.status(400).json({ error: 'Longitude must be a valid number' });
  }

  const site = await prisma.site.create({
    data: {
      name: name.trim(),
      address: address || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      isHomeSite: isHomeSite ?? false,
    },
  });

  const user = req.user as User;
  await writeAuditLog(
    SITE_FIELDS.map((field) => ({
      userId: user.id,
      objectType: 'Site',
      objectId: site.id,
      field,
      oldValue: null,
      newValue: (site as any)[field] != null ? String((site as any)[field]) : null,
    })).filter((e) => e.newValue != null),
  );

  res.status(201).json(site);
});

// Update a site (Quartermaster only)
sitesRouter.put('/sites/:id', requireQuartermaster, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.site.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Site not found' });
  }

  const { name, address, latitude, longitude, isHomeSite } = req.body;
  if (name != null && (typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }
  if (latitude != null && typeof latitude !== 'number') {
    return res.status(400).json({ error: 'Latitude must be a valid number' });
  }
  if (longitude != null && typeof longitude !== 'number') {
    return res.status(400).json({ error: 'Longitude must be a valid number' });
  }

  const updated = await prisma.site.update({
    where: { id },
    data: {
      ...(name != null && { name: name.trim() }),
      ...(address !== undefined && { address: address || null }),
      ...(latitude !== undefined && { latitude: latitude ?? null }),
      ...(longitude !== undefined && { longitude: longitude ?? null }),
      ...(isHomeSite !== undefined && { isHomeSite }),
    },
  });

  const user = req.user as User;
  const auditEntries = diffForAudit(user.id, 'Site', id, existing, updated, SITE_FIELDS);
  if (auditEntries.length > 0) {
    await writeAuditLog(auditEntries);
  }

  res.json(updated);
});

// Deactivate a site (soft delete, Quartermaster only)
sitesRouter.patch('/sites/:id/deactivate', requireQuartermaster, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.site.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Site not found' });
  }
  if (!existing.isActive) {
    return res.status(400).json({ error: 'Site is already deactivated' });
  }

  const updated = await prisma.site.update({
    where: { id },
    data: { isActive: false },
  });

  const user = req.user as User;
  await writeAuditLog({
    userId: user.id,
    objectType: 'Site',
    objectId: id,
    field: 'isActive',
    oldValue: 'true',
    newValue: 'false',
  });

  res.json(updated);
});
