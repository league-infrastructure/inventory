import { PrismaClient } from '@prisma/client';
import { AuditService } from './audit.service';
import { NotFoundError, ValidationError } from './errors';
import {
  InventoryCheckRecord,
  InventoryCheckLineRecord,
  SubmitInventoryCheckInput,
} from '../contracts';

const CHECK_INCLUDES = {
  user: { select: { id: true, displayName: true } },
  kit: { select: { id: true, name: true } },
  pack: { select: { id: true, name: true } },
  lines: true,
};

function toRecord(check: any): InventoryCheckRecord {
  return {
    ...check,
    createdAt: check.createdAt instanceof Date ? check.createdAt.toISOString() : check.createdAt,
    discrepancyCount: check.lines.filter((l: any) => l.hasDiscrepancy).length,
  };
}

export class InventoryCheckService {
  private prisma: PrismaClient;
  private audit: AuditService;

  constructor(prisma: PrismaClient, audit: AuditService) {
    this.prisma = prisma;
    this.audit = audit;
  }

  async startKitCheck(kitId: number, userId: number): Promise<InventoryCheckRecord> {
    const kit = await this.prisma.kit.findUnique({
      where: { id: kitId },
      include: {
        packs: {
          include: { items: true },
        },
        computers: true,
      },
    });
    if (!kit) throw new NotFoundError('Kit not found');

    const lines: { objectType: string; objectId: number; expectedValue: string | null }[] = [];

    for (const pack of kit.packs) {
      for (const item of pack.items) {
        const expected = item.type === 'COUNTED'
          ? String(item.expectedQuantity ?? 0)
          : 'present';
        lines.push({ objectType: 'Item', objectId: item.id, expectedValue: expected });
      }
    }

    for (const computer of kit.computers) {
      lines.push({ objectType: 'Computer', objectId: computer.id, expectedValue: 'present' });
    }

    const check = await this.prisma.inventoryCheck.create({
      data: {
        kitId,
        userId,
        lines: {
          create: lines.map((l) => ({
            objectType: l.objectType,
            objectId: l.objectId,
            expectedValue: l.expectedValue,
          })),
        },
      },
      include: CHECK_INCLUDES,
    });

    return toRecord(check);
  }

  async startPackCheck(packId: number, userId: number): Promise<InventoryCheckRecord> {
    const pack = await this.prisma.pack.findUnique({
      where: { id: packId },
      include: { items: true },
    });
    if (!pack) throw new NotFoundError('Pack not found');

    const lines = pack.items.map((item) => ({
      objectType: 'Item' as const,
      objectId: item.id,
      expectedValue: item.type === 'COUNTED'
        ? String(item.expectedQuantity ?? 0)
        : 'present',
    }));

    const check = await this.prisma.inventoryCheck.create({
      data: {
        packId,
        userId,
        lines: {
          create: lines.map((l) => ({
            objectType: l.objectType,
            objectId: l.objectId,
            expectedValue: l.expectedValue,
          })),
        },
      },
      include: CHECK_INCLUDES,
    });

    return toRecord(check);
  }

  async submitCheck(
    checkId: number,
    input: SubmitInventoryCheckInput,
    userId: number,
  ): Promise<InventoryCheckRecord> {
    const check = await this.prisma.inventoryCheck.findUnique({
      where: { id: checkId },
      include: { lines: true },
    });
    if (!check) throw new NotFoundError('Inventory check not found');

    if (!input.lines || !Array.isArray(input.lines)) {
      throw new ValidationError('lines array is required');
    }

    const lineMap = new Map(check.lines.map((l) => [l.id, l]));

    for (const update of input.lines) {
      const line = lineMap.get(update.id);
      if (!line) throw new ValidationError(`Line ${update.id} not found in this check`);

      const hasDiscrepancy = line.expectedValue !== update.actualValue;

      await this.prisma.inventoryCheckLine.update({
        where: { id: update.id },
        data: {
          actualValue: update.actualValue,
          hasDiscrepancy,
        },
      });

      // Update computer lastInventoried if present
      if (line.objectType === 'Computer' && update.actualValue === 'present') {
        await this.prisma.computer.update({
          where: { id: line.objectId },
          data: { lastInventoried: new Date() },
        });
      }
    }

    // Update notes if provided
    if (input.notes !== undefined) {
      await this.prisma.inventoryCheck.update({
        where: { id: checkId },
        data: { notes: input.notes },
      });
    }

    // Touch kit's updatedAt so the list reflects the check
    if (check.kitId) {
      await this.prisma.kit.update({
        where: { id: check.kitId },
        data: { updatedAt: new Date() },
      });
    }

    // Write audit entry
    await this.audit.write({
      userId,
      objectType: 'InventoryCheck',
      objectId: checkId,
      field: 'submitted',
      oldValue: null,
      newValue: new Date().toISOString(),
    });

    const updated = await this.prisma.inventoryCheck.findUnique({
      where: { id: checkId },
      include: CHECK_INCLUDES,
    });

    return toRecord(updated!);
  }

  async getCheck(id: number): Promise<InventoryCheckRecord> {
    const check = await this.prisma.inventoryCheck.findUnique({
      where: { id },
      include: CHECK_INCLUDES,
    });
    if (!check) throw new NotFoundError('Inventory check not found');
    return toRecord(check);
  }

  async getHistory(
    kitId?: number,
    packId?: number,
  ): Promise<InventoryCheckRecord[]> {
    const where: any = {};
    if (kitId) where.kitId = kitId;
    if (packId) where.packId = packId;

    const checks = await this.prisma.inventoryCheck.findMany({
      where,
      include: CHECK_INCLUDES,
      orderBy: { createdAt: 'desc' },
    });

    return checks.map(toRecord);
  }
}
