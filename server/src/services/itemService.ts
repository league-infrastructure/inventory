import { ItemType } from '@prisma/client';
import { prisma } from './prisma';
import { writeAuditLog, diffForAudit } from './auditLog';
import { NotFoundError, ValidationError } from './errors';
import { ItemRecord, CreateItemInput, UpdateItemInput } from '../contracts';

const ITEM_FIELDS = ['name', 'type', 'expectedQuantity', 'packId'];

export async function listItems(packId: number): Promise<ItemRecord[]> {
  const pack = await prisma.pack.findUnique({ where: { id: packId } });
  if (!pack) throw new NotFoundError('Pack not found');

  const items = await prisma.item.findMany({
    where: { packId },
    orderBy: { name: 'asc' },
  });
  return items as unknown as ItemRecord[];
}

export async function createItem(packId: number, input: CreateItemInput, userId: number): Promise<ItemRecord> {
  const pack = await prisma.pack.findUnique({ where: { id: packId } });
  if (!pack) throw new NotFoundError('Pack not found');

  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new ValidationError('Name is required');
  }
  if (!input.type || !Object.values(ItemType).includes(input.type as ItemType)) {
    throw new ValidationError('Type must be COUNTED or CONSUMABLE');
  }
  if (input.type === 'COUNTED') {
    if (input.expectedQuantity == null || typeof input.expectedQuantity !== 'number' || input.expectedQuantity < 1) {
      throw new ValidationError('COUNTED items must have expectedQuantity >= 1');
    }
  }

  const item = await prisma.item.create({
    data: {
      name: input.name.trim(),
      type: input.type as ItemType,
      expectedQuantity: input.type === 'COUNTED' ? input.expectedQuantity! : null,
      packId,
    },
  });

  await writeAuditLog(
    ITEM_FIELDS.map((field) => ({
      userId,
      objectType: 'Item',
      objectId: item.id,
      field,
      oldValue: null,
      newValue: (item as any)[field] != null ? String((item as any)[field]) : null,
    })).filter((e) => e.newValue != null),
  );

  return item as unknown as ItemRecord;
}

export async function updateItem(id: number, input: UpdateItemInput, userId: number): Promise<ItemRecord> {
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Item not found');

  if (input.name != null && (typeof input.name !== 'string' || input.name.trim().length === 0)) {
    throw new ValidationError('Name cannot be empty');
  }
  if (input.type != null && !Object.values(ItemType).includes(input.type as ItemType)) {
    throw new ValidationError('Type must be COUNTED or CONSUMABLE');
  }

  const effectiveType = input.type ?? existing.type;
  if (effectiveType === 'COUNTED' && input.expectedQuantity != null) {
    if (typeof input.expectedQuantity !== 'number' || input.expectedQuantity < 1) {
      throw new ValidationError('COUNTED items must have expectedQuantity >= 1');
    }
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      ...(input.name != null && { name: input.name.trim() }),
      ...(input.type != null && { type: input.type as ItemType }),
      ...(input.expectedQuantity !== undefined && {
        expectedQuantity: effectiveType === 'COUNTED' ? input.expectedQuantity : null,
      }),
    },
  });

  const auditEntries = diffForAudit(userId, 'Item', id, existing, updated, ITEM_FIELDS);
  if (auditEntries.length > 0) {
    await writeAuditLog(auditEntries);
  }

  return updated as unknown as ItemRecord;
}

export async function deleteItem(id: number, userId: number): Promise<void> {
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Item not found');

  await prisma.item.delete({ where: { id } });

  await writeAuditLog({
    userId,
    objectType: 'Item',
    objectId: id,
    field: 'deleted',
    oldValue: existing.name,
    newValue: null,
  });
}
