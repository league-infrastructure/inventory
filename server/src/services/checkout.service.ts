import { PrismaClient } from '@prisma/client';
import { AuditService } from './audit.service';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError } from './errors';
import { CheckoutRecord, CreateCheckoutInput, CheckinInput } from '../contracts';

const CHECKOUT_INCLUDES = {
  kit: { select: { id: true, name: true, qrCode: true } },
  user: { select: { id: true, displayName: true } },
  destinationSite: { select: { id: true, name: true } },
  returnSite: { select: { id: true, name: true } },
};

export class CheckoutService extends BaseService<CheckoutRecord, CreateCheckoutInput, CheckinInput> {
  protected readonly entityName = 'Checkout';
  protected readonly auditFields = ['kitId', 'userId', 'destinationSiteId', 'returnSiteId', 'checkedOutAt', 'checkedInAt'];

  constructor(prisma: PrismaClient, audit: AuditService) {
    super(prisma, audit);
  }

  async list(status: string = 'open'): Promise<CheckoutRecord[]> {
    const where: any = {};
    if (status === 'open') {
      where.checkedInAt = null;
    } else if (status === 'closed') {
      where.checkedInAt = { not: null };
    }

    const checkouts = await this.prisma.checkout.findMany({
      where,
      include: CHECKOUT_INCLUDES,
      orderBy: { checkedOutAt: 'desc' },
    });
    return checkouts as unknown as CheckoutRecord[];
  }

  async get(id: number): Promise<CheckoutRecord> {
    const checkout = await this.prisma.checkout.findUnique({
      where: { id },
      include: CHECKOUT_INCLUDES,
    });
    if (!checkout) throw new NotFoundError('Checkout not found');
    return checkout as unknown as CheckoutRecord;
  }

  async create(input: CreateCheckoutInput, userId: number): Promise<CheckoutRecord> {
    return this.checkOut(input, userId);
  }

  async update(id: number, input: CheckinInput, userId: number): Promise<CheckoutRecord> {
    return this.checkIn(id, input, userId);
  }

  async checkOut(input: CreateCheckoutInput, userId: number): Promise<CheckoutRecord> {
    if (!input.kitId || typeof input.kitId !== 'number') {
      throw new ValidationError('kitId is required and must be a number');
    }

    const kit = await this.prisma.kit.findUnique({ where: { id: input.kitId } });
    if (!kit) throw new NotFoundError('Kit not found');
    if (kit.status !== 'ACTIVE') throw new ValidationError('Kit is not active');

    const openCheckout = await this.prisma.checkout.findFirst({
      where: { kitId: input.kitId, checkedInAt: null },
    });
    if (openCheckout) throw new ValidationError('Kit already has an open checkout');

    // Validate destination site if provided
    if (input.destinationSiteId) {
      const site = await this.prisma.site.findUnique({ where: { id: input.destinationSiteId } });
      if (!site || !site.isActive) throw new ValidationError('Destination site not found or inactive');
    }

    const checkout = await this.prisma.checkout.create({
      data: {
        kitId: input.kitId,
        userId,
        destinationSiteId: input.destinationSiteId ?? null,
      },
      include: CHECKOUT_INCLUDES,
    });

    await this.writeAudit(this.createAuditEntry(
      userId, checkout.id, 'checkedOutAt', null, checkout.checkedOutAt.toISOString(),
    ));

    return checkout as unknown as CheckoutRecord;
  }

  async checkIn(checkoutId: number, input: CheckinInput, userId: number): Promise<CheckoutRecord> {
    if (!input.returnSiteId || typeof input.returnSiteId !== 'number') {
      throw new ValidationError('returnSiteId is required and must be a number');
    }

    const checkout = await this.prisma.checkout.findUnique({ where: { id: checkoutId } });
    if (!checkout) throw new NotFoundError('Checkout not found');
    if (checkout.checkedInAt !== null) throw new ValidationError('Checkout is already checked in');

    const site = await this.prisma.site.findUnique({ where: { id: input.returnSiteId } });
    if (!site) throw new NotFoundError('Return site not found');

    const now = new Date();
    const updated = await this.prisma.checkout.update({
      where: { id: checkoutId },
      data: {
        returnSiteId: input.returnSiteId,
        checkedInAt: now,
      },
      include: CHECKOUT_INCLUDES,
    });

    await this.writeAudit(this.createAuditEntry(
      userId, checkoutId, 'checkedInAt', null, now.toISOString(),
    ));

    return updated as unknown as CheckoutRecord;
  }

  async getHistory(kitId: number): Promise<CheckoutRecord[]> {
    const kit = await this.prisma.kit.findUnique({ where: { id: kitId } });
    if (!kit) throw new NotFoundError('Kit not found');

    const checkouts = await this.prisma.checkout.findMany({
      where: { kitId },
      include: {
        user: { select: { id: true, displayName: true } },
        destinationSite: { select: { id: true, name: true } },
        returnSite: { select: { id: true, name: true } },
      },
      orderBy: { checkedOutAt: 'desc' },
    });
    return checkouts as unknown as CheckoutRecord[];
  }
}
