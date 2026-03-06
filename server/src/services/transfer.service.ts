import { PrismaClient } from '@prisma/client';
import { AuditService } from './audit.service';
import { NotFoundError, ValidationError } from './errors';
import { TransferRecord, CreateTransferInput } from '../contracts';

const TRANSFER_INCLUDES = {
  user: { select: { id: true, displayName: true } },
};

export class TransferService {
  constructor(
    private prisma: PrismaClient,
    private audit: AuditService,
  ) {}

  async transfer(input: CreateTransferInput, userId: number): Promise<TransferRecord> {
    const { objectType, objectId } = input;

    if (objectType !== 'Kit' && objectType !== 'Computer') {
      throw new ValidationError('objectType must be Kit or Computer');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    if (objectType === 'Kit') {
      return this.transferKit(input, userId);
    } else {
      return this.transferComputer(input, userId);
    }
  }

  private async transferKit(input: CreateTransferInput, userId: number): Promise<TransferRecord> {
    const kit = await this.prisma.kit.findUnique({
      where: { id: input.objectId },
      include: {
        custodian: { select: { id: true, displayName: true } },
        site: { select: { id: true, name: true } },
        computers: { select: { id: true } },
      },
    });
    if (!kit) throw new NotFoundError('Kit not found');
    if (kit.status !== 'ACTIVE') throw new ValidationError('Kit is not active');

    // Resolve new custodian
    let newCustodianName: string | null = null;
    if (input.custodianId != null) {
      const custodian = await this.prisma.user.findUnique({ where: { id: input.custodianId } });
      if (!custodian) throw new ValidationError('Custodian user not found');
      newCustodianName = custodian.displayName;
    }

    // Resolve new site
    if (input.siteId !== undefined && input.siteId != null) {
      const site = await this.prisma.site.findUnique({ where: { id: input.siteId } });
      if (!site || !site.isActive) throw new ValidationError('Site not found or inactive');
    }

    const fromCustodian = kit.custodian?.displayName ?? 'Admin';
    const toCustodian = newCustodianName ?? 'Admin';
    const fromSiteId = kit.siteId;
    const toSiteId = input.siteId !== undefined ? input.siteId : kit.siteId;
    const toCustodianId = input.custodianId !== undefined ? input.custodianId : kit.custodianId;

    // Update kit
    await this.prisma.kit.update({
      where: { id: input.objectId },
      data: {
        custodianId: toCustodianId,
        siteId: toSiteId,
      },
    });

    // Cascade to computers in kit
    if (kit.computers.length > 0) {
      await this.prisma.computer.updateMany({
        where: { kitId: input.objectId },
        data: {
          custodianId: toCustodianId,
          siteId: toSiteId,
        },
      });
    }

    // Create transfer record
    const transfer = await this.prisma.transfer.create({
      data: {
        objectType: 'Kit',
        objectId: input.objectId,
        userId,
        fromCustodian,
        toCustodian,
        fromSiteId,
        toSiteId,
        notes: input.notes || null,
      },
      include: TRANSFER_INCLUDES,
    });

    // Write audit entries
    await this.audit.write([
      {
        userId,
        objectType: 'Kit',
        objectId: input.objectId,
        field: 'transfer',
        oldValue: fromCustodian,
        newValue: toCustodian,
      },
    ]);

    return this.toRecord(transfer);
  }

  private async transferComputer(input: CreateTransferInput, userId: number): Promise<TransferRecord> {
    const computer = await this.prisma.computer.findUnique({
      where: { id: input.objectId },
      include: {
        custodian: { select: { id: true, displayName: true } },
        site: { select: { id: true, name: true } },
      },
    });
    if (!computer) throw new NotFoundError('Computer not found');
    if (computer.kitId != null) {
      throw new ValidationError('Computer is in a kit — transfer the kit instead');
    }

    // Resolve new custodian
    let newCustodianName: string | null = null;
    if (input.custodianId != null) {
      const custodian = await this.prisma.user.findUnique({ where: { id: input.custodianId } });
      if (!custodian) throw new ValidationError('Custodian user not found');
      newCustodianName = custodian.displayName;
    }

    // Resolve new site
    if (input.siteId !== undefined && input.siteId != null) {
      const site = await this.prisma.site.findUnique({ where: { id: input.siteId } });
      if (!site || !site.isActive) throw new ValidationError('Site not found or inactive');
    }

    const fromCustodian = computer.custodian?.displayName ?? 'Admin';
    const toCustodian = newCustodianName ?? 'Admin';
    const fromSiteId = computer.siteId;
    const toSiteId = input.siteId !== undefined ? input.siteId : computer.siteId;
    const toCustodianId = input.custodianId !== undefined ? input.custodianId : computer.custodianId;

    // Update computer
    await this.prisma.computer.update({
      where: { id: input.objectId },
      data: {
        custodianId: toCustodianId,
        siteId: toSiteId,
      },
    });

    // Create transfer record
    const transfer = await this.prisma.transfer.create({
      data: {
        objectType: 'Computer',
        objectId: input.objectId,
        userId,
        fromCustodian,
        toCustodian,
        fromSiteId,
        toSiteId,
        notes: input.notes || null,
      },
      include: TRANSFER_INCLUDES,
    });

    // Write audit entry
    await this.audit.write([
      {
        userId,
        objectType: 'Computer',
        objectId: input.objectId,
        field: 'transfer',
        oldValue: fromCustodian,
        newValue: toCustodian,
      },
    ]);

    return this.toRecord(transfer);
  }

  async getHistory(objectType: string, objectId: number): Promise<TransferRecord[]> {
    const transfers = await this.prisma.transfer.findMany({
      where: { objectType, objectId },
      include: TRANSFER_INCLUDES,
      orderBy: { createdAt: 'desc' },
    });
    return transfers.map((t) => this.toRecord(t));
  }

  async getTransferredOut(): Promise<{
    kits: any[];
    computers: any[];
  }> {
    const [kits, computers] = await Promise.all([
      this.prisma.kit.findMany({
        where: { custodianId: { not: null }, status: 'ACTIVE' },
        include: {
          site: { select: { id: true, name: true } },
          custodian: { select: { id: true, displayName: true } },
        },
        orderBy: { number: 'asc' },
      }),
      this.prisma.computer.findMany({
        where: { custodianId: { not: null }, kitId: null },
        include: {
          site: { select: { id: true, name: true } },
          custodian: { select: { id: true, displayName: true } },
          hostName: { select: { name: true } },
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    return { kits, computers };
  }

  private toRecord(transfer: any): TransferRecord {
    return {
      id: transfer.id,
      objectType: transfer.objectType,
      objectId: transfer.objectId,
      userId: transfer.userId,
      fromCustodian: transfer.fromCustodian,
      toCustodian: transfer.toCustodian,
      fromSiteId: transfer.fromSiteId,
      toSiteId: transfer.toSiteId,
      notes: transfer.notes,
      createdAt: transfer.createdAt.toISOString(),
      user: transfer.user,
    };
  }
}
