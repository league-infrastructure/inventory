import { prisma } from './prisma';
import { generateQrDataUrl } from './qrCode';
import { NotFoundError } from './errors';

export async function getKitQrInfo(id: number) {
  const kit = await prisma.kit.findUnique({
    where: { id },
    select: { id: true, name: true, status: true },
  });
  if (!kit) throw new NotFoundError('Not found');
  const qrDataUrl = await generateQrDataUrl(`/k/${id}`);
  return { type: 'Kit' as const, ...kit, qrDataUrl };
}

export async function getComputerQrInfo(id: number) {
  const computer = await prisma.computer.findUnique({
    where: { id },
    select: { id: true, model: true, disposition: true },
  });
  if (!computer) throw new NotFoundError('Not found');
  const qrDataUrl = await generateQrDataUrl(`/c/${id}`);
  return { type: 'Computer' as const, ...computer, name: computer.model || `Computer #${id}`, qrDataUrl };
}

export async function getPackQrInfo(id: number) {
  const pack = await prisma.pack.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!pack) throw new NotFoundError('Not found');
  const qrDataUrl = await generateQrDataUrl(`/p/${id}`);
  return { type: 'Pack' as const, ...pack, qrDataUrl };
}
