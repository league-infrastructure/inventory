import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { generateQrDataUrl } from '../services/qrCode';

export const qrRouter = Router();

// Public: get minimal Kit info for QR landing page (no auth required)
qrRouter.get('/qr/k/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const kit = await prisma.kit.findUnique({
    where: { id },
    select: { id: true, name: true, status: true },
  });
  if (!kit) {
    return res.status(404).json({ error: 'Not found' });
  }
  const qrDataUrl = await generateQrDataUrl(`/k/${id}`);
  res.json({ type: 'Kit', ...kit, qrDataUrl });
});

// Public: get minimal Pack info for QR landing page (no auth required)
qrRouter.get('/qr/p/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const pack = await prisma.pack.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!pack) {
    return res.status(404).json({ error: 'Not found' });
  }
  const qrDataUrl = await generateQrDataUrl(`/p/${id}`);
  res.json({ type: 'Pack', ...pack, qrDataUrl });
});
