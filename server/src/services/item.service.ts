import { PrismaClient, ItemType } from '@prisma/client';
import { AuditService } from './audit.service';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError } from './errors';
import { ItemRecord, CreateItemInput, UpdateItemInput } from '../contracts';

export class ItemService extends BaseService<ItemRecord, CreateItemInput, UpdateItemInput> {
  protected readonly entityName = 'Item';
  protected readonly auditFields = ['name', 'type', 'expectedQuantity', 'packId'];

  constructor(prisma: PrismaClient, audit: AuditService) {
    super(prisma, audit);
  }

  async list(packId?: number): Promise<ItemRecord[]> {
    if (packId == null) throw new ValidationError('packId is required');
    const pack = await this.prisma.pack.findUnique({ where: { id: packId } });
    if (!pack) throw new NotFoundError('Pack not found');

    const items = await this.prisma.item.findMany({
      where: { packId },
      orderBy: { name: 'asc' },
    });
    return items as unknown as ItemRecord[];
  }

  async get(id: number): Promise<ItemRecord> {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('Item not found');
    return item as unknown as ItemRecord;
  }

  async create(input: CreateItemInput, userId: number, packId?: number): Promise<ItemRecord> {
    if (packId == null) throw new ValidationError('packId is required');
    const pack = await this.prisma.pack.findUnique({ where: { id: packId } });
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

    const item = await this.prisma.item.create({
      data: {
        name: input.name.trim(),
        type: input.type as ItemType,
        expectedQuantity: input.type === 'COUNTED' ? input.expectedQuantity! : null,
        packId,
      },
    });

    await this.auditCreate(userId, item.id, item);
    return item as unknown as ItemRecord;
  }

  async update(id: number, input: UpdateItemInput, userId: number): Promise<ItemRecord> {
    const existing = await this.prisma.item.findUnique({ where: { id } });
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

    const updated = await this.prisma.item.update({
      where: { id },
      data: {
        ...(input.name != null && { name: input.name.trim() }),
        ...(input.type != null && { type: input.type as ItemType }),
        ...(input.expectedQuantity !== undefined && {
          expectedQuantity: effectiveType === 'COUNTED' ? input.expectedQuantity : null,
        }),
      },
    });

    const auditEntries = this.buildAuditEntries(userId, id, existing, updated);
    if (auditEntries.length > 0) {
      await this.writeAudit(auditEntries);
    }

    return updated as unknown as ItemRecord;
  }

  async delete(id: number, userId: number): Promise<void> {
    const existing = await this.prisma.item.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Item not found');

    await this.prisma.item.delete({ where: { id } });

    await this.writeAudit(this.createAuditEntry(userId, id, 'deleted', existing.name, null));
  }
}
