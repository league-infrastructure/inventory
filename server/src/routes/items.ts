import { Router, Request, Response } from 'express';
import { User, ItemType } from '@prisma/client';
import { prisma } from '../services/prisma';
import { writeAuditLog, diffForAudit } from '../services/auditLog';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';

export const itemsRouter = Router();

const ITEM_FIELDS = ['name', 'type', 'expectedQuantity', 'packId'];

// List Items in a Pack (any authenticated user)
itemsRouter.get('/packs/:packId/items', requireAuth, async (req: Request, res: Response) => {
  const packId = parseInt(req.params.packId as string, 10);
  const pack = await prisma.pack.findUnique({ where: { id: packId } });
  if (!pack) {
    return res.status(404).json({ error: 'Pack not found' });
  }
  const items = await prisma.item.findMany({
    where: { packId },
    orderBy: { name: 'asc' },
  });
  res.json(items);
});

// Create an Item in a Pack (Quartermaster only)
itemsRouter.post('/packs/:packId/items', requireQuartermaster, async (req: Request, res: Response) => {
  const packId = parseInt(req.params.packId as string, 10);
  const pack = await prisma.pack.findUnique({ where: { id: packId } });
  if (!pack) {
    return res.status(404).json({ error: 'Pack not found' });
  }

  const { name, type, expectedQuantity } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!type || !Object.values(ItemType).includes(type)) {
    return res.status(400).json({ error: 'Type must be COUNTED or CONSUMABLE' });
  }
  if (type === 'COUNTED') {
    if (expectedQuantity == null || typeof expectedQuantity !== 'number' || expectedQuantity < 1) {
      return res.status(400).json({ error: 'COUNTED items must have expectedQuantity >= 1' });
    }
  }

  const item = await prisma.item.create({
    data: {
      name: name.trim(),
      type,
      expectedQuantity: type === 'COUNTED' ? expectedQuantity : null,
      packId,
    },
  });

  const user = req.user as User;
  await writeAuditLog(
    ITEM_FIELDS.map((field) => ({
      userId: user.id,
      objectType: 'Item',
      objectId: item.id,
      field,
      oldValue: null,
      newValue: (item as any)[field] != null ? String((item as any)[field]) : null,
    })).filter((e) => e.newValue != null),
  );

  res.status(201).json(item);
});

// Update an Item (Quartermaster only)
itemsRouter.put('/items/:id', requireQuartermaster, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const { name, type, expectedQuantity } = req.body;
  if (name != null && (typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }
  if (type != null && !Object.values(ItemType).includes(type)) {
    return res.status(400).json({ error: 'Type must be COUNTED or CONSUMABLE' });
  }

  const effectiveType = type ?? existing.type;
  if (effectiveType === 'COUNTED' && expectedQuantity != null) {
    if (typeof expectedQuantity !== 'number' || expectedQuantity < 1) {
      return res.status(400).json({ error: 'COUNTED items must have expectedQuantity >= 1' });
    }
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      ...(name != null && { name: name.trim() }),
      ...(type != null && { type }),
      ...(expectedQuantity !== undefined && {
        expectedQuantity: effectiveType === 'COUNTED' ? expectedQuantity : null,
      }),
    },
  });

  const user = req.user as User;
  const auditEntries = diffForAudit(user.id, 'Item', id, existing, updated, ITEM_FIELDS);
  if (auditEntries.length > 0) {
    await writeAuditLog(auditEntries);
  }

  res.json(updated);
});

// Delete an Item (Quartermaster only)
itemsRouter.delete('/items/:id', requireQuartermaster, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Item not found' });
  }

  await prisma.item.delete({ where: { id } });

  const user = req.user as User;
  await writeAuditLog({
    userId: user.id,
    objectType: 'Item',
    objectId: id,
    field: 'deleted',
    oldValue: existing.name,
    newValue: null,
  });

  res.json({ success: true });
});
