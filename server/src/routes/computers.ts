import { Router, Request, Response } from 'express';
import { User, ComputerDisposition } from '@prisma/client';
import { prisma } from '../services/prisma';
import { generateQrDataUrl } from '../services/qrCode';
import { writeAuditLog, diffForAudit } from '../services/auditLog';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';

export const computersRouter = Router();

const COMPUTER_FIELDS = [
  'serialNumber',
  'serviceTag',
  'model',
  'defaultUsername',
  'defaultPassword',
  'disposition',
  'dateReceived',
  'lastInventoried',
  'notes',
  'siteId',
  'kitId',
  'qrCode',
];

const COMPUTER_INCLUDES = {
  hostName: true,
  site: { select: { id: true, name: true } },
  kit: { select: { id: true, name: true } },
};

// List all Computers (any authenticated user)
computersRouter.get('/computers', requireAuth, async (req: Request, res: Response) => {
  const where: any = {};

  const dispositionFilter = req.query.disposition as string | undefined;
  if (dispositionFilter && Object.values(ComputerDisposition).includes(dispositionFilter as ComputerDisposition)) {
    where.disposition = dispositionFilter;
  }

  const siteIdFilter = req.query.siteId as string | undefined;
  if (siteIdFilter) {
    const parsed = parseInt(siteIdFilter, 10);
    if (!isNaN(parsed)) {
      where.siteId = parsed;
    }
  }

  const kitIdFilter = req.query.kitId as string | undefined;
  if (kitIdFilter) {
    const parsed = parseInt(kitIdFilter, 10);
    if (!isNaN(parsed)) {
      where.kitId = parsed;
    }
  }

  if (req.query.unassigned === 'true') {
    where.siteId = null;
    where.kitId = null;
  }

  const computers = await prisma.computer.findMany({
    where,
    include: COMPUTER_INCLUDES,
    orderBy: { id: 'asc' },
  });
  res.json(computers);
});

// Get Computer detail (any authenticated user)
computersRouter.get('/computers/:id', requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const computer = await prisma.computer.findUnique({
    where: { id },
    include: COMPUTER_INCLUDES,
  });
  if (!computer) {
    return res.status(404).json({ error: 'Computer not found' });
  }
  res.json(computer);
});

// Create a Computer (Quartermaster only)
computersRouter.post('/computers', requireQuartermaster, async (req: Request, res: Response) => {
  const {
    serialNumber,
    serviceTag,
    model,
    defaultUsername,
    defaultPassword,
    disposition,
    dateReceived,
    lastInventoried,
    notes,
    siteId,
    kitId,
    hostNameId,
  } = req.body;

  // Validate disposition if provided
  if (disposition && !Object.values(ComputerDisposition).includes(disposition as ComputerDisposition)) {
    return res.status(400).json({ error: 'Invalid disposition value' });
  }

  // Validate siteId FK if provided
  if (siteId != null) {
    if (typeof siteId !== 'number') {
      return res.status(400).json({ error: 'siteId must be a number' });
    }
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      return res.status(400).json({ error: 'Site not found' });
    }
  }

  // Validate kitId FK if provided
  if (kitId != null) {
    if (typeof kitId !== 'number') {
      return res.status(400).json({ error: 'kitId must be a number' });
    }
    const kit = await prisma.kit.findUnique({ where: { id: kitId } });
    if (!kit) {
      return res.status(400).json({ error: 'Kit not found' });
    }
  }

  const computer = await prisma.computer.create({
    data: {
      serialNumber: serialNumber || null,
      serviceTag: serviceTag || null,
      model: model || null,
      defaultUsername: defaultUsername || null,
      defaultPassword: defaultPassword || null,
      ...(disposition && { disposition: disposition as ComputerDisposition }),
      dateReceived: dateReceived ? new Date(dateReceived) : null,
      lastInventoried: lastInventoried ? new Date(lastInventoried) : null,
      notes: notes || null,
      siteId: siteId || null,
      kitId: kitId || null,
    },
  });

  // Generate and store QR code path
  const qrPath = `/c/${computer.id}`;
  const updated = await prisma.computer.update({
    where: { id: computer.id },
    data: { qrCode: qrPath },
    include: COMPUTER_INCLUDES,
  });

  // If hostNameId provided, assign the HostName to this computer
  if (hostNameId != null && typeof hostNameId === 'number') {
    const hostName = await prisma.hostName.findUnique({ where: { id: hostNameId } });
    if (hostName) {
      await prisma.hostName.update({
        where: { id: hostNameId },
        data: { computerId: computer.id },
      });
    }
  }

  const user = req.user as User;
  await writeAuditLog(
    COMPUTER_FIELDS.map((field) => ({
      userId: user.id,
      objectType: 'Computer',
      objectId: computer.id,
      field,
      oldValue: null,
      newValue: (updated as any)[field] != null ? String((updated as any)[field]) : null,
    })).filter((e) => e.newValue != null),
  );

  // Re-fetch to include the hostName relation after assignment
  const result = await prisma.computer.findUnique({
    where: { id: computer.id },
    include: COMPUTER_INCLUDES,
  });

  res.status(201).json(result);
});

// Update a Computer (Quartermaster only)
computersRouter.put('/computers/:id', requireQuartermaster, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.computer.findUnique({
    where: { id },
    include: { hostName: true },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Computer not found' });
  }

  const {
    serialNumber,
    serviceTag,
    model,
    defaultUsername,
    defaultPassword,
    disposition,
    dateReceived,
    lastInventoried,
    notes,
    siteId,
    kitId,
    hostNameId,
  } = req.body;

  // Validate disposition if provided
  if (disposition && !Object.values(ComputerDisposition).includes(disposition as ComputerDisposition)) {
    return res.status(400).json({ error: 'Invalid disposition value' });
  }

  // Validate siteId FK if provided
  if (siteId != null) {
    if (typeof siteId !== 'number') {
      return res.status(400).json({ error: 'siteId must be a number' });
    }
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      return res.status(400).json({ error: 'Site not found' });
    }
  }

  // Validate kitId FK if provided
  if (kitId != null) {
    if (typeof kitId !== 'number') {
      return res.status(400).json({ error: 'kitId must be a number' });
    }
    const kit = await prisma.kit.findUnique({ where: { id: kitId } });
    if (!kit) {
      return res.status(400).json({ error: 'Kit not found' });
    }
  }

  const data: any = {};
  if (serialNumber !== undefined) data.serialNumber = serialNumber || null;
  if (serviceTag !== undefined) data.serviceTag = serviceTag || null;
  if (model !== undefined) data.model = model || null;
  if (defaultUsername !== undefined) data.defaultUsername = defaultUsername || null;
  if (defaultPassword !== undefined) data.defaultPassword = defaultPassword || null;
  if (disposition !== undefined) data.disposition = disposition as ComputerDisposition;
  if (dateReceived !== undefined) data.dateReceived = dateReceived ? new Date(dateReceived) : null;
  if (lastInventoried !== undefined) data.lastInventoried = lastInventoried ? new Date(lastInventoried) : null;
  if (notes !== undefined) data.notes = notes || null;
  if (siteId !== undefined) data.siteId = siteId;
  if (kitId !== undefined) data.kitId = kitId;

  const updated = await prisma.computer.update({
    where: { id },
    data,
    include: COMPUTER_INCLUDES,
  });

  const user = req.user as User;
  const auditEntries = diffForAudit(user.id, 'Computer', id, existing, updated, COMPUTER_FIELDS);

  // Handle hostName assignment changes
  if (hostNameId !== undefined) {
    const oldHostNameId = existing.hostName?.id ?? null;

    if (hostNameId === null) {
      // Unassign current host name
      if (existing.hostName) {
        await prisma.hostName.update({
          where: { id: existing.hostName.id },
          data: { computerId: null },
        });
      }
    } else if (typeof hostNameId === 'number') {
      // Unassign old host name if any
      if (existing.hostName && existing.hostName.id !== hostNameId) {
        await prisma.hostName.update({
          where: { id: existing.hostName.id },
          data: { computerId: null },
        });
      }
      // Assign new host name
      await prisma.hostName.update({
        where: { id: hostNameId },
        data: { computerId: id },
      });
    }

    // Add manual audit entry for hostName change
    if (oldHostNameId !== hostNameId) {
      auditEntries.push({
        userId: user.id,
        objectType: 'Computer',
        objectId: id,
        field: 'hostName',
        oldValue: oldHostNameId != null ? String(oldHostNameId) : null,
        newValue: hostNameId != null ? String(hostNameId) : null,
      });
    }
  }

  if (auditEntries.length > 0) {
    await writeAuditLog(auditEntries);
  }

  // Re-fetch to include updated hostName relation
  const result = await prisma.computer.findUnique({
    where: { id },
    include: COMPUTER_INCLUDES,
  });

  res.json(result);
});

// Update Computer disposition (Quartermaster only)
computersRouter.patch('/computers/:id/disposition', requireQuartermaster, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.computer.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Computer not found' });
  }

  const { disposition } = req.body;
  if (!disposition || !Object.values(ComputerDisposition).includes(disposition as ComputerDisposition)) {
    return res.status(400).json({ error: 'Invalid disposition value' });
  }

  const updated = await prisma.computer.update({
    where: { id },
    data: { disposition: disposition as ComputerDisposition },
    include: COMPUTER_INCLUDES,
  });

  const user = req.user as User;
  await writeAuditLog({
    userId: user.id,
    objectType: 'Computer',
    objectId: id,
    field: 'disposition',
    oldValue: existing.disposition,
    newValue: disposition,
  });

  res.json(updated);
});
