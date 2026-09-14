import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { NotFoundError } from './errors';
import { getBaseUrl } from '../config/baseUrl';

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

// A single 102x59 (kit or pack) label page, already resolved to the values
// addLabelContent() needs — no further Prisma lookups happen while
// rendering.
interface KitPackPage {
  qrPath: string;
  number: string;
  name: string;
  description?: string | null;
}

// A single 89x28 (computer) label page, already resolved.
interface ComputerPageRecord {
  qrPath: string;
  machineName: string;
  credentials: string | null;
  infoLine: string | null;
}

/** Physical label stock a bundle is printed on. */
export type LabelStock = '102x59' | '89x28';

/**
 * Explicit-ID selection of kits, packs, and/or computers to generate
 * labels for. Packs are resolved individually (not through a single
 * kit's `packs` array), so packs from different kits can be requested
 * together in one call.
 */
export interface LabelSelection {
  kitIds?: number[];
  packIds?: number[];
  computerIds?: number[];
  /**
   * When true, every pack belonging to each kit in `kitIds` is added to
   * the selection, deduped against any pack already present in `packIds`.
   */
  includeKitPacks?: boolean;
}

/** One rendered PDF, plus a manifest of what it contains. */
export interface LabelBundle {
  stock: LabelStock;
  pdf: Buffer;
  labelCount: number;
  /** Human-readable caption for each label in the bundle, in render order. */
  contents: string[];
}

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
    const raw = baseUrl ?? getBaseUrl();
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
    description?: string | null,
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

    // === CONTENT ROW — RIGHT COLUMN (name + optional description, auto-sized to fit) ===
    const contentHeight = LABEL_HEIGHT_PT - contentTop - MARGIN;
    const availWidth = rightColWidth - 33;
    const maxFontSize = 36;
    const minFontSize = 10;
    const descFontSize = 8;
    const descText = description?.trim() || '';

    // Measure description height (fixed font size)
    let descHeight = 0;
    if (descText) {
      doc.fontSize(descFontSize).font('Helvetica');
      descHeight = doc.heightOfString(descText, { width: availWidth }) + 2;
    }

    // Shrink name font until name + description fits
    const spaceForName = contentHeight - descHeight;
    let nameFontSize = maxFontSize;
    const words = name.split(/\s+/);
    doc.font('Helvetica-Bold');
    while (nameFontSize > minFontSize) {
      doc.fontSize(nameFontSize);
      const longestWord = words.reduce((max, w) => {
        const ww = doc.widthOfString(w);
        return ww > max ? ww : max;
      }, 0);
      const h = doc.heightOfString(name, { width: availWidth });
      if (longestWord <= availWidth && h <= spaceForName) break;
      nameFontSize -= 1;
    }

    // Vertically center the name + description block
    doc.fontSize(nameFontSize).font('Helvetica-Bold');
    const nameHeight = doc.heightOfString(name, { width: availWidth });
    const totalHeight = nameHeight + descHeight;
    const blockY = contentTop + (contentHeight - totalHeight) / 2;

    doc.text(name, contentLeft + 4, blockY, {
      width: availWidth,
      align: 'center',
    });

    if (descText) {
      doc.fontSize(descFontSize).font('Helvetica')
         .text(descText, contentLeft + 4, doc.y + 2, {
           width: availWidth,
           align: 'center',
         });
    }
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

    this.addLabelContent(doc, qrBuffer, String(kit.number), kit.name, kit.description);

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

    const number = `${pack.kit.number}/${pack.displayNumber}`;

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

  /**
   * Render one 89x28 compact label per resolved computer record, in the
   * order given. Page 1 is drawn on the document created by
   * createCompactDoc(); every subsequent record gets an explicit addPage()
   * first — this mirrors the original inline loop in
   * generateComputerBatchLabels exactly.
   */
  private async buildComputerBundle(records: ComputerPageRecord[]): Promise<Buffer> {
    const doc = this.createCompactDoc();
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (i > 0) {
        doc.addPage({
          size: [COMPACT_WIDTH_PT, COMPACT_HEIGHT_PT],
          margins: { top: COMPACT_MARGIN, bottom: COMPACT_MARGIN, left: COMPACT_MARGIN, right: COMPACT_MARGIN },
        });
      }

      const qrBuffer = await this.generateQrBuffer(record.qrPath);
      this.addCompactLabelContent(doc, qrBuffer, record.machineName, record.credentials, record.infoLine);
    }

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async generateComputerBatchLabels(computerIds: number[]): Promise<Buffer> {
    if (!computerIds.length) throw new Error('No computer IDs provided');

    const records: ComputerPageRecord[] = [];
    for (const computerId of computerIds) {
      const computer = await this.prisma.computer.findUnique({
        where: { id: computerId },
        include: {
          hostName: { select: { name: true } },
          kit: { select: { number: true } },
          os: { select: { name: true } },
        },
      });
      if (!computer) throw new NotFoundError(`Computer ${computerId} not found`);

      const machineName = computer.hostName?.name || computer.model || `#${computerId}`;
      const credentials = (computer.studentUsername || computer.studentPassword)
        ? `user: ${computer.studentUsername || '—'}  pass: ${computer.studentPassword || '—'}`
        : null;
      const infoLine = this.buildInfoLine(
        computer.kit?.number ?? null,
        computer.os?.name ?? null,
        computer.serialNumber,
      );

      records.push({ qrPath: `/qr/c/${computerId}`, machineName, credentials, infoLine });
    }

    return this.buildComputerBundle(records);
  }

  /**
   * Render one 102x59 label per resolved kit/pack page, in the order
   * given. Page 1 is drawn on the document created by createDoc(); every
   * subsequent page gets an explicit addPage() first — this mirrors the
   * original inline loop in generateBatchLabels exactly.
   */
  private async buildKitPackBundle(pages: KitPackPage[]): Promise<Buffer> {
    const doc = this.createDoc();
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (i > 0) {
        doc.addPage({ size: [LABEL_HEIGHT_PT, LABEL_WIDTH_PT], layout: 'landscape', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
      }

      const qrBuffer = await this.generateQrBuffer(page.qrPath);
      this.addLabelContent(doc, qrBuffer, page.number, page.name, page.description);
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
        packs: { select: { id: true, name: true, description: true, displayNumber: true }, orderBy: { displayNumber: 'asc' } },
      },
    });
    if (!kit) throw new NotFoundError('Kit not found');

    const pages: KitPackPage[] = [];

    if (includeKit) {
      pages.push({ qrPath: `/qr/k/${kitId}`, number: String(kit.number), name: kit.name, description: kit.description });
    }

    const selectedPacks = kit.packs.filter((p) => packIds.includes(p.id));
    for (const pack of selectedPacks) {
      pages.push({ qrPath: `/qr/p/${pack.id}`, number: `${kit.number}/${pack.displayNumber}`, name: pack.name });
    }

    return this.buildKitPackBundle(pages);
  }

  /**
   * Generate label PDFs for an arbitrary, explicit-ID selection of kits,
   * packs, and/or computers, grouped by physical label stock size.
   *
   * Unlike generateBatchLabels(), packs are resolved individually
   * (prisma.pack.findUnique per ID, joined to their own kit for the
   * caption) rather than filtered against one kit's `packs` array — this
   * is what allows packs from different kits to be requested together.
   *
   * Returns one bundle per stock size actually present in the selection
   * (never both if only one is requested, never a bundle with zero
   * labels). Kit/pack labels always render at 102x59; computer labels
   * always render at 89x28 — a selection is never combined into one
   * mixed-page-size PDF.
   */
  async generateLabelSet(selection: LabelSelection): Promise<LabelBundle[]> {
    const kitIds = selection.kitIds ?? [];
    const packIds = selection.packIds ?? [];
    const computerIds = selection.computerIds ?? [];
    const includeKitPacks = selection.includeKitPacks ?? false;

    // --- Resolve kits (always with their packs, so includeKitPacks can
    // expand without a second round-trip) ---
    const kits = await Promise.all(kitIds.map(async (id) => {
      const kit = await this.prisma.kit.findUnique({
        where: { id },
        include: {
          packs: { select: { id: true, name: true, description: true, displayNumber: true }, orderBy: { displayNumber: 'asc' } },
        },
      });
      if (!kit) throw new NotFoundError(`Kit ${id} not found`);
      return kit;
    }));

    // --- Resolve explicitly-listed packs individually, joined to their
    // own kit — this is the one change that unblocks cross-kit selection.
    const explicitPacks = await Promise.all(packIds.map(async (id) => {
      const pack = await this.prisma.pack.findUnique({
        where: { id },
        include: { kit: { select: { number: true } } },
      });
      if (!pack) throw new NotFoundError(`Pack ${id} not found`);
      return pack;
    }));

    // --- Resolve computers ---
    const computers = await Promise.all(computerIds.map(async (id) => {
      const computer = await this.prisma.computer.findUnique({
        where: { id },
        include: {
          hostName: { select: { name: true } },
          kit: { select: { number: true } },
          os: { select: { name: true } },
        },
      });
      if (!computer) throw new NotFoundError(`Computer ${id} not found`);
      return computer;
    }));

    // --- Dedup packs: explicit packIds win identity; includeKitPacks
    // only adds packs not already present. ---
    interface ResolvedPack {
      id: number;
      name: string;
      description: string | null;
      displayNumber: number;
      kitNumber: number;
    }
    const packById = new Map<number, ResolvedPack>();
    for (const pack of explicitPacks) {
      packById.set(pack.id, {
        id: pack.id,
        name: pack.name,
        description: pack.description,
        displayNumber: pack.displayNumber,
        kitNumber: pack.kit.number,
      });
    }
    if (includeKitPacks) {
      for (const kit of kits) {
        for (const pack of kit.packs) {
          if (!packById.has(pack.id)) {
            packById.set(pack.id, {
              id: pack.id,
              name: pack.name,
              description: pack.description,
              displayNumber: pack.displayNumber,
              kitNumber: kit.number,
            });
          }
        }
      }
    }

    const bundles: LabelBundle[] = [];

    // --- 102x59 bundle: kits (by number) then packs (by kit number, then
    // displayNumber) ---
    const sortedKits = [...kits].sort((a, b) => a.number - b.number);
    const sortedPacks = [...packById.values()].sort(
      (a, b) => a.kitNumber - b.kitNumber || a.displayNumber - b.displayNumber,
    );

    if (sortedKits.length > 0 || sortedPacks.length > 0) {
      const pages: KitPackPage[] = [];
      const contents: string[] = [];

      for (const kit of sortedKits) {
        pages.push({ qrPath: `/qr/k/${kit.id}`, number: String(kit.number), name: kit.name, description: kit.description });
        contents.push(`Kit ${kit.number}: ${kit.name}`);
      }
      for (const pack of sortedPacks) {
        pages.push({ qrPath: `/qr/p/${pack.id}`, number: `${pack.kitNumber}/${pack.displayNumber}`, name: pack.name });
        contents.push(`Pack ${pack.kitNumber}/${pack.displayNumber}: ${pack.name}`);
      }

      const pdf = await this.buildKitPackBundle(pages);
      bundles.push({ stock: '102x59', pdf, labelCount: pages.length, contents });
    }

    // --- 89x28 bundle: computers, by host name ---
    const sortedComputers = [...computers].sort((a, b) => {
      const nameA = a.hostName?.name ?? '';
      const nameB = b.hostName?.name ?? '';
      return nameA.localeCompare(nameB);
    });

    if (sortedComputers.length > 0) {
      const records: ComputerPageRecord[] = [];
      const contents: string[] = [];

      for (const computer of sortedComputers) {
        const machineName = computer.hostName?.name || computer.model || `#${computer.id}`;
        const credentials = (computer.studentUsername || computer.studentPassword)
          ? `user: ${computer.studentUsername || '—'}  pass: ${computer.studentPassword || '—'}`
          : null;
        const infoLine = this.buildInfoLine(
          computer.kit?.number ?? null,
          computer.os?.name ?? null,
          computer.serialNumber,
        );

        records.push({ qrPath: `/qr/c/${computer.id}`, machineName, credentials, infoLine });
        contents.push(machineName);
      }

      const pdf = await this.buildComputerBundle(records);
      bundles.push({ stock: '89x28', pdf, labelCount: records.length, contents });
    }

    return bundles;
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
        packs: { select: { id: true, name: true, description: true, displayNumber: true }, orderBy: { displayNumber: 'asc' } },
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
      const seq = pack.displayNumber;
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
