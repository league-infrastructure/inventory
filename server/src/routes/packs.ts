import { Router, Request, Response } from 'express';
import { User } from '@prisma/client';
import { prisma } from '../services/prisma';
import { writeAuditLog, diffForAudit } from '../services/auditLog';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';

export const packsRouter = Router();

const PACK_FIELDS = ['name', 'description', 'qrCode', 'kitId'];

// List Packs in a Kit (any authenticated user)
packsRouter.get('/kits/:kitId/packs', requireAuth, async (req: Request, res: Response) => {
  const kitId = parseInt(req.params.kitId as string, 10);
  const kit = await prisma.kit.findUnique({ where: { id: kitId } });
  if (!kit) {
    return res.status(404).json({ error: 'Kit not found' });
  }
  const packs = await prisma.pack.findMany({
    where: { kitId },
    include: { items: true },
    orderBy: { name: 'asc' },
  });
  res.json(packs);
});

// Get Pack detail with Items (any authenticated user)
packsRouter.get('/packs/:id', requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const pack = await prisma.pack.findUnique({
    where: { id },
    include: {
      items: { orderBy: { name: 'asc' } },
      kit: { select: { id: true, name: true } },
    },
  });
  if (!pack) {
    return res.status(404).json({ error: 'Pack not found' });
  }
  res.json(pack);
});

// Create a Pack in a Kit (Quartermaster only)
packsRouter.post('/kits/:kitId/packs', requireQuartermaster, async (req: Request, res: Response) => {
  const kitId = parseInt(req.params.kitId as string, 10);
  const kit = await prisma.kit.findUnique({ where: { id: kitId } });
  if (!kit) {
    return res.status(404).json({ error: 'Kit not found' });
  }

  const { name, description } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const pack = await prisma.pack.create({
    data: {
      name: name.trim(),
      description: description || null,
      kitId,
    },
  });

  const qrPath = `/p/${pack.id}`;
  const updated = await prisma.pack.update({
    where: { id: pack.id },
    data: { qrCode: qrPath },
    include: { kit: { select: { id: true, name: true } } },
  });

  const user = req.user as User;
  await writeAuditLog(
    PACK_FIELDS.map((field) => ({
      userId: user.id,
      objectType: 'Pack',
      objectId: pack.id,
      field,
      oldValue: null,
      newValue: (updated as any)[field] != null ? String((updated as any)[field]) : null,
    })).filter((e) => e.newValue != null),
  );

  res.status(201).json(updated);
});

// Update a Pack (Quartermaster only)
packsRouter.put('/packs/:id', requireQuartermaster, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.pack.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Pack not found' });
  }

  const { name, description } = req.body;
  if (name != null && (typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }

  const updated = await prisma.pack.update({
    where: { id },
    data: {
      ...(name != null && { name: name.trim() }),
      ...(description !== undefined && { description: description || null }),
    },
    include: { kit: { select: { id: true, name: true } } },
  });

  const user = req.user as User;
  const auditEntries = diffForAudit(user.id, 'Pack', id, existing, updated, PACK_FIELDS);
  if (auditEntries.length > 0) {
    await writeAuditLog(auditEntries);
  }

  res.json(updated);
});

// Delete a Pack (Quartermaster only) — cascades Items
packsRouter.delete('/packs/:id', requireQuartermaster, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.pack.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Pack not found' });
  }

  await prisma.pack.delete({ where: { id } });

  const user = req.user as User;
  await writeAuditLog({
    userId: user.id,
    objectType: 'Pack',
    objectId: id,
    field: 'deleted',
    oldValue: existing.name,
    newValue: null,
  });

  res.json({ success: true });
});
