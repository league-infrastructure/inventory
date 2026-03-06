import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { PrismaClient } from '@prisma/client';
import { NotFoundError } from './errors';

// Dymo large shipping label: 59mm x 102mm
const LABEL_WIDTH_PT = 59 * 2.83465; // ~167pt
const LABEL_HEIGHT_PT = 102 * 2.83465; // ~289pt
const MARGIN = 10;

const ORG_NAME = 'League of Amazing Programmers';
const CONTACT_URL = 'leagueofamazingprogrammers.com';
const PHONE = '(619) 432-2424';

export class LabelService {
  private baseUrl: string;

  constructor(private prisma: PrismaClient, baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.QR_DOMAIN ?? process.env.APP_BASE_URL ?? 'http://localhost:5173';
  }

  private async generateQrBuffer(path: string): Promise<Buffer> {
    const url = `${this.baseUrl}${path}`;
    return QRCode.toBuffer(url, { width: 120, margin: 1, type: 'png' });
  }

  private createDoc(): typeof PDFDocument.prototype {
    return new PDFDocument({
      size: [LABEL_WIDTH_PT, LABEL_HEIGHT_PT],
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    });
  }

  private addLabelContent(
    doc: any,
    qrBuffer: Buffer,
    title: string,
    subtitle: string,
    details: string[],
  ): void {
    const usableWidth = LABEL_WIDTH_PT - 2 * MARGIN;

    // Organization name
    doc.fontSize(7).font('Helvetica-Bold').text(ORG_NAME, MARGIN, MARGIN, {
      width: usableWidth,
      align: 'center',
    });

    // QR code centered
    const qrSize = 90;
    const qrX = (LABEL_WIDTH_PT - qrSize) / 2;
    doc.image(qrBuffer, qrX, doc.y + 4, { width: qrSize, height: qrSize });

    doc.y = doc.y + qrSize + 8;

    // Title
    doc.fontSize(10).font('Helvetica-Bold').text(title, MARGIN, doc.y, {
      width: usableWidth,
      align: 'center',
    });

    // Subtitle
    if (subtitle) {
      doc.fontSize(8).font('Helvetica').text(subtitle, MARGIN, doc.y + 2, {
        width: usableWidth,
        align: 'center',
      });
    }

    // Details
    doc.y += 4;
    for (const detail of details) {
      doc.fontSize(7).font('Helvetica').text(detail, MARGIN, doc.y + 1, {
        width: usableWidth,
        align: 'center',
      });
    }

    // Footer
    doc.fontSize(6).font('Helvetica').text(CONTACT_URL, MARGIN, LABEL_HEIGHT_PT - MARGIN - 16, {
      width: usableWidth,
      align: 'center',
    });
    doc.text(PHONE, MARGIN, doc.y, {
      width: usableWidth,
      align: 'center',
    });
  }

  async generateKitLabel(kitId: number): Promise<Buffer> {
    const kit = await this.prisma.kit.findUnique({
      where: { id: kitId },
      include: { site: { select: { name: true } } },
    });
    if (!kit) throw new NotFoundError('Kit not found');

    const qrBuffer = await this.generateQrBuffer(`/k/${kitId}`);
    const doc = this.createDoc();
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    this.addLabelContent(doc, qrBuffer,
      `Kit #${kit.number}`,
      kit.name,
      [kit.site.name],
    );

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async generatePackLabel(packId: number): Promise<Buffer> {
    const pack = await this.prisma.pack.findUnique({
      where: { id: packId },
      include: {
        kit: { select: { number: true, name: true } },
      },
    });
    if (!pack) throw new NotFoundError('Pack not found');

    const qrBuffer = await this.generateQrBuffer(`/p/${packId}`);
    const doc = this.createDoc();
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    this.addLabelContent(doc, qrBuffer,
      pack.name,
      `Kit #${pack.kit.number} — ${pack.kit.name}`,
      pack.description ? [pack.description] : [],
    );

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async generateComputerLabel(computerId: number): Promise<Buffer> {
    const computer = await this.prisma.computer.findUnique({
      where: { id: computerId },
      include: {
        hostName: { select: { name: true } },
      },
    });
    if (!computer) throw new NotFoundError('Computer not found');

    const qrBuffer = await this.generateQrBuffer(`/c/${computerId}`);
    const doc = this.createDoc();
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    const details: string[] = [];
    if (computer.serialNumber) details.push(`S/N: ${computer.serialNumber}`);
    if (computer.defaultUsername) details.push(`User: ${computer.defaultUsername}`);
    if (computer.defaultPassword) details.push(`Pass: ${computer.defaultPassword}`);

    this.addLabelContent(doc, qrBuffer,
      computer.hostName?.name || computer.model || `Computer #${computerId}`,
      computer.model || '',
      details,
    );

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async generateBatchLabels(kitId: number, packIds: number[]): Promise<Buffer> {
    const kit = await this.prisma.kit.findUnique({
      where: { id: kitId },
      include: {
        site: { select: { name: true } },
        packs: { select: { id: true, name: true, description: true } },
      },
    });
    if (!kit) throw new NotFoundError('Kit not found');

    const doc = this.createDoc();
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    // Kit label (first page)
    const kitQr = await this.generateQrBuffer(`/k/${kitId}`);
    this.addLabelContent(doc, kitQr,
      `Kit #${kit.number}`,
      kit.name,
      [kit.site.name],
    );

    // Pack labels
    const selectedPacks = packIds.length > 0
      ? kit.packs.filter((p) => packIds.includes(p.id))
      : kit.packs;

    for (const pack of selectedPacks) {
      doc.addPage({ size: [LABEL_WIDTH_PT, LABEL_HEIGHT_PT], margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
      const packQr = await this.generateQrBuffer(`/p/${pack.id}`);
      this.addLabelContent(doc, packQr,
        pack.name,
        `Kit #${kit.number} — ${kit.name}`,
        pack.description ? [pack.description] : [],
      );
    }

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }
}
