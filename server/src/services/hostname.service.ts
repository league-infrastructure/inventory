import { PrismaClient } from '@prisma/client';
import { AuditService } from './audit.service';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError, ConflictError } from './errors';
import { HostNameRecord, CreateHostNameInput } from '../contracts';

export class HostNameService extends BaseService<HostNameRecord, CreateHostNameInput, never> {
  protected readonly entityName = 'HostName';
  protected readonly auditFields = ['name'];

  constructor(prisma: PrismaClient, audit: AuditService) {
    super(prisma, audit);
  }

  async list(): Promise<HostNameRecord[]> {
    const hostnames = await this.prisma.hostName.findMany({
      orderBy: { name: 'asc' },
      include: {
        computer: {
          select: { id: true, model: true, serialNumber: true },
        },
      },
    });
    return hostnames as unknown as HostNameRecord[];
  }

  async get(id: number): Promise<HostNameRecord> {
    const hostname = await this.prisma.hostName.findUnique({
      where: { id },
      include: {
        computer: {
          select: { id: true, model: true, serialNumber: true },
        },
      },
    });
    if (!hostname) throw new NotFoundError('Host name not found');
    return hostname as unknown as HostNameRecord;
  }

  async create(input: CreateHostNameInput, _userId: number = 0): Promise<HostNameRecord> {
    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }

    const trimmedName = input.name.trim();
    const existing = await this.prisma.hostName.findFirst({
      where: { name: trimmedName },
    });
    if (existing) {
      throw new ConflictError('Host name already exists');
    }

    const hostname = await this.prisma.hostName.create({
      data: { name: trimmedName },
    });

    return hostname as unknown as HostNameRecord;
  }

  async update(_id: number, _input: never, _userId: number): Promise<HostNameRecord> {
    throw new ValidationError('Host names cannot be updated');
  }

  async delete(id: number): Promise<void> {
    const hostname = await this.prisma.hostName.findUnique({ where: { id } });
    if (!hostname) throw new NotFoundError('Host name not found');
    if (hostname.computerId !== null) {
      throw new ValidationError('Cannot delete host name that is assigned to a computer');
    }

    await this.prisma.hostName.delete({ where: { id } });
  }
}
