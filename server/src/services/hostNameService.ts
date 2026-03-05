import { prisma } from './prisma';
import { NotFoundError, ValidationError, ConflictError } from './errors';
import { HostNameRecord, CreateHostNameInput } from '../contracts';

export async function listHostNames(): Promise<HostNameRecord[]> {
  const hostnames = await prisma.hostName.findMany({
    orderBy: { name: 'asc' },
    include: {
      computer: {
        select: { id: true, model: true, serialNumber: true },
      },
    },
  });
  return hostnames as unknown as HostNameRecord[];
}

export async function createHostName(input: CreateHostNameInput): Promise<HostNameRecord> {
  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new ValidationError('Name is required');
  }

  const trimmedName = input.name.trim();
  const existing = await prisma.hostName.findFirst({
    where: { name: trimmedName },
  });
  if (existing) {
    throw new ConflictError('Host name already exists');
  }

  const hostname = await prisma.hostName.create({
    data: { name: trimmedName },
  });

  return hostname as unknown as HostNameRecord;
}

export async function deleteHostName(id: number): Promise<void> {
  const hostname = await prisma.hostName.findUnique({ where: { id } });
  if (!hostname) throw new NotFoundError('Host name not found');
  if (hostname.computerId !== null) {
    throw new ValidationError('Cannot delete host name that is assigned to a computer');
  }

  await prisma.hostName.delete({ where: { id } });
}
