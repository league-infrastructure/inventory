import { KitStatus } from '@prisma/client';
import { prisma } from './prisma';
import { writeAuditLog, diffForAudit } from './auditLog';
import { NotFoundError, ValidationError } from './errors';
import { KitRecord, KitDetailRecord, CreateKitInput, UpdateKitInput } from '../contracts';

const KIT_FIELDS = ['name', 'description', 'status', 'siteId', 'qrCode'];

export async function listKits(statusFilter?: string): Promise<KitRecord[]> {
  const where: any = {};
  if (statusFilter && Object.values(KitStatus).includes(statusFilter as KitStatus)) {
    where.status = statusFilter;
  }

  const kits = await prisma.kit.findMany({
    where,
    include: { site: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  return kits as unknown as KitRecord[];
}

export async function getKit(id: number): Promise<KitDetailRecord> {
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
  if (!kit) throw new NotFoundError('Kit not found');
  return kit as unknown as KitDetailRecord;
}

export async function createKit(input: CreateKitInput, userId: number): Promise<KitRecord> {
  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new ValidationError('Name is required');
  }
  if (!input.siteId || typeof input.siteId !== 'number') {
    throw new ValidationError('siteId is required');
  }

  const site = await prisma.site.findUnique({ where: { id: input.siteId } });
  if (!site || !site.isActive) {
    throw new ValidationError('Site not found or inactive');
  }

  const kit = await prisma.kit.create({
    data: {
      name: input.name.trim(),
      description: input.description || null,
      siteId: input.siteId,
    },
  });

  const qrPath = `/k/${kit.id}`;
  const updated = await prisma.kit.update({
    where: { id: kit.id },
    data: { qrCode: qrPath },
    include: { site: { select: { id: true, name: true } } },
  });

  await writeAuditLog(
    KIT_FIELDS.map((field) => ({
      userId,
      objectType: 'Kit',
      objectId: kit.id,
      field,
      oldValue: null,
      newValue: (updated as any)[field] != null ? String((updated as any)[field]) : null,
    })).filter((e) => e.newValue != null),
  );

  return updated as unknown as KitRecord;
}

export async function updateKit(id: number, input: UpdateKitInput, userId: number): Promise<KitRecord> {
  const existing = await prisma.kit.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Kit not found');

  if (input.name != null && (typeof input.name !== 'string' || input.name.trim().length === 0)) {
    throw new ValidationError('Name cannot be empty');
  }
  if (input.siteId != null) {
    if (typeof input.siteId !== 'number') throw new ValidationError('siteId must be a number');
    const site = await prisma.site.findUnique({ where: { id: input.siteId } });
    if (!site || !site.isActive) throw new ValidationError('Site not found or inactive');
  }

  const updated = await prisma.kit.update({
    where: { id },
    data: {
      ...(input.name != null && { name: input.name.trim() }),
      ...(input.description !== undefined && { description: input.description || null }),
      ...(input.siteId != null && { siteId: input.siteId }),
    },
    include: { site: { select: { id: true, name: true } } },
  });

  const auditEntries = diffForAudit(userId, 'Kit', id, existing, updated, KIT_FIELDS);
  if (auditEntries.length > 0) {
    await writeAuditLog(auditEntries);
  }

  return updated as unknown as KitRecord;
}

export async function retireKit(id: number, userId: number): Promise<KitRecord> {
  const existing = await prisma.kit.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Kit not found');
  if (existing.status === 'RETIRED') throw new ValidationError('Kit is already retired');

  const updated = await prisma.kit.update({
    where: { id },
    data: { status: 'RETIRED' },
    include: { site: { select: { id: true, name: true } } },
  });

  await writeAuditLog({
    userId,
    objectType: 'Kit',
    objectId: id,
    field: 'status',
    oldValue: existing.status,
    newValue: 'RETIRED',
  });

  return updated as unknown as KitRecord;
}

export async function cloneKit(id: number, userId: number): Promise<KitDetailRecord> {
  const source = await prisma.kit.findUnique({
    where: { id },
    include: { packs: { include: { items: true } } },
  });
  if (!source) throw new NotFoundError('Kit not found');

  const newKit = await prisma.kit.create({
    data: {
      name: `${source.name} (Copy)`,
      description: source.description,
      siteId: source.siteId,
    },
  });

  const qrPath = `/k/${newKit.id}`;
  await prisma.kit.update({
    where: { id: newKit.id },
    data: { qrCode: qrPath },
  });

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

  await writeAuditLog({
    userId,
    objectType: 'Kit',
    objectId: newKit.id,
    field: 'clone',
    oldValue: null,
    newValue: `Cloned from Kit #${source.id}`,
  });

  const result = await prisma.kit.findUnique({
    where: { id: newKit.id },
    include: {
      site: { select: { id: true, name: true } },
      packs: { include: { items: true } },
      computers: { include: { hostName: true }, orderBy: { id: 'asc' } },
    },
  });
  return result as unknown as KitDetailRecord;
}
