import { PrismaClient } from '@prisma/client';
import { AuditService } from './audit.service';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError } from './errors';
import { OperatingSystemRecord, CreateOperatingSystemInput, UpdateOperatingSystemInput } from '../contracts';

export class OsService extends BaseService<OperatingSystemRecord, CreateOperatingSystemInput, UpdateOperatingSystemInput> {
  protected readonly entityName = 'OperatingSystem';
  protected readonly auditFields = ['name'];

  constructor(prisma: PrismaClient, audit: AuditService) {
    super(prisma, audit);
  }

  async list(): Promise<OperatingSystemRecord[]> {
    const items = await this.prisma.operatingSystem.findMany({ orderBy: { name: 'asc' } });
    return items as unknown as OperatingSystemRecord[];
  }

  async get(id: number): Promise<OperatingSystemRecord> {
    const os = await this.prisma.operatingSystem.findUnique({ where: { id } });
    if (!os) throw new NotFoundError('Operating system not found');
    return os as unknown as OperatingSystemRecord;
  }

  async create(input: CreateOperatingSystemInput, userId: number): Promise<OperatingSystemRecord> {
    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }

    const existing = await this.prisma.operatingSystem.findUnique({ where: { name: input.name.trim() } });
    if (existing) {
      throw new ValidationError(`Operating system "${input.name.trim()}" already exists`);
    }

    const os = await this.prisma.operatingSystem.create({
      data: { name: input.name.trim() },
    });

    await this.auditCreate(userId, os.id, os);
    return os as unknown as OperatingSystemRecord;
  }

  async update(id: number, input: UpdateOperatingSystemInput, userId: number): Promise<OperatingSystemRecord> {
    const existing = await this.prisma.operatingSystem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Operating system not found');

    if (input.name != null) {
      if (typeof input.name !== 'string' || input.name.trim().length === 0) {
        throw new ValidationError('Name cannot be empty');
      }
      const dup = await this.prisma.operatingSystem.findUnique({ where: { name: input.name.trim() } });
      if (dup && dup.id !== id) {
        throw new ValidationError(`Operating system "${input.name.trim()}" already exists`);
      }
    }

    const updated = await this.prisma.operatingSystem.update({
      where: { id },
      data: {
        ...(input.name != null && { name: input.name.trim() }),
      },
    });

    const auditEntries = this.buildAuditEntries(userId, id, existing, updated);
    if (auditEntries.length > 0) {
      await this.writeAudit(auditEntries);
    }

    return updated as unknown as OperatingSystemRecord;
  }

  async delete(id: number): Promise<void> {
    const existing = await this.prisma.operatingSystem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Operating system not found');

    const count = await this.prisma.computer.count({ where: { osId: id } });
    if (count > 0) {
      throw new ValidationError(`Cannot delete: ${count} computer(s) still using this OS`);
    }

    await this.prisma.operatingSystem.delete({ where: { id } });
  }
}
