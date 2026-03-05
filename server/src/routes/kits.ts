import { Router, Request, Response } from 'express';
import { User, KitStatus } from '@prisma/client';
import { prisma } from '../services/prisma';
import { generateQrDataUrl } from '../services/qrCode';
import { writeAuditLog, diffForAudit } from '../services/auditLog';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';

export const kitsRouter = Router();

const KIT_FIELDS = ['name', 'description', 'status', 'siteId', 'qrCode'];

// List all Kits (any authenticated user)
kitsRouter.get('/kits', requireAuth, async (req: Request, res: Response) => {
  const statusFilter = req.query.status as string | undefined;
  const where: any = {};
  if (statusFilter && Object.values(KitStatus).includes(statusFilter as KitStatus)) {
    where.status = statusFilter;
  }

  const kits = await prisma.kit.findMany({
    where,
    include: { site: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(kits);
});

// Get Kit detail with hierarchy (any authenticated user)
kitsRouter.get('/kits/:id', requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const kit = await prisma.kit.findUnique({
    where: { id },
    include: {
      site: { select: { id: true, name: true } },
      packs: {
        include: { items: true },
        orderBy: { name: 'asc' },
      },
      computers: {
        include: { hostName: true },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!kit) {
    return res.status(404).json({ error: 'Kit not found' });
  }
  res.json(kit);
});

// Create a Kit (Quartermaster only)
kitsRouter.post('/kits', requireQuartermaster, async (req: Request, res: Response) => {
  const { name, description, siteId } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!siteId || typeof siteId !== 'number') {
    return res.status(400).json({ error: 'siteId is required' });
  }

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site || !site.isActive) {
    return res.status(400).json({ error: 'Site not found or inactive' });
  }

  const kit = await prisma.kit.create({
    data: {
      name: name.trim(),
      description: description || null,
      siteId,
    },
  });

  // Generate and store QR code path
  const qrPath = `/k/${kit.id}`;
  const updated = await prisma.kit.update({
    where: { id: kit.id },
    data: { qrCode: qrPath },
    include: { site: { select: { id: true, name: true } } },
  });

  const user = req.user as User;
  await writeAuditLog(
    KIT_FIELDS.map((field) => ({
      userId: user.id,
      objectType: 'Kit',
      objectId: kit.id,
      field,
      oldValue: null,
      newValue: (updated as any)[field] != null ? String((updated as any)[field]) : null,
    })).filter((e) => e.newValue != null),
  );

  res.status(201).json(updated);
});

// Update a Kit (Quartermaster only)
kitsRouter.put('/kits/:id', requireQuartermaster, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.kit.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Kit not found' });
  }

  const { name, description, siteId } = req.body;
  if (name != null && (typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }
  if (siteId != null) {
    if (typeof siteId !== 'number') {
      return res.status(400).json({ error: 'siteId must be a number' });
    }
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site || !site.isActive) {
      return res.status(400).json({ error: 'Site not found or inactive' });
    }
  }

  const updated = await prisma.kit.update({
    where: { id },
    data: {
      ...(name != null && { name: name.trim() }),
      ...(description !== undefined && { description: description || null }),
      ...(siteId != null && { siteId }),
    },
    include: { site: { select: { id: true, name: true } } },
  });

  const user = req.user as User;
  const auditEntries = diffForAudit(user.id, 'Kit', id, existing, updated, KIT_FIELDS);
  if (auditEntries.length > 0) {
    await writeAuditLog(auditEntries);
  }

  res.json(updated);
});

// Retire a Kit (Quartermaster only)
kitsRouter.patch('/kits/:id/retire', requireQuartermaster, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.kit.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Kit not found' });
  }
  if (existing.status === 'RETIRED') {
    return res.status(400).json({ error: 'Kit is already retired' });
  }

  const updated = await prisma.kit.update({
    where: { id },
    data: { status: 'RETIRED' },
    include: { site: { select: { id: true, name: true } } },
  });

  const user = req.user as User;
  await writeAuditLog({
    userId: user.id,
    objectType: 'Kit',
    objectId: id,
    field: 'status',
    oldValue: existing.status,
    newValue: 'RETIRED',
  });

  res.json(updated);
});

// Clone a Kit (Quartermaster only)
kitsRouter.post('/kits/:id/clone', requireQuartermaster, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const source = await prisma.kit.findUnique({
    where: { id },
    include: {
      packs: { include: { items: true } },
    },
  });
  if (!source) {
    return res.status(404).json({ error: 'Kit not found' });
  }

  // Create cloned Kit
  const newKit = await prisma.kit.create({
    data: {
      name: `${source.name} (Copy)`,
      description: source.description,
      siteId: source.siteId,
    },
  });

  // Set QR code
  const qrPath = `/k/${newKit.id}`;
  await prisma.kit.update({
    where: { id: newKit.id },
    data: { qrCode: qrPath },
  });

  // Clone Packs and Items
  for (const pack of source.packs) {
    const newPack = await prisma.pack.create({
      data: {
        name: pack.name,
        description: pack.description,
        kitId: newKit.id,
      },
    });
    const packQrPath = `/p/${newPack.id}`;
    await prisma.pack.update({
      where: { id: newPack.id },
      data: { qrCode: packQrPath },
    });

    for (const item of pack.items) {
      await prisma.item.create({
        data: {
          name: item.name,
          type: item.type,
          expectedQuantity: item.expectedQuantity,
          packId: newPack.id,
        },
      });
    }
  }

  const user = req.user as User;
  await writeAuditLog({
    userId: user.id,
    objectType: 'Kit',
    objectId: newKit.id,
    field: 'clone',
    oldValue: null,
    newValue: `Cloned from Kit #${source.id}`,
  });

  // Return the full cloned Kit
  const result = await prisma.kit.findUnique({
    where: { id: newKit.id },
    include: {
      site: { select: { id: true, name: true } },
      packs: { include: { items: true } },
    },
  });

  res.status(201).json(result);
});
