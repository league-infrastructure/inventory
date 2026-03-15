import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

export interface JsonExportData {
  version: number;
  exportedAt: string;
  sites: any[];
  kits: any[];
  packs: any[];
  items: any[];
  computers: any[];
  hostNames: any[];
}

export class ExportService {
  constructor(private prisma: PrismaClient) {}

  async exportToJson(): Promise<JsonExportData> {
    const [sites, kits, packs, items, computers, hostNames] = await Promise.all([
      this.prisma.site.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.kit.findMany({
        include: { site: { select: { name: true } }, custodian: { select: { displayName: true } } },
        orderBy: { number: 'asc' },
      }),
      this.prisma.pack.findMany({
        include: { kit: { select: { number: true, name: true } } },
        orderBy: { id: 'asc' },
      }),
      this.prisma.item.findMany({
        include: { pack: { select: { name: true, kit: { select: { number: true } } } } },
        orderBy: { id: 'asc' },
      }),
      this.prisma.computer.findMany({
        include: {
          site: { select: { name: true } },
          kit: { select: { number: true, name: true } },
          hostName: { select: { name: true } },
          custodian: { select: { displayName: true } },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.hostName.findMany({ orderBy: { name: 'asc' } }),
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      sites: sites.map((s) => ({
        id: s.id, name: s.name, address: s.address,
        latitude: s.latitude, longitude: s.longitude,
        isHomeSite: s.isHomeSite, isActive: s.isActive,
      })),
      kits: kits.map((k) => ({
        id: k.id, number: k.number, name: k.name,
        containerType: k.containerType, description: k.description,
        status: k.status, siteName: k.site?.name ?? null,
        custodianName: k.custodian?.displayName ?? null,
        qrCode: k.qrCode,
      })),
      packs: packs.map((p) => ({
        id: p.id, name: p.name, description: p.description,
        kitNumber: p.kit.number, kitName: p.kit.name,
        qrCode: p.qrCode,
      })),
      items: items.map((i) => ({
        id: i.id, name: i.name, type: i.type,
        expectedQuantity: i.expectedQuantity,
        packName: i.pack.name, kitNumber: i.pack.kit.number,
      })),
      computers: computers.map((c) => ({
        id: c.id, hostName: c.hostName?.name ?? null,
        model: c.model, serialNumber: c.serialNumber,
        serviceTag: c.serviceTag, disposition: c.disposition,
        siteName: c.site?.name ?? null,
        kitNumber: c.kit?.number ?? null, kitName: c.kit?.name ?? null,
        custodianName: c.custodian?.displayName ?? null,
        adminUsername: c.adminUsername, adminPassword: c.adminPassword,
        studentUsername: c.studentUsername, studentPassword: c.studentPassword,
        dateReceived: c.dateReceived?.toISOString().split('T')[0] ?? null,
        lastInventoried: c.lastInventoried?.toISOString().split('T')[0] ?? null,
        notes: c.notes,
      })),
      hostNames: hostNames.map((h) => ({
        id: h.id, name: h.name, computerId: h.computerId,
      })),
    };
  }

  async exportToExcel(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // Sites sheet
    const sitesSheet = workbook.addWorksheet('Sites');
    const sites = await this.prisma.site.findMany({ orderBy: { id: 'asc' } });
    sitesSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Address', key: 'address', width: 40 },
      { header: 'Is Home Site', key: 'isHomeSite', width: 12 },
      { header: 'Is Active', key: 'isActive', width: 12 },
    ];
    for (const site of sites) {
      sitesSheet.addRow({
        id: site.id,
        name: site.name,
        address: site.address || '',
        isHomeSite: site.isHomeSite,
        isActive: site.isActive,
      });
    }

    // Kits sheet
    const kitsSheet = workbook.addWorksheet('Kits');
    const kits = await this.prisma.kit.findMany({
      include: { site: { select: { name: true } } },
      orderBy: { number: 'asc' },
    });
    kitsSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Number', key: 'number', width: 10 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Container Type', key: 'containerType', width: 15 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Site', key: 'site', width: 20 },
      { header: 'QR Code', key: 'qrCode', width: 15 },
    ];
    for (const kit of kits) {
      kitsSheet.addRow({
        id: kit.id,
        number: kit.number,
        name: kit.name,
        containerType: kit.containerType,
        description: kit.description || '',
        status: kit.status,
        site: kit.site?.name ?? '',
        qrCode: kit.qrCode || '',
      });
    }

    // Packs sheet
    const packsSheet = workbook.addWorksheet('Packs');
    const packs = await this.prisma.pack.findMany({
      include: { kit: { select: { number: true, name: true } } },
      orderBy: { id: 'asc' },
    });
    packsSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Kit Number', key: 'kitNumber', width: 12 },
      { header: 'Kit Name', key: 'kitName', width: 25 },
      { header: 'QR Code', key: 'qrCode', width: 15 },
    ];
    for (const pack of packs) {
      packsSheet.addRow({
        id: pack.id,
        name: pack.name,
        description: pack.description || '',
        kitNumber: pack.kit.number,
        kitName: pack.kit.name,
        qrCode: pack.qrCode || '',
      });
    }

    // Items sheet
    const itemsSheet = workbook.addWorksheet('Items');
    const items = await this.prisma.item.findMany({
      include: { pack: { select: { name: true, kit: { select: { number: true } } } } },
      orderBy: { id: 'asc' },
    });
    itemsSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Expected Quantity', key: 'expectedQuantity', width: 18 },
      { header: 'Pack Name', key: 'packName', width: 25 },
      { header: 'Kit Number', key: 'kitNumber', width: 12 },
    ];
    for (const item of items) {
      itemsSheet.addRow({
        id: item.id,
        name: item.name,
        type: item.type,
        expectedQuantity: item.expectedQuantity ?? '',
        packName: item.pack.name,
        kitNumber: item.pack.kit.number,
      });
    }

    // Computers sheet
    const computersSheet = workbook.addWorksheet('Computers');
    const computers = await this.prisma.computer.findMany({
      include: {
        site: { select: { name: true } },
        kit: { select: { number: true, name: true } },
        hostName: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
    });
    computersSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Host Name', key: 'hostName', width: 20 },
      { header: 'Model', key: 'model', width: 25 },
      { header: 'Serial Number', key: 'serialNumber', width: 20 },
      { header: 'Service Tag', key: 'serviceTag', width: 15 },
      { header: 'Disposition', key: 'disposition', width: 15 },
      { header: 'Site', key: 'site', width: 20 },
      { header: 'Kit', key: 'kit', width: 20 },
      { header: 'Date Received', key: 'dateReceived', width: 15 },
      { header: 'Last Inventoried', key: 'lastInventoried', width: 15 },
      { header: 'Admin Username', key: 'adminUsername', width: 15 },
      { header: 'Admin Password', key: 'adminPassword', width: 15 },
      { header: 'Student Username', key: 'studentUsername', width: 15 },
      { header: 'Student Password', key: 'studentPassword', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];
    for (const c of computers) {
      computersSheet.addRow({
        id: c.id,
        hostName: c.hostName?.name || '',
        model: c.model || '',
        serialNumber: c.serialNumber || '',
        serviceTag: c.serviceTag || '',
        disposition: c.disposition,
        site: c.site?.name || '',
        kit: c.kit ? `#${c.kit.number} ${c.kit.name}` : '',
        dateReceived: c.dateReceived ? c.dateReceived.toISOString().split('T')[0] : '',
        lastInventoried: c.lastInventoried ? c.lastInventoried.toISOString().split('T')[0] : '',
        adminUsername: c.adminUsername || '',
        adminPassword: c.adminPassword || '',
        studentUsername: c.studentUsername || '',
        studentPassword: c.studentPassword || '',
        notes: c.notes || '',
      });
    }

    // Style header rows
    for (const sheet of [sitesSheet, kitsSheet, packsSheet, itemsSheet, computersSheet]) {
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    }

    // Metadata sheet with export timestamp
    const metaSheet = workbook.addWorksheet('_metadata');
    metaSheet.addRow(['exportedAt', new Date().toISOString()]);
    metaSheet.addRow(['version', '1']);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
