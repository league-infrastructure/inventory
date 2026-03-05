import { prisma } from './prisma';
import { writeAuditLog } from './auditLog';
import { NotFoundError, ValidationError } from './errors';
import { CheckoutRecord, CreateCheckoutInput, CheckinInput } from '../contracts';

const CHECKOUT_INCLUDES = {
  kit: { select: { id: true, name: true, qrCode: true } },
  user: { select: { id: true, displayName: true } },
  destinationSite: { select: { id: true, name: true } },
  returnSite: { select: { id: true, name: true } },
};

export async function checkOut(input: CreateCheckoutInput, userId: number): Promise<CheckoutRecord> {
  if (!input.kitId || typeof input.kitId !== 'number') {
    throw new ValidationError('kitId is required and must be a number');
  }
  if (!input.destinationSiteId || typeof input.destinationSiteId !== 'number') {
    throw new ValidationError('destinationSiteId is required and must be a number');
  }

  const kit = await prisma.kit.findUnique({ where: { id: input.kitId } });
  if (!kit) throw new NotFoundError('Kit not found');
  if (kit.status !== 'ACTIVE') throw new ValidationError('Kit is not active');

  const openCheckout = await prisma.checkout.findFirst({
    where: { kitId: input.kitId, checkedInAt: null },
  });
  if (openCheckout) throw new ValidationError('Kit already has an open checkout');

  const site = await prisma.site.findUnique({ where: { id: input.destinationSiteId } });
  if (!site || !site.isActive) throw new ValidationError('Destination site not found or inactive');

  const checkout = await prisma.checkout.create({
    data: {
      kitId: input.kitId,
      userId,
      destinationSiteId: input.destinationSiteId,
    },
    include: CHECKOUT_INCLUDES,
  });

  await writeAuditLog({
    userId,
    objectType: 'Checkout',
    objectId: checkout.id,
    field: 'checkedOutAt',
    oldValue: null,
    newValue: checkout.checkedOutAt.toISOString(),
  });

  return checkout as unknown as CheckoutRecord;
}

export async function checkIn(checkoutId: number, input: CheckinInput, userId: number): Promise<CheckoutRecord> {
  if (!input.returnSiteId || typeof input.returnSiteId !== 'number') {
    throw new ValidationError('returnSiteId is required and must be a number');
  }

  const checkout = await prisma.checkout.findUnique({ where: { id: checkoutId } });
  if (!checkout) throw new NotFoundError('Checkout not found');
  if (checkout.checkedInAt !== null) throw new ValidationError('Checkout is already checked in');

  const site = await prisma.site.findUnique({ where: { id: input.returnSiteId } });
  if (!site) throw new NotFoundError('Return site not found');

  const now = new Date();
  const updated = await prisma.checkout.update({
    where: { id: checkoutId },
    data: {
      returnSiteId: input.returnSiteId,
      checkedInAt: now,
    },
    include: CHECKOUT_INCLUDES,
  });

  await writeAuditLog({
    userId,
    objectType: 'Checkout',
    objectId: checkoutId,
    field: 'checkedInAt',
    oldValue: null,
    newValue: now.toISOString(),
  });

  return updated as unknown as CheckoutRecord;
}

export async function listCheckouts(status: string = 'open'): Promise<CheckoutRecord[]> {
  const where: any = {};
  if (status === 'open') {
    where.checkedInAt = null;
  } else if (status === 'closed') {
    where.checkedInAt = { not: null };
  }

  const checkouts = await prisma.checkout.findMany({
    where,
    include: CHECKOUT_INCLUDES,
    orderBy: { checkedOutAt: 'desc' },
  });
  return checkouts as unknown as CheckoutRecord[];
}

export async function getCheckoutHistory(kitId: number): Promise<CheckoutRecord[]> {
  const kit = await prisma.kit.findUnique({ where: { id: kitId } });
  if (!kit) throw new NotFoundError('Kit not found');

  const checkouts = await prisma.checkout.findMany({
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
