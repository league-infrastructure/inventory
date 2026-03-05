import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { NotFoundError } from './errors';

export interface QrInfo {
  type: string;
  id: number;
  name: string;
  qrDataUrl: string;
  [key: string]: any;
}

export class QrService {
  private baseUrl: string;

  constructor(private prisma: PrismaClient, baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.APP_BASE_URL ?? 'http://localhost:5173';
  }

  async generateDataUrl(path: string): Promise<string> {
    const url = `${this.baseUrl}${path}`;
    return QRCode.toDataURL(url, { width: 256, margin: 1 });
  }

  async getKitQrInfo(id: number): Promise<QrInfo> {
    const kit = await this.prisma.kit.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    });
    if (!kit) throw new NotFoundError('Not found');
    const qrDataUrl = await this.generateDataUrl(`/k/${id}`);
    return { type: 'Kit', ...kit, qrDataUrl };
  }

  async getComputerQrInfo(id: number): Promise<QrInfo> {
    const computer = await this.prisma.computer.findUnique({
      where: { id },
      select: { id: true, model: true, disposition: true },
    });
    if (!computer) throw new NotFoundError('Not found');
    const qrDataUrl = await this.generateDataUrl(`/c/${id}`);
    return { type: 'Computer', ...computer, name: computer.model || `Computer #${id}`, qrDataUrl };
  }

  async getPackQrInfo(id: number): Promise<QrInfo> {
    const pack = await this.prisma.pack.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!pack) throw new NotFoundError('Not found');
    const qrDataUrl = await this.generateDataUrl(`/p/${id}`);
    return { type: 'Pack', ...pack, qrDataUrl };
  }
}
