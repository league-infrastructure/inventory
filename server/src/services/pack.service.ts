import { PrismaClient } from '@prisma/client';
import { AuditService } from './audit.service';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError } from './errors';
import { PackRecord, PackDetailRecord, CreatePackInput, UpdatePackInput } from '../contracts';
import { resolveItemsFromDescription } from './description-parser';

export class PackService extends BaseService<PackRecord, CreatePackInput, UpdatePackInput> {
  protected readonly entityName = 'Pack';
  protected readonly auditFields = ['name', 'description', 'qrCode', 'kitId'];

  constructor(prisma: PrismaClient, audit: AuditService) {
    super(prisma, audit);
  }

  async list(kitId?: number): Promise<PackRecord[]> {
    if (kitId == null) throw new ValidationError('kitId is required');
    const kit = await this.prisma.kit.findUnique({ where: { id: kitId } });
    if (!kit) throw new NotFoundError('Kit not found');

    const packs = await this.prisma.pack.findMany({
      where: { kitId },
      include: { items: true },
      orderBy: { displayNumber: 'asc' },
    });
    return packs as unknown as PackRecord[];
  }

  async listAll(): Promise<PackDetailRecord[]> {
    const packs = await this.prisma.pack.findMany({
      include: {
        items: { orderBy: { name: 'asc' } },
        kit: { select: { id: true, name: true } },
      },
      orderBy: { displayNumber: 'asc' },
    });
    return packs as unknown as PackDetailRecord[];
  }

  async get(id: number): Promise<PackDetailRecord> {
    const pack = await this.prisma.pack.findUnique({
      where: { id },
      include: {
        items: { orderBy: { name: 'asc' } },
        kit: { select: { id: true, name: true } },
      },
    });
    if (!pack) throw new NotFoundError('Pack not found');
    return pack as unknown as PackDetailRecord;
  }

  async create(input: CreatePackInput, userId: number, kitId?: number, templatePackId?: number): Promise<PackDetailRecord> {
    if (kitId == null) throw new ValidationError('kitId is required');
    const kit = await this.prisma.kit.findUnique({ where: { id: kitId } });
    if (!kit) throw new NotFoundError('Kit not found');

    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }

    const existingPackCount = await this.prisma.pack.count({ where: { kitId } });

    const pack = await this.prisma.pack.create({
      data: {
        name: input.name.trim(),
        description: input.description || null,
        kitId,
        displayNumber: existingPackCount + 1,
      },
    });

    const qrPath = `/p/${pack.id}`;
    const updated = await this.prisma.pack.update({
      where: { id: pack.id },
      data: { qrCode: qrPath },
      include: { kit: { select: { id: true, name: true } } },
    });

    // Copy items from template pack if provided
    let items: any[] = [];
    if (templatePackId) {
      const templatePack = await this.prisma.pack.findUnique({
        where: { id: templatePackId },
        include: { items: true },
      });
      if (templatePack && templatePack.items.length > 0) {
        await this.prisma.item.createMany({
          data: templatePack.items.map((i) => ({
            name: i.name,
            type: i.type,
            expectedQuantity: i.expectedQuantity,
            packId: pack.id,
          })),
        });
        items = await this.prisma.item.findMany({
          where: { packId: pack.id },
          orderBy: { name: 'asc' },
        });
      }
    } else if (input.description) {
      // Auto-create items from description with fuzzy matching
      const allExistingItems = await this.prisma.item.findMany({
        select: { name: true, type: true },
        distinct: ['name'],
      });
      const resolved = resolveItemsFromDescription(input.description, allExistingItems);
      if (resolved.length > 0) {
        await this.prisma.item.createMany({
          data: resolved.map((r) => ({
            name: r.name,
            type: r.type as any,
            expectedQuantity: r.expectedQuantity,
            packId: pack.id,
          })),
        });
        items = await this.prisma.item.findMany({
          where: { packId: pack.id },
          orderBy: { name: 'asc' },
        });
      }
    }

    await this.auditCreate(userId, pack.id, updated);
    return { ...updated, items } as unknown as PackDetailRecord;
  }

  async update(id: number, input: UpdatePackInput, userId: number): Promise<PackDetailRecord> {
    const existing = await this.prisma.pack.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Pack not found');

    if (input.name != null && (typeof input.name !== 'string' || input.name.trim().length === 0)) {
      throw new ValidationError('Name cannot be empty');
    }

    const updated = await this.prisma.pack.update({
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

    const auditEntries = this.buildAuditEntries(userId, id, existing, updated);
    if (auditEntries.length > 0) {
      await this.writeAudit(auditEntries);
    }

    return updated as unknown as PackDetailRecord;
  }

  async delete(id: number, userId: number): Promise<void> {
    const existing = await this.prisma.pack.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Pack not found');

    await this.prisma.pack.delete({ where: { id } });

    await this.writeAudit(this.createAuditEntry(userId, id, 'deleted', existing.name, null));
  }

  /**
   * Renumber a kit's packs after a user edits one pack's displayNumber.
   *
   * Shared by the REST route and the MCP tool (ticket 002) — this is the
   * one place the sort-and-renumber algorithm lives, so the two surfaces
   * cannot diverge in behavior.
   *
   * Algorithm: build an in-memory (assignedNumber, recencyFlag) tuple per
   * pack — the edited pack gets (requestedNumber, 0), every other pack
   * keeps (its current displayNumber, 1) — then sort ascending by
   * (assignedNumber, recencyFlag) and assign 1..N by walk order. The
   * recencyFlag of 0 makes the edited pack win ties over whichever pack
   * previously held the contested number.
   *
   * Persisted via a two-phase update inside one prisma.$transaction: every
   * changing pack first moves to a unique negative sentinel (-id), then to
   * its final positive rank, so no intermediate row ever collides with
   * another under the @@unique([kitId, displayNumber]) constraint. Audit
   * rows are written for changed packs inside the same transaction.
   */
  async renumber(
    kitId: number,
    packId: number,
    requestedNumber: number,
    userId: number,
  ): Promise<PackRecord[]> {
    const kit = await this.prisma.kit.findUnique({ where: { id: kitId } });
    if (!kit) throw new NotFoundError('Kit not found');

    const packs = await this.prisma.pack.findMany({
      where: { kitId },
      orderBy: { displayNumber: 'asc' },
    });
    const n = packs.length;

    if (!Number.isInteger(requestedNumber) || requestedNumber < 1 || requestedNumber > n) {
      throw new ValidationError(`requestedNumber must be an integer between 1 and ${n}`);
    }

    const target = packs.find((p) => p.id === packId);
    if (!target) throw new NotFoundError('Pack not found in kit');

    const ranked = packs
      .map((p) => ({
        pack: p,
        assignedNumber: p.id === packId ? requestedNumber : p.displayNumber,
        recencyFlag: p.id === packId ? 0 : 1,
      }))
      .sort((a, b) => {
        if (a.assignedNumber !== b.assignedNumber) return a.assignedNumber - b.assignedNumber;
        return a.recencyFlag - b.recencyFlag;
      });

    const changes: Array<{ id: number; oldNumber: number; newNumber: number }> = [];
    ranked.forEach((entry, idx) => {
      const newNumber = idx + 1;
      if (newNumber !== entry.pack.displayNumber) {
        changes.push({ id: entry.pack.id, oldNumber: entry.pack.displayNumber, newNumber });
      }
    });

    if (changes.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        // Phase 1: move every changing pack to a unique negative sentinel
        // so no positive value is ever claimed by two rows at once.
        for (const change of changes) {
          await tx.pack.update({
            where: { id: change.id },
            data: { displayNumber: -change.id },
          });
        }
        // Phase 2: assign final positive 1..N ranks.
        for (const change of changes) {
          await tx.pack.update({
            where: { id: change.id },
            data: { displayNumber: change.newNumber },
          });
        }

        const auditEntries = changes.map((change) =>
          this.createAuditEntry(
            userId,
            change.id,
            'displayNumber',
            String(change.oldNumber),
            String(change.newNumber),
          ),
        );
        await this.audit.write(auditEntries, tx);
      });
    }

    return this.list(kitId);
  }
}
