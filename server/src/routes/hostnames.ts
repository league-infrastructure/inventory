import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { requireAuth, requireQuartermaster } from '../middleware/requireAuth';

export const hostnamesRouter = Router();

// List all host names (any authenticated user)
hostnamesRouter.get('/hostnames', requireAuth, async (_req: Request, res: Response) => {
  const hostnames = await prisma.hostName.findMany({
    orderBy: { name: 'asc' },
    include: {
      computer: {
        select: { id: true, model: true, serialNumber: true },
      },
    },
  });
  res.json(hostnames);
});

// Create a host name (Quartermaster only)
hostnamesRouter.post('/hostnames', requireQuartermaster, async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const trimmedName = name.trim();

  const existing = await prisma.hostName.findFirst({
    where: { name: trimmedName },
  });
  if (existing) {
    return res.status(409).json({ error: 'Host name already exists' });
  }

  const hostname = await prisma.hostName.create({
    data: { name: trimmedName },
  });

  res.status(201).json(hostname);
});

// Delete a host name (Quartermaster only)
hostnamesRouter.delete('/hostnames/:id', requireQuartermaster, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  const hostname = await prisma.hostName.findUnique({ where: { id } });
  if (!hostname) {
    return res.status(404).json({ error: 'Host name not found' });
  }

  if (hostname.computerId !== null) {
    return res.status(400).json({ error: 'Cannot delete host name that is assigned to a computer' });
  }

  await prisma.hostName.delete({ where: { id } });

  res.json({ success: true });
});
