import { PrismaClient, KitStatus, ContainerType } from '@prisma/client';
import { AuditService } from './audit.service';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError } from './errors';
import { KitRecord, KitDetailRecord, CreateKitInput, UpdateKitInput, CONTAINER_TYPES } from '../contracts';

export class KitService extends BaseService<KitRecord, CreateKitInput, UpdateKitInput> {
  protected readonly entityName = 'Kit';
  protected readonly auditFields = ['number', 'containerType', 'name', 'description', 'status', 'siteId', 'qrCode'];

  constructor(prisma: PrismaClient, audit: AuditService) {
    super(prisma, audit);
  }

  async list(statusFilter?: string): Promise<KitRecord[]> {
    const where: any = {};
    if (statusFilter && Object.values(KitStatus).includes(statusFilter as KitStatus)) {
      where.status = statusFilter;
    }

    const kits = await this.prisma.kit.findMany({
      where,
      include: {
        site: { select: { id: true, name: true } },
        inventoryChecks: {
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { number: 'asc' },
    });
    return kits.map((kit) => {
      const { inventoryChecks, ...rest } = kit;
      return {
        ...rest,
        lastInventoried: inventoryChecks[0]?.createdAt?.toISOString() ?? null,
      } as unknown as KitRecord;
    });
  }

  async get(id: number): Promise<KitDetailRecord> {
    const kit = await this.prisma.kit.findUnique({
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

  async create(input: CreateKitInput, userId: number): Promise<KitRecord> {
    if (input.number == null || typeof input.number !== 'number') {
      throw new ValidationError('Number is required');
    }
    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }
    if (!input.siteId || typeof input.siteId !== 'number') {
      throw new ValidationError('siteId is required');
    }
    if (input.containerType && !CONTAINER_TYPES.includes(input.containerType)) {
      throw new ValidationError('Invalid container type');
    }

    // Check number uniqueness
    const existing = await this.prisma.kit.findUnique({ where: { number: input.number } });
    if (existing) throw new ValidationError(`Kit number ${input.number} is already in use`);

    const site = await this.prisma.site.findUnique({ where: { id: input.siteId } });
    if (!site || !site.isActive) {
      throw new ValidationError('Site not found or inactive');
    }

    const kit = await this.prisma.kit.create({
      data: {
        number: input.number,
        containerType: (input.containerType || 'BAG') as ContainerType,
        name: input.name.trim(),
        description: input.description || null,
        siteId: input.siteId,
      },
    });

    const qrPath = `/k/${kit.id}`;
    const updated = await this.prisma.kit.update({
      where: { id: kit.id },
      data: { qrCode: qrPath },
      include: { site: { select: { id: true, name: true } } },
    });

    await this.auditCreate(userId, kit.id, updated);
    return updated as unknown as KitRecord;
  }

  async update(id: number, input: UpdateKitInput, userId: number): Promise<KitRecord> {
    const existing = await this.prisma.kit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Kit not found');

    if (input.name != null && (typeof input.name !== 'string' || input.name.trim().length === 0)) {
      throw new ValidationError('Name cannot be empty');
    }
    if (input.containerType != null && !CONTAINER_TYPES.includes(input.containerType)) {
      throw new ValidationError('Invalid container type');
    }
    if (input.number != null) {
      const dup = await this.prisma.kit.findUnique({ where: { number: input.number } });
      if (dup && dup.id !== id) throw new ValidationError(`Kit number ${input.number} is already in use`);
    }
    if (input.siteId != null) {
      if (typeof input.siteId !== 'number') throw new ValidationError('siteId must be a number');
      const site = await this.prisma.site.findUnique({ where: { id: input.siteId } });
      if (!site || !site.isActive) throw new ValidationError('Site not found or inactive');
    }
    if (input.status != null && !Object.values(KitStatus).includes(input.status as KitStatus)) {
      throw new ValidationError('Invalid status value');
    }

    const updated = await this.prisma.kit.update({
      where: { id },
      data: {
        ...(input.number != null && { number: input.number }),
        ...(input.containerType != null && { containerType: input.containerType as ContainerType }),
        ...(input.name != null && { name: input.name.trim() }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.siteId != null && { siteId: input.siteId }),
        ...(input.status != null && { status: input.status as KitStatus }),
      },
      include: { site: { select: { id: true, name: true } } },
    });

    const auditEntries = this.buildAuditEntries(userId, id, existing, updated);
    if (auditEntries.length > 0) {
      await this.writeAudit(auditEntries);
    }

    return updated as unknown as KitRecord;
  }

  async retire(id: number, userId: number): Promise<KitRecord> {
    const existing = await this.prisma.kit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Kit not found');
    if (existing.status === 'RETIRED') throw new ValidationError('Kit is already retired');

    const updated = await this.prisma.kit.update({
      where: { id },
      data: { status: 'RETIRED' },
      include: { site: { select: { id: true, name: true } } },
    });

    await this.writeAudit(this.createAuditEntry(userId, id, 'status', existing.status, 'RETIRED'));
    return updated as unknown as KitRecord;
  }

  async clone(id: number, userId: number): Promise<KitDetailRecord> {
    const source = await this.prisma.kit.findUnique({
      where: { id },
      include: { packs: { include: { items: true } } },
    });
    if (!source) throw new NotFoundError('Kit not found');

    // Find next available number
    const maxKit = await this.prisma.kit.findFirst({ orderBy: { number: 'desc' } });
    const nextNumber = (maxKit?.number ?? 0) + 1;

    const newKit = await this.prisma.kit.create({
      data: {
        number: nextNumber,
        containerType: source.containerType,
        name: `${source.name} (Copy)`,
        description: source.description,
        siteId: source.siteId,
      },
    });

    const qrPath = `/k/${newKit.id}`;
    await this.prisma.kit.update({
      where: { id: newKit.id },
      data: { qrCode: qrPath },
    });

    for (const pack of source.packs) {
      const newPack = await this.prisma.pack.create({
        data: {
          name: pack.name,
          description: pack.description,
          kitId: newKit.id,
        },
      });
      const packQrPath = `/p/${newPack.id}`;
      await this.prisma.pack.update({
        where: { id: newPack.id },
        data: { qrCode: packQrPath },
      });

      for (const item of pack.items) {
        await this.prisma.item.create({
          data: {
            name: item.name,
            type: item.type,
            expectedQuantity: item.expectedQuantity,
            packId: newPack.id,
          },
        });
      }
    }

    await this.writeAudit(this.createAuditEntry(
      userId, newKit.id, 'clone', null, `Cloned from Kit #${source.id}`,
    ));

    const result = await this.prisma.kit.findUnique({
      where: { id: newKit.id },
      include: {
        site: { select: { id: true, name: true } },
        packs: { include: { items: true } },
        computers: { include: { hostName: true }, orderBy: { id: 'asc' } },
      },
    });
    return result as unknown as KitDetailRecord;
  }
}
