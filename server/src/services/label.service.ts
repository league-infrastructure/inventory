import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { NotFoundError } from './errors';

const FLAG_IMAGE_PATH = path.join(__dirname, '..', 'assets', 'flag.png');

// Dymo large shipping label: 59mm x 102mm — printed landscape
const LABEL_WIDTH_PT = 102 * 2.83465;  // ~289pt (long edge horizontal)
const LABEL_HEIGHT_PT = 59 * 2.83465;  // ~167pt (short edge vertical)
const MARGIN = 8;

// Compact computer label: 89mm x 28mm
const COMPACT_WIDTH_PT = 89 * 2.83465;   // ~252pt
const COMPACT_HEIGHT_PT = 28 * 2.83465;  // ~79pt
const COMPACT_MARGIN = 4;

const ORG_NAME = 'The League Of\nAmazing Programmers';
const CONTACT_LINE = 'jointheleague.org (858) 284-0481';

// Layout constants
const HEADER_HEIGHT = 48;
const LEFT_COL_WIDTH = 75;

// Flag logo as inline SVG for HTML labels — waving flag with lightning bolt
const FLAG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 55" fill="none">
  <path d="M12 5 C22 3, 32 12, 42 6 C52 0, 58 8, 65 5 L63 28 C56 31, 50 23, 40 29 C30 35, 20 26, 12 28 Z" fill="#444"/>
  <polygon points="36,10 40,17 37,17 41,25 34,17 37,17 33,10" fill="#fff"/>
  <line x1="12" y1="3" x2="5" y2="52" stroke="#333" stroke-width="3.5" stroke-linecap="round"/>
</svg>`;

export class LabelService {
  private baseUrl: string;

  constructor(private prisma: PrismaClient, baseUrl?: string) {
    const raw = baseUrl ?? process.env.QR_DOMAIN ?? process.env.APP_BASE_URL ?? 'http://localhost:5173';
    this.baseUrl = raw.replace(/\/+$/, '');
  }

  private buildUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  }

  async generateQrBuffer(path: string): Promise<Buffer> {
    return QRCode.toBuffer(this.buildUrl(path), { width: 120, margin: 1, type: 'png' });
  }

  private async generateQrDataUri(path: string): Promise<string> {
    return QRCode.toDataURL(this.buildUrl(path), { width: 120, margin: 1 });
  }

  private createDoc(): typeof PDFDocument.prototype {
    return new PDFDocument({
      size: [LABEL_HEIGHT_PT, LABEL_WIDTH_PT],
      layout: 'landscape',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    });
  }

  private drawFlagLogo(doc: any, x: number, y: number, scale: number = 0.6): void {
    doc.save();

    // Flag body — waving shape (drawn first so pole renders on top)
    doc.moveTo(x + 12 * scale, y + 5 * scale)
       .bezierCurveTo(
         x + 22 * scale, y + 3 * scale,
         x + 32 * scale, y + 12 * scale,
         x + 42 * scale, y + 6 * scale)
       .bezierCurveTo(
         x + 52 * scale, y,
         x + 58 * scale, y + 8 * scale,
         x + 65 * scale, y + 5 * scale)
       .lineTo(x + 63 * scale, y + 28 * scale)
       .bezierCurveTo(
         x + 56 * scale, y + 31 * scale,
         x + 50 * scale, y + 23 * scale,
         x + 40 * scale, y + 29 * scale)
       .bezierCurveTo(
         x + 30 * scale, y + 35 * scale,
         x + 20 * scale, y + 26 * scale,
         x + 12 * scale, y + 28 * scale)
       .closePath()
       .fill('#444');

    // Lightning bolt
    doc.moveTo(x + 36 * scale, y + 10 * scale)
       .lineTo(x + 40 * scale, y + 17 * scale)
       .lineTo(x + 37 * scale, y + 17 * scale)
       .lineTo(x + 41 * scale, y + 25 * scale)
       .lineTo(x + 34 * scale, y + 17 * scale)
       .lineTo(x + 37 * scale, y + 17 * scale)
       .lineTo(x + 33 * scale, y + 10 * scale)
       .closePath()
       .fill('#fff');

    // Flagpole — drawn last so it renders on top
    doc.lineWidth(2.5);
    doc.moveTo(x + 12 * scale, y + 3 * scale)
       .lineTo(x + 5 * scale, y + 52 * scale)
       .stroke('#333');

    doc.restore();
  }

  private addLabelContent(
    doc: any,
    qrBuffer: Buffer,
    number: string,
    name: string,
  ): void {
    const contentTop = MARGIN + HEADER_HEIGHT;
    const contentLeft = MARGIN + LEFT_COL_WIDTH;
    const rightColWidth = LABEL_WIDTH_PT - contentLeft - MARGIN;

    // === HEADER ROW ===
    // Flag logo
    this.drawFlagLogo(doc, MARGIN + 12, MARGIN + 2, 0.7);

    // Org name (right of logo)
    const textLeft = MARGIN + 40;
    doc.fontSize(11).font('Helvetica-Bold')
       .text('The League Of', textLeft, MARGIN + 4, {
         width: LABEL_WIDTH_PT - textLeft - MARGIN,
         align: 'center',
       });
    doc.fontSize(11).font('Helvetica-Bold')
       .text('Amazing Programmers', textLeft, doc.y, {
         width: LABEL_WIDTH_PT - textLeft - MARGIN,
         align: 'center',
       });

    // Contact line
    doc.fontSize(10.5).font('Helvetica')
       .text(CONTACT_LINE, textLeft, doc.y + 1, {
         width: LABEL_WIDTH_PT - textLeft - MARGIN,
         align: 'center',
       });

    // === CONTENT ROW — LEFT COLUMN (number + QR) ===
    // Large number
    const numberFontSize = number.length <= 2 ? 36 : number.length <= 4 ? 28 : 22;
    doc.fontSize(numberFontSize).font('Helvetica-Bold')
       .text(number, MARGIN, contentTop + 2, {
         width: LEFT_COL_WIDTH,
         align: 'center',
       });

    // QR code below number
    const qrSize = 55;
    const qrX = MARGIN + (LEFT_COL_WIDTH - qrSize) / 2;
    const qrY = contentTop + (number.length <= 2 ? 40 : 34);
    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

    // === CONTENT ROW — RIGHT COLUMN (name, auto-sized to fit) ===
    const contentHeight = LABEL_HEIGHT_PT - contentTop - MARGIN;
    const availWidth = rightColWidth - 33;
    const maxFontSize = 36;
    const minFontSize = 10;

    // Shrink font until text fits: each word must fit on one line,
    // and total wrapped height must fit in the available space
    let nameFontSize = maxFontSize;
    const words = name.split(/\s+/);
    doc.font('Helvetica-Bold');
    while (nameFontSize > minFontSize) {
      doc.fontSize(nameFontSize);
      // Check that no single word is wider than the column
      const longestWord = words.reduce((max, w) => {
        const ww = doc.widthOfString(w);
        return ww > max ? ww : max;
      }, 0);
      const h = doc.heightOfString(name, { width: availWidth });
      if (longestWord <= availWidth && h <= contentHeight) break;
      nameFontSize -= 1;
    }

    // Vertically center
    doc.fontSize(nameFontSize).font('Helvetica-Bold');
    const nameHeight = doc.heightOfString(name, { width: availWidth });
    const nameY = contentTop + (contentHeight - nameHeight) / 2;

    doc.text(name, contentLeft + 4, nameY, {
      width: availWidth,
      align: 'center',
    });
  }

  private async getPackSequence(packId: number, kitId: number): Promise<number> {
    const packs = await this.prisma.pack.findMany({
      where: { kitId },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const idx = packs.findIndex(p => p.id === packId);
    return idx + 1;
  }

  async generateKitLabel(kitId: number): Promise<Buffer> {
    const kit = await this.prisma.kit.findUnique({
      where: { id: kitId },
      include: { site: { select: { name: true } } },
    });
    if (!kit) throw new NotFoundError('Kit not found');

    const qrBuffer = await this.generateQrBuffer(`/qr/k/${kitId}`);
    const doc = this.createDoc();
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    this.addLabelContent(doc, qrBuffer, String(kit.number), kit.name);

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async generatePackLabel(packId: number): Promise<Buffer> {
    const pack = await this.prisma.pack.findUnique({
      where: { id: packId },
      include: {
        kit: { select: { id: true, number: true, name: true } },
      },
    });
    if (!pack) throw new NotFoundError('Pack not found');

    const seq = await this.getPackSequence(packId, pack.kit.id);
    const number = `${pack.kit.number}/${seq}`;

    const qrBuffer = await this.generateQrBuffer(`/qr/p/${packId}`);
    const doc = this.createDoc();
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    this.addLabelContent(doc, qrBuffer, number, pack.name);

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

    const qrBuffer = await this.generateQrBuffer(`/qr/c/${computerId}`);
    const doc = this.createDoc();
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    const title = computer.hostName?.name || computer.model || `Computer #${computerId}`;
    const number = computer.hostName?.name || String(computerId);

    this.addLabelContent(doc, qrBuffer, number, title);

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  private createCompactDoc(): typeof PDFDocument.prototype {
    return new PDFDocument({
      size: [COMPACT_WIDTH_PT, COMPACT_HEIGHT_PT],
      margins: { top: COMPACT_MARGIN, bottom: COMPACT_MARGIN, left: COMPACT_MARGIN, right: COMPACT_MARGIN },
    });
  }

  private drawTagIcon(doc: any, x: number, y: number, size: number = 6): void {
    // Small tag/label icon for kit number
    doc.save();
    const s = size;
    doc.moveTo(x, y + s * 0.15)
       .lineTo(x + s * 0.55, y)
       .lineTo(x + s, y + s * 0.45)
       .lineTo(x + s * 0.45, y + s)
       .closePath()
       .fill('#666');
    // Small circle (tag hole)
    doc.circle(x + s * 0.62, y + s * 0.2, s * 0.08).fill('#fff');
    doc.restore();
  }

  private addCompactLabelContent(
    doc: any,
    qrBuffer: Buffer,
    machineName: string,
    credentials: string | null,
    infoLine: string | null,
  ): void {
    const m = COMPACT_MARGIN;
    const contentHeight = COMPACT_HEIGHT_PT - m * 2;
    const qrFull = contentHeight; // original full-height QR
    const qrSize = qrFull * 0.80; // 20% smaller
    const qrX = m + (qrFull - qrSize); // shift right to keep right edge fixed
    const qrY = m + (qrFull - qrSize) / 2; // vertically center
    const rightLeft = m + qrFull + 6; // text column stays put
    const rightWidth = COMPACT_WIDTH_PT - rightLeft - m;

    // === LEFT: QR code (95% height, right-edge anchored) ===
    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

    // === RIGHT TOP: Header (flag image + org + contact) ===
    const flagSize = 16;
    try {
      doc.image(FLAG_IMAGE_PATH, rightLeft, m, { width: flagSize, height: flagSize });
    } catch {
      // Fallback: skip flag if image not found
    }
    const headerTextLeft = rightLeft + flagSize + 3;
    const headerTextWidth = rightWidth - flagSize - 3;
    doc.fontSize(7.5).font('Helvetica-Bold')
       .text('The League Of Amazing Programmers', headerTextLeft, m + 1, {
         width: headerTextWidth,
       });
    doc.fontSize(6).font('Helvetica')
       .text(CONTACT_LINE, headerTextLeft, doc.y, {
         width: headerTextWidth,
       });

    // === Machine name (large) ===
    const headerBottom = doc.y + 1;
    const machineNameSize = machineName.length <= 12 ? 22 : machineName.length <= 20 ? 17 : 14;
    doc.fontSize(machineNameSize).font('Helvetica-Bold')
       .text(machineName, rightLeft, headerBottom, {
         width: rightWidth,
       });

    // === Credentials + serial: tight below machine name ===
    if (credentials) {
      doc.fontSize(12).font('Helvetica')
         .text(credentials, rightLeft, doc.y, {
           width: rightWidth,
         });
    }
    if (infoLine) {
      doc.fontSize(6).font('Helvetica')
         .text(infoLine, rightLeft, doc.y, {
           width: rightWidth,
         });
    }
  }

  private buildInfoLine(kitNumber: number | null, osName: string | null, serialNumber: string | null): string | null {
    const parts: string[] = [];
    if (kitNumber != null) parts.push(`#${kitNumber}`);
    if (osName) parts.push(osName);
    if (serialNumber) parts.push(`SN: ${serialNumber}`);
    return parts.length > 0 ? parts.join('  ') : null;
  }

  async generateComputerLabel89x28(computerId: number): Promise<Buffer> {
    const computer = await this.prisma.computer.findUnique({
      where: { id: computerId },
      include: {
        hostName: { select: { name: true } },
        kit: { select: { number: true } },
        os: { select: { name: true } },
      },
    });
    if (!computer) throw new NotFoundError('Computer not found');

    const qrBuffer = await this.generateQrBuffer(`/qr/c/${computerId}`);
    const doc = this.createCompactDoc();
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    const machineName = computer.hostName?.name || computer.model || `#${computerId}`;
    const credentials = (computer.studentUsername || computer.studentPassword)
      ? `user: ${computer.studentUsername || '—'}  pass: ${computer.studentPassword || '—'}`
      : null;
    const infoLine = this.buildInfoLine(
      computer.kit?.number ?? null,
      computer.os?.name ?? null,
      computer.serialNumber,
    );

    this.addCompactLabelContent(doc, qrBuffer, machineName, credentials, infoLine);

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async generateComputerBatchLabels(computerIds: number[]): Promise<Buffer> {
    if (!computerIds.length) throw new Error('No computer IDs provided');

    const doc = this.createCompactDoc();
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    for (let i = 0; i < computerIds.length; i++) {
      const computerId = computerIds[i];
      const computer = await this.prisma.computer.findUnique({
        where: { id: computerId },
        include: {
          hostName: { select: { name: true } },
          kit: { select: { number: true } },
          os: { select: { name: true } },
        },
      });
      if (!computer) throw new NotFoundError(`Computer ${computerId} not found`);

      if (i > 0) {
        doc.addPage({
          size: [COMPACT_WIDTH_PT, COMPACT_HEIGHT_PT],
          margins: { top: COMPACT_MARGIN, bottom: COMPACT_MARGIN, left: COMPACT_MARGIN, right: COMPACT_MARGIN },
        });
      }

      const qrBuffer = await this.generateQrBuffer(`/qr/c/${computerId}`);
      const machineName = computer.hostName?.name || computer.model || `#${computerId}`;
      const credentials = (computer.studentUsername || computer.studentPassword)
        ? `user: ${computer.studentUsername || '—'}  pass: ${computer.studentPassword || '—'}`
        : null;
      const infoLine = this.buildInfoLine(
        computer.kit?.number ?? null,
        computer.os?.name ?? null,
        computer.serialNumber,
      );

      this.addCompactLabelContent(doc, qrBuffer, machineName, credentials, infoLine);
    }

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async generateBatchLabels(kitId: number, packIds: number[], includeKit = true): Promise<Buffer> {
    const kit = await this.prisma.kit.findUnique({
      where: { id: kitId },
      include: {
        site: { select: { name: true } },
        packs: { select: { id: true, name: true, description: true }, orderBy: { id: 'asc' } },
      },
    });
    if (!kit) throw new NotFoundError('Kit not found');

    const doc = this.createDoc();
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    let firstPage = true;

    if (includeKit) {
      const kitQr = await this.generateQrBuffer(`/qr/k/${kitId}`);
      this.addLabelContent(doc, kitQr, String(kit.number), kit.name);
      firstPage = false;
    }

    const selectedPacks = kit.packs.filter((p) => packIds.includes(p.id));

    for (let i = 0; i < selectedPacks.length; i++) {
      const pack = selectedPacks[i];
      if (!firstPage) {
        doc.addPage({ size: [LABEL_HEIGHT_PT, LABEL_WIDTH_PT], layout: 'landscape', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
      }
      firstPage = false;

      const allIdx = kit.packs.findIndex(p => p.id === pack.id);
      const seq = allIdx + 1;
      const packQr = await this.generateQrBuffer(`/qr/p/${pack.id}`);
      this.addLabelContent(doc, packQr, `${kit.number}/${seq}`, pack.name);
    }

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  // --- HTML label generation ---

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private renderLabelHtml(qrDataUri: string, number: string, name: string): string {
    return `
      <div class="label">
        <div class="header">
          <div class="logo" style="margin-left:3mm">${FLAG_SVG}</div>
          <div class="org-block">
            <div class="org-name">The League Of<br>Amazing Programmers</div>
            <div class="contact">${this.escapeHtml(CONTACT_LINE)}</div>
          </div>
        </div>
        <div class="content">
          <div class="left-col">
            <div class="number">${this.escapeHtml(number)}</div>
            <img class="qr" src="${qrDataUri}" />
          </div>
          <div class="right-col">
            <div class="name${name.length > 40 ? ' very-long' : name.length > 20 ? ' long' : ''}">${this.escapeHtml(name)}</div>
          </div>
        </div>
      </div>`;
  }

  async generateBatchHtml(kitId: number, packIds: number[], includeKit = true): Promise<string> {
    const kit = await this.prisma.kit.findUnique({
      where: { id: kitId },
      include: {
        site: { select: { name: true } },
        packs: { select: { id: true, name: true, description: true }, orderBy: { id: 'asc' } },
      },
    });
    if (!kit) throw new NotFoundError('Kit not found');

    const labels: string[] = [];

    if (includeKit) {
      const qr = await this.generateQrDataUri(`/qr/k/${kitId}`);
      labels.push(this.renderLabelHtml(qr, String(kit.number), kit.name));
    }

    const selectedPacks = kit.packs.filter((p) => packIds.includes(p.id));

    for (const pack of selectedPacks) {
      const allIdx = kit.packs.findIndex(p => p.id === pack.id);
      const seq = allIdx + 1;
      const qr = await this.generateQrDataUri(`/qr/p/${pack.id}`);
      labels.push(this.renderLabelHtml(qr, `${kit.number}/${seq}`, pack.name));
    }

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Labels — Kit #${kit.number}</title>
<style>
  @page {
    size: 102mm 59mm;
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: Helvetica, Arial, sans-serif; }
  .label {
    width: 102mm;
    height: 59mm;
    padding: 3mm;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    page-break-inside: avoid;
    overflow: hidden;
  }
  .label:last-child { page-break-after: auto; }
  .header {
    display: flex;
    align-items: center;
    gap: 2mm;
    padding-bottom: 1.5mm;
    border-bottom: 0.3mm solid #ccc;
    min-height: 14mm;
  }
  .logo svg {
    width: 12mm;
    height: 10mm;
  }
  .org-block { flex: 1; text-align: center; }
  .org-name { font-size: 10pt; font-weight: bold; line-height: 1.2; }
  .contact { font-size: 10pt; color: #444; margin-top: 0.5mm; }
  .content {
    flex: 1;
    display: flex;
    gap: 2mm;
    padding-top: 1.5mm;
  }
  .left-col {
    width: 22mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1mm;
  }
  .number {
    font-size: 24pt;
    font-weight: bold;
    line-height: 1;
  }
  .qr {
    width: 16mm;
    height: 16mm;
  }
  .right-col {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .name {
    font-size: 32pt;
    font-weight: bold;
    text-align: center;
    line-height: 1.1;
    word-break: break-word;
    overflow: hidden;
  }
  .name.long { font-size: 24pt; }
  .name.very-long { font-size: 18pt; }
  @media print {
    html, body { width: 102mm; height: 59mm; }
    body { padding: 0; margin: 0; }
  }
  @media screen {
    html, body { width: auto; }
    body { background: #eee; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px; }
    .label { background: white; border: 1px solid #ccc; border-radius: 4px; }
  }
</style>
</head>
<body>
${labels.join('\n')}
<script>
  // Auto-open print dialog after page renders so @page size is applied
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 200);
  });
</script>
</body>
</html>`;
  }
}
