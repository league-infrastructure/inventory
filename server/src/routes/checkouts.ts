import { Router, Request, Response } from 'express';
import { User } from '@prisma/client';
import { prisma } from '../services/prisma';
import { writeAuditLog } from '../services/auditLog';
import { requireAuth } from '../middleware/requireAuth';

export const checkoutsRouter = Router();

// Check out a kit
checkoutsRouter.post('/checkouts', requireAuth, async (req: Request, res: Response) => {
  const { kitId, destinationSiteId } = req.body;

  if (!kitId || typeof kitId !== 'number') {
    return res.status(400).json({ error: 'kitId is required and must be a number' });
  }
  if (!destinationSiteId || typeof destinationSiteId !== 'number') {
    return res.status(400).json({ error: 'destinationSiteId is required and must be a number' });
  }

  // Validate kit exists and is ACTIVE
  const kit = await prisma.kit.findUnique({ where: { id: kitId } });
  if (!kit) {
    return res.status(404).json({ error: 'Kit not found' });
  }
  if (kit.status !== 'ACTIVE') {
    return res.status(400).json({ error: 'Kit is not active' });
  }

  // Check for open checkout
  const openCheckout = await prisma.checkout.findFirst({
    where: { kitId, checkedInAt: null },
  });
  if (openCheckout) {
    return res.status(400).json({ error: 'Kit already has an open checkout' });
  }

  // Validate destination site exists and is active
  const site = await prisma.site.findUnique({ where: { id: destinationSiteId } });
  if (!site || !site.isActive) {
    return res.status(400).json({ error: 'Destination site not found or inactive' });
  }

  const user = req.user as User;

  const checkout = await prisma.checkout.create({
    data: {
      kitId,
      userId: user.id,
      destinationSiteId,
    },
    include: {
      kit: { select: { id: true, name: true } },
      user: { select: { id: true, displayName: true } },
      destinationSite: { select: { id: true, name: true } },
    },
  });

  await writeAuditLog({
    userId: user.id,
    objectType: 'Checkout',
    objectId: checkout.id,
    field: 'checkedOutAt',
    oldValue: null,
    newValue: checkout.checkedOutAt.toISOString(),
  });

  res.status(201).json(checkout);
});

// Check in a kit
checkoutsRouter.patch('/checkouts/:id/checkin', requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const { returnSiteId } = req.body;

  if (!returnSiteId || typeof returnSiteId !== 'number') {
    return res.status(400).json({ error: 'returnSiteId is required and must be a number' });
  }

  // Validate checkout exists and is open
  const checkout = await prisma.checkout.findUnique({ where: { id } });
  if (!checkout) {
    return res.status(404).json({ error: 'Checkout not found' });
  }
  if (checkout.checkedInAt !== null) {
    return res.status(400).json({ error: 'Checkout is already checked in' });
  }

  // Validate return site exists
  const site = await prisma.site.findUnique({ where: { id: returnSiteId } });
  if (!site) {
    return res.status(404).json({ error: 'Return site not found' });
  }

  const now = new Date();
  const updated = await prisma.checkout.update({
    where: { id },
    data: {
      returnSiteId,
      checkedInAt: now,
    },
    include: {
      kit: { select: { id: true, name: true } },
      user: { select: { id: true, displayName: true } },
      destinationSite: { select: { id: true, name: true } },
      returnSite: { select: { id: true, name: true } },
    },
  });

  const user = req.user as User;
  await writeAuditLog({
    userId: user.id,
    objectType: 'Checkout',
    objectId: id,
    field: 'checkedInAt',
    oldValue: null,
    newValue: now.toISOString(),
  });

  res.json(updated);
});

// List checkouts
checkoutsRouter.get('/checkouts', requireAuth, async (req: Request, res: Response) => {
  const status = (req.query.status as string) || 'open';

  const where: any = {};
  if (status === 'open') {
    where.checkedInAt = null;
  } else if (status === 'closed') {
    where.checkedInAt = { not: null };
  }
  // status === 'all' → no filter

  const checkouts = await prisma.checkout.findMany({
    where,
    include: {
      kit: { select: { id: true, name: true, qrCode: true } },
      user: { select: { id: true, displayName: true } },
      destinationSite: { select: { id: true, name: true } },
      returnSite: { select: { id: true, name: true } },
    },
    orderBy: { checkedOutAt: 'desc' },
  });

  res.json(checkouts);
});

// Checkout history for a specific kit
checkoutsRouter.get('/checkouts/history/:kitId', requireAuth, async (req: Request, res: Response) => {
  const kitId = parseInt(req.params.kitId as string, 10);

  const kit = await prisma.kit.findUnique({ where: { id: kitId } });
  if (!kit) {
    return res.status(404).json({ error: 'Kit not found' });
  }

  const checkouts = await prisma.checkout.findMany({
    where: { kitId },
    include: {
      user: { select: { id: true, displayName: true } },
      destinationSite: { select: { id: true, name: true } },
      returnSite: { select: { id: true, name: true } },
    },
    orderBy: { checkedOutAt: 'desc' },
  });

  res.json(checkouts);
});
