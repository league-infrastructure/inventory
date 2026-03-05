import { PrismaClient, KitStatus } from '@prisma/client';
import { AuditService } from './audit.service';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError } from './errors';
import { KitRecord, KitDetailRecord, CreateKitInput, UpdateKitInput } from '../contracts';

export class KitService extends BaseService<KitRecord, CreateKitInput, UpdateKitInput> {
  protected readonly entityName = 'Kit';
  protected readonly auditFields = ['name', 'description', 'status', 'siteId', 'qrCode'];

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
      include: { site: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    return kits as unknown as KitRecord[];
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
    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }
    if (!input.siteId || typeof input.siteId !== 'number') {
      throw new ValidationError('siteId is required');
    }

    const site = await this.prisma.site.findUnique({ where: { id: input.siteId } });
    if (!site || !site.isActive) {
      throw new ValidationError('Site not found or inactive');
    }

    const kit = await this.prisma.kit.create({
      data: {
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
    if (input.siteId != null) {
      if (typeof input.siteId !== 'number') throw new ValidationError('siteId must be a number');
      const site = await this.prisma.site.findUnique({ where: { id: input.siteId } });
      if (!site || !site.isActive) throw new ValidationError('Site not found or inactive');
    }

    const updated = await this.prisma.kit.update({
      where: { id },
      data: {
        ...(input.name != null && { name: input.name.trim() }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.siteId != null && { siteId: input.siteId }),
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

    const newKit = await this.prisma.kit.create({
      data: {
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
