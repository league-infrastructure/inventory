import { PrismaClient } from '@prisma/client';
import { AuditService } from './audit.service';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError } from './errors';
import { ManufacturerRecord, CreateManufacturerInput, UpdateManufacturerInput } from '../contracts';

export class ManufacturerService extends BaseService<ManufacturerRecord, CreateManufacturerInput, UpdateManufacturerInput> {
  protected readonly entityName = 'Manufacturer';
  protected readonly auditFields = ['name'];

  constructor(prisma: PrismaClient, audit: AuditService) {
    super(prisma, audit);
  }

  async list(): Promise<ManufacturerRecord[]> {
    const items = await this.prisma.manufacturer.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return items as unknown as ManufacturerRecord[];
  }

  async get(id: number): Promise<ManufacturerRecord> {
    const mfg = await this.prisma.manufacturer.findUnique({ where: { id } });
    if (!mfg) throw new NotFoundError('Manufacturer not found');
    return mfg as unknown as ManufacturerRecord;
  }

  async create(input: CreateManufacturerInput, userId: number): Promise<ManufacturerRecord> {
    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }

    const existing = await this.prisma.manufacturer.findUnique({ where: { name: input.name.trim() } });
    if (existing) {
      throw new ValidationError(`Manufacturer "${input.name.trim()}" already exists`);
    }

    const mfg = await this.prisma.manufacturer.create({
      data: { name: input.name.trim() },
    });

    await this.auditCreate(userId, mfg.id, mfg);
    return mfg as unknown as ManufacturerRecord;
  }

  async update(id: number, input: UpdateManufacturerInput, userId: number): Promise<ManufacturerRecord> {
    const existing = await this.prisma.manufacturer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Manufacturer not found');

    if (input.name != null) {
      if (typeof input.name !== 'string' || input.name.trim().length === 0) {
        throw new ValidationError('Name cannot be empty');
      }
      const dup = await this.prisma.manufacturer.findUnique({ where: { name: input.name.trim() } });
      if (dup && dup.id !== id) {
        throw new ValidationError(`Manufacturer "${input.name.trim()}" already exists`);
      }
    }

    const updated = await this.prisma.manufacturer.update({
      where: { id },
      data: {
        ...(input.name != null && { name: input.name.trim() }),
      },
    });

    const auditEntries = this.buildAuditEntries(userId, id, existing, updated);
    if (auditEntries.length > 0) {
      await this.writeAudit(auditEntries);
    }

    return updated as unknown as ManufacturerRecord;
  }

  async delete(id: number): Promise<void> {
    const existing = await this.prisma.manufacturer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Manufacturer not found');

    const computerCount = await this.prisma.computer.count({ where: { manufacturerId: id } });
    if (computerCount > 0) {
      throw new ValidationError(`Cannot delete: ${computerCount} computer(s) still using this manufacturer`);
    }

    await this.prisma.manufacturer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
