import { prisma } from './prisma';
import { writeAuditLog, diffForAudit } from './auditLog';
import { NotFoundError, ValidationError } from './errors';
import { PackRecord, PackDetailRecord, CreatePackInput, UpdatePackInput } from '../contracts';

const PACK_FIELDS = ['name', 'description', 'qrCode', 'kitId'];

export async function listPacks(kitId: number): Promise<PackRecord[]> {
  const kit = await prisma.kit.findUnique({ where: { id: kitId } });
  if (!kit) throw new NotFoundError('Kit not found');

  const packs = await prisma.pack.findMany({
    where: { kitId },
    include: { items: true },
    orderBy: { name: 'asc' },
  });
  return packs as unknown as PackRecord[];
}

export async function getPack(id: number): Promise<PackDetailRecord> {
  const pack = await prisma.pack.findUnique({
    where: { id },
    include: {
      items: { orderBy: { name: 'asc' } },
      kit: { select: { id: true, name: true } },
    },
  });
  if (!pack) throw new NotFoundError('Pack not found');
  return pack as unknown as PackDetailRecord;
}

export async function createPack(kitId: number, input: CreatePackInput, userId: number): Promise<PackDetailRecord> {
  const kit = await prisma.kit.findUnique({ where: { id: kitId } });
  if (!kit) throw new NotFoundError('Kit not found');

  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new ValidationError('Name is required');
  }

  const pack = await prisma.pack.create({
    data: {
      name: input.name.trim(),
      description: input.description || null,
      kitId,
    },
  });

  const qrPath = `/p/${pack.id}`;
  const updated = await prisma.pack.update({
    where: { id: pack.id },
    data: { qrCode: qrPath },
    include: { kit: { select: { id: true, name: true } } },
  });

  await writeAuditLog(
    PACK_FIELDS.map((field) => ({
      userId,
      objectType: 'Pack',
      objectId: pack.id,
      field,
      oldValue: null,
      newValue: (updated as any)[field] != null ? String((updated as any)[field]) : null,
    })).filter((e) => e.newValue != null),
  );

  return { ...updated, items: [] } as unknown as PackDetailRecord;
}

export async function updatePack(id: number, input: UpdatePackInput, userId: number): Promise<PackDetailRecord> {
  const existing = await prisma.pack.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Pack not found');

  if (input.name != null && (typeof input.name !== 'string' || input.name.trim().length === 0)) {
    throw new ValidationError('Name cannot be empty');
  }

  const updated = await prisma.pack.update({
    where: { id },
    data: {
      ...(input.name != null && { name: input.name.trim() }),
      ...(input.description !== undefined && { description: input.description || null }),
    },
    include: {
      kit: { select: { id: true, name: true } },
      items: true,
    },
  });

  const auditEntries = diffForAudit(userId, 'Pack', id, existing, updated, PACK_FIELDS);
  if (auditEntries.length > 0) {
    await writeAuditLog(auditEntries);
  }

  return updated as unknown as PackDetailRecord;
}

export async function deletePack(id: number, userId: number): Promise<void> {
  const existing = await prisma.pack.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Pack not found');

  await prisma.pack.delete({ where: { id } });

  await writeAuditLog({
    userId,
    objectType: 'Pack',
    objectId: id,
    field: 'deleted',
    oldValue: existing.name,
    newValue: null,
  });
}
