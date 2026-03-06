import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

export class ExportService {
  constructor(private prisma: PrismaClient) {}

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
        site: kit.site.name,
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
      { header: 'Default Username', key: 'defaultUsername', width: 15 },
      { header: 'Default Password', key: 'defaultPassword', width: 15 },
      { header: 'Date Received', key: 'dateReceived', width: 15 },
      { header: 'Last Inventoried', key: 'lastInventoried', width: 15 },
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
        defaultUsername: c.defaultUsername || '',
        defaultPassword: c.defaultPassword || '',
        dateReceived: c.dateReceived ? c.dateReceived.toISOString().split('T')[0] : '',
        lastInventoried: c.lastInventoried ? c.lastInventoried.toISOString().split('T')[0] : '',
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
