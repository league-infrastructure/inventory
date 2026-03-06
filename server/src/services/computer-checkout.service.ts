import { PrismaClient } from '@prisma/client';
import { AuditService } from './audit.service';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError } from './errors';
import { ComputerCheckoutRecord, CreateComputerCheckoutInput, ComputerCheckinInput } from '../contracts';

const COMPUTER_CHECKOUT_INCLUDES = {
  computer: { select: { id: true, model: true, qrCode: true } },
  user: { select: { id: true, displayName: true } },
  destinationSite: { select: { id: true, name: true } },
  returnSite: { select: { id: true, name: true } },
};

export class ComputerCheckoutService extends BaseService<ComputerCheckoutRecord, CreateComputerCheckoutInput, ComputerCheckinInput> {
  protected readonly entityName = 'ComputerCheckout';
  protected readonly auditFields = ['computerId', 'userId', 'destinationSiteId', 'returnSiteId', 'checkedOutAt', 'checkedInAt'];

  constructor(prisma: PrismaClient, audit: AuditService) {
    super(prisma, audit);
  }

  async list(status: string = 'open'): Promise<ComputerCheckoutRecord[]> {
    const where: any = {};
    if (status === 'open') {
      where.checkedInAt = null;
    } else if (status === 'closed') {
      where.checkedInAt = { not: null };
    }

    const checkouts = await this.prisma.computerCheckout.findMany({
      where,
      include: COMPUTER_CHECKOUT_INCLUDES,
      orderBy: { checkedOutAt: 'desc' },
    });
    return checkouts as unknown as ComputerCheckoutRecord[];
  }

  async get(id: number): Promise<ComputerCheckoutRecord> {
    const checkout = await this.prisma.computerCheckout.findUnique({
      where: { id },
      include: COMPUTER_CHECKOUT_INCLUDES,
    });
    if (!checkout) throw new NotFoundError('Computer checkout not found');
    return checkout as unknown as ComputerCheckoutRecord;
  }

  async create(input: CreateComputerCheckoutInput, userId: number): Promise<ComputerCheckoutRecord> {
    return this.checkOut(input, userId);
  }

  async update(id: number, input: ComputerCheckinInput, userId: number): Promise<ComputerCheckoutRecord> {
    return this.checkIn(id, input, userId);
  }

  async checkOut(input: CreateComputerCheckoutInput, userId: number): Promise<ComputerCheckoutRecord> {
    if (!input.computerId || typeof input.computerId !== 'number') {
      throw new ValidationError('computerId is required and must be a number');
    }

    const computer = await this.prisma.computer.findUnique({ where: { id: input.computerId } });
    if (!computer) throw new NotFoundError('Computer not found');
    if (computer.disposition !== 'ACTIVE') throw new ValidationError('Computer is not active');
    if (computer.kitId != null) throw new ValidationError('Computer is assigned to a kit and cannot be checked out individually');

    const openCheckout = await this.prisma.computerCheckout.findFirst({
      where: { computerId: input.computerId, checkedInAt: null },
    });
    if (openCheckout) throw new ValidationError('Computer already has an open checkout');

    if (input.destinationSiteId) {
      const site = await this.prisma.site.findUnique({ where: { id: input.destinationSiteId } });
      if (!site || !site.isActive) throw new ValidationError('Destination site not found or inactive');
    }

    const checkout = await this.prisma.computerCheckout.create({
      data: {
        computerId: input.computerId,
        userId,
        destinationSiteId: input.destinationSiteId ?? null,
      },
      include: COMPUTER_CHECKOUT_INCLUDES,
    });

    await this.writeAudit(this.createAuditEntry(
      userId, checkout.id, 'checkedOutAt', null, checkout.checkedOutAt.toISOString(),
    ));

    return checkout as unknown as ComputerCheckoutRecord;
  }

  async checkIn(checkoutId: number, input: ComputerCheckinInput, userId: number): Promise<ComputerCheckoutRecord> {
    if (!input.returnSiteId || typeof input.returnSiteId !== 'number') {
      throw new ValidationError('returnSiteId is required and must be a number');
    }

    const checkout = await this.prisma.computerCheckout.findUnique({ where: { id: checkoutId } });
    if (!checkout) throw new NotFoundError('Computer checkout not found');
    if (checkout.checkedInAt !== null) throw new ValidationError('Checkout is already checked in');

    const site = await this.prisma.site.findUnique({ where: { id: input.returnSiteId } });
    if (!site) throw new NotFoundError('Return site not found');

    const now = new Date();
    const updated = await this.prisma.computerCheckout.update({
      where: { id: checkoutId },
      data: {
        returnSiteId: input.returnSiteId,
        checkedInAt: now,
      },
      include: COMPUTER_CHECKOUT_INCLUDES,
    });

    await this.writeAudit(this.createAuditEntry(
      userId, checkoutId, 'checkedInAt', null, now.toISOString(),
    ));

    return updated as unknown as ComputerCheckoutRecord;
  }

  async getHistory(computerId: number): Promise<ComputerCheckoutRecord[]> {
    const computer = await this.prisma.computer.findUnique({ where: { id: computerId } });
    if (!computer) throw new NotFoundError('Computer not found');

    const checkouts = await this.prisma.computerCheckout.findMany({
      where: { computerId },
      include: COMPUTER_CHECKOUT_INCLUDES,
      orderBy: { checkedOutAt: 'desc' },
    });
    return checkouts as unknown as ComputerCheckoutRecord[];
  }

  async isCheckedOut(computerId: number): Promise<boolean> {
    const open = await this.prisma.computerCheckout.findFirst({
      where: { computerId, checkedInAt: null },
    });
    return open !== null;
  }
}
