import { ComputerDisposition } from '@prisma/client';
import { prisma } from './prisma';
import { writeAuditLog, diffForAudit } from './auditLog';
import { NotFoundError, ValidationError } from './errors';
import { ComputerRecord, CreateComputerInput, UpdateComputerInput } from '../contracts';

const COMPUTER_FIELDS = [
  'serialNumber', 'serviceTag', 'model', 'defaultUsername', 'defaultPassword',
  'disposition', 'dateReceived', 'lastInventoried', 'notes', 'siteId', 'kitId', 'qrCode',
];

const COMPUTER_INCLUDES = {
  hostName: true,
  site: { select: { id: true, name: true } },
  kit: { select: { id: true, name: true } },
};

interface ListComputersFilters {
  disposition?: string;
  siteId?: number;
  kitId?: number;
  unassigned?: boolean;
}

export async function listComputers(filters: ListComputersFilters = {}): Promise<ComputerRecord[]> {
  const where: any = {};

  if (filters.disposition && Object.values(ComputerDisposition).includes(filters.disposition as ComputerDisposition)) {
    where.disposition = filters.disposition;
  }
  if (filters.siteId != null) where.siteId = filters.siteId;
  if (filters.kitId != null) where.kitId = filters.kitId;
  if (filters.unassigned) {
    where.siteId = null;
    where.kitId = null;
  }

  const computers = await prisma.computer.findMany({
    where,
    include: COMPUTER_INCLUDES,
    orderBy: { id: 'asc' },
  });
  return computers as unknown as ComputerRecord[];
}

export async function getComputer(id: number): Promise<ComputerRecord> {
  const computer = await prisma.computer.findUnique({
    where: { id },
    include: COMPUTER_INCLUDES,
  });
  if (!computer) throw new NotFoundError('Computer not found');
  return computer as unknown as ComputerRecord;
}

export async function createComputer(input: CreateComputerInput, userId: number): Promise<ComputerRecord> {
  if (input.disposition && !Object.values(ComputerDisposition).includes(input.disposition as ComputerDisposition)) {
    throw new ValidationError('Invalid disposition value');
  }

  if (input.siteId != null) {
    if (typeof input.siteId !== 'number') throw new ValidationError('siteId must be a number');
    const site = await prisma.site.findUnique({ where: { id: input.siteId } });
    if (!site) throw new ValidationError('Site not found');
  }

  if (input.kitId != null) {
    if (typeof input.kitId !== 'number') throw new ValidationError('kitId must be a number');
    const kit = await prisma.kit.findUnique({ where: { id: input.kitId } });
    if (!kit) throw new ValidationError('Kit not found');
  }

  const computer = await prisma.computer.create({
    data: {
      serialNumber: input.serialNumber || null,
      serviceTag: input.serviceTag || null,
      model: input.model || null,
      defaultUsername: input.defaultUsername || null,
      defaultPassword: input.defaultPassword || null,
      ...(input.disposition && { disposition: input.disposition as ComputerDisposition }),
      dateReceived: input.dateReceived ? new Date(input.dateReceived) : null,
      lastInventoried: input.lastInventoried ? new Date(input.lastInventoried) : null,
      notes: input.notes || null,
      siteId: input.siteId || null,
      kitId: input.kitId || null,
    },
  });

  const qrPath = `/c/${computer.id}`;
  const updated = await prisma.computer.update({
    where: { id: computer.id },
    data: { qrCode: qrPath },
    include: COMPUTER_INCLUDES,
  });

  if (input.hostNameId != null && typeof input.hostNameId === 'number') {
    const hostName = await prisma.hostName.findUnique({ where: { id: input.hostNameId } });
    if (hostName) {
      await prisma.hostName.update({
        where: { id: input.hostNameId },
        data: { computerId: computer.id },
      });
    }
  }

  await writeAuditLog(
    COMPUTER_FIELDS.map((field) => ({
      userId,
      objectType: 'Computer',
      objectId: computer.id,
      field,
      oldValue: null,
      newValue: (updated as any)[field] != null ? String((updated as any)[field]) : null,
    })).filter((e) => e.newValue != null),
  );

  const result = await prisma.computer.findUnique({
    where: { id: computer.id },
    include: COMPUTER_INCLUDES,
  });
  return result as unknown as ComputerRecord;
}

export async function updateComputer(id: number, input: UpdateComputerInput, userId: number): Promise<ComputerRecord> {
  const existing = await prisma.computer.findUnique({
    where: { id },
    include: { hostName: true },
  });
  if (!existing) throw new NotFoundError('Computer not found');

  if (input.disposition && !Object.values(ComputerDisposition).includes(input.disposition as ComputerDisposition)) {
    throw new ValidationError('Invalid disposition value');
  }

  if (input.siteId != null) {
    if (typeof input.siteId !== 'number') throw new ValidationError('siteId must be a number');
    const site = await prisma.site.findUnique({ where: { id: input.siteId } });
    if (!site) throw new ValidationError('Site not found');
  }

  if (input.kitId != null) {
    if (typeof input.kitId !== 'number') throw new ValidationError('kitId must be a number');
    const kit = await prisma.kit.findUnique({ where: { id: input.kitId } });
    if (!kit) throw new ValidationError('Kit not found');
  }

  const data: any = {};
  if (input.serialNumber !== undefined) data.serialNumber = input.serialNumber || null;
  if (input.serviceTag !== undefined) data.serviceTag = input.serviceTag || null;
  if (input.model !== undefined) data.model = input.model || null;
  if (input.defaultUsername !== undefined) data.defaultUsername = input.defaultUsername || null;
  if (input.defaultPassword !== undefined) data.defaultPassword = input.defaultPassword || null;
  if (input.disposition !== undefined) data.disposition = input.disposition as ComputerDisposition;
  if (input.dateReceived !== undefined) data.dateReceived = input.dateReceived ? new Date(input.dateReceived) : null;
  if (input.lastInventoried !== undefined) data.lastInventoried = input.lastInventoried ? new Date(input.lastInventoried) : null;
  if (input.notes !== undefined) data.notes = input.notes || null;
  if (input.siteId !== undefined) data.siteId = input.siteId;
  if (input.kitId !== undefined) data.kitId = input.kitId;

  const updated = await prisma.computer.update({
    where: { id },
    data,
    include: COMPUTER_INCLUDES,
  });

  const auditEntries = diffForAudit(userId, 'Computer', id, existing, updated, COMPUTER_FIELDS);

  if (input.hostNameId !== undefined) {
    const oldHostNameId = existing.hostName?.id ?? null;

    if (input.hostNameId === null) {
      if (existing.hostName) {
        await prisma.hostName.update({
          where: { id: existing.hostName.id },
          data: { computerId: null },
        });
      }
    } else if (typeof input.hostNameId === 'number') {
      if (existing.hostName && existing.hostName.id !== input.hostNameId) {
        await prisma.hostName.update({
          where: { id: existing.hostName.id },
          data: { computerId: null },
        });
      }
      await prisma.hostName.update({
        where: { id: input.hostNameId },
        data: { computerId: id },
      });
    }

    if (oldHostNameId !== input.hostNameId) {
      auditEntries.push({
        userId,
        objectType: 'Computer',
        objectId: id,
        field: 'hostName',
        oldValue: oldHostNameId != null ? String(oldHostNameId) : null,
        newValue: input.hostNameId != null ? String(input.hostNameId) : null,
      });
    }
  }

  if (auditEntries.length > 0) {
    await writeAuditLog(auditEntries);
  }

  const result = await prisma.computer.findUnique({
    where: { id },
    include: COMPUTER_INCLUDES,
  });
  return result as unknown as ComputerRecord;
}

export async function changeDisposition(id: number, disposition: string, userId: number): Promise<ComputerRecord> {
  const existing = await prisma.computer.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Computer not found');

  if (!disposition || !Object.values(ComputerDisposition).includes(disposition as ComputerDisposition)) {
    throw new ValidationError('Invalid disposition value');
  }

  const updated = await prisma.computer.update({
    where: { id },
    data: { disposition: disposition as ComputerDisposition },
    include: COMPUTER_INCLUDES,
  });

  await writeAuditLog({
    userId,
    objectType: 'Computer',
    objectId: id,
    field: 'disposition',
    oldValue: existing.disposition,
    newValue: disposition,
  });

  return updated as unknown as ComputerRecord;
}
