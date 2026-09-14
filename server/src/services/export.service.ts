import ExcelJS from 'exceljs';
import { PrismaClient, KitStatus, ComputerDisposition } from '@prisma/client';

export type ExportEntity = 'kits' | 'packs' | 'computers' | 'items';
export type ExportFormat = 'csv' | 'xlsx';

export interface KitListFilters {
  status?: string;
}

export interface PackListFilters {
  kitId?: number;
}

export interface ItemListFilters {
  packId?: number;
}

export interface ComputerListFilters {
  siteId?: number;
  kitId?: number;
  disposition?: string;
  unassigned?: boolean;
}

/** Union of every entity's filter shape — what `exportEntityList` accepts, with each field meaningful only for the matching `entity`. */
export interface EntityListFilters {
  status?: string;
  kitId?: number;
  packId?: number;
  siteId?: number;
  disposition?: string;
  unassigned?: boolean;
}

export interface FilteredExportResult {
  buffer: Buffer;
  rowCount: number;
}

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
        include: {
          site: { select: { name: true } },
          custodian: { select: { displayName: true } },
          category: { select: { name: true } },
        },
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
          os: { select: { name: true } },
          category: { select: { name: true } },
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
        categoryName: k.category?.name ?? null,
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
        manufacturer: c.manufacturer, model: c.model,
        modelNumber: c.modelNumber, manufacturedYear: c.manufacturedYear,
        serialNumber: c.serialNumber, serviceTag: c.serviceTag,
        disposition: c.disposition,
        operatingSystem: c.os?.name ?? null,
        siteName: c.site?.name ?? null,
        kitNumber: c.kit?.number ?? null, kitName: c.kit?.name ?? null,
        custodianName: c.custodian?.displayName ?? null,
        categoryName: c.category?.name ?? null,
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
      include: {
        site: { select: { name: true } },
        custodian: { select: { displayName: true } },
        category: { select: { name: true } },
      },
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
      { header: 'Custodian', key: 'custodian', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
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
        custodian: kit.custodian?.displayName ?? '',
        category: kit.category?.name ?? '',
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
        custodian: { select: { displayName: true } },
        os: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
    });
    computersSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Host Name', key: 'hostName', width: 20 },
      { header: 'Manufacturer', key: 'manufacturer', width: 15 },
      { header: 'Model', key: 'model', width: 25 },
      { header: 'Model Number', key: 'modelNumber', width: 18 },
      { header: 'Operating System', key: 'os', width: 18 },
      { header: 'Manufactured Year', key: 'manufacturedYear', width: 18 },
      { header: 'Serial Number', key: 'serialNumber', width: 20 },
      { header: 'Service Tag', key: 'serviceTag', width: 15 },
      { header: 'Disposition', key: 'disposition', width: 15 },
      { header: 'Site', key: 'site', width: 20 },
      { header: 'Kit', key: 'kit', width: 20 },
      { header: 'Custodian', key: 'custodian', width: 20 },
      { header: 'Category', key: 'category', width: 18 },
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
        manufacturer: c.manufacturer || '',
        model: c.model || '',
        modelNumber: c.modelNumber || '',
        os: c.os?.name || '',
        manufacturedYear: c.manufacturedYear ?? '',
        serialNumber: c.serialNumber || '',
        serviceTag: c.serviceTag || '',
        disposition: c.disposition,
        site: c.site?.name || '',
        kit: c.kit ? `#${c.kit.number} ${c.kit.name}` : '',
        custodian: c.custodian?.displayName || '',
        category: c.category?.name || '',
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

  // ─── Filtered, single-entity export (ticket 010-004) ──────────────────
  //
  // Adds a filtered, single-entity CSV/xlsx export for kits, packs, items,
  // and computers — built for the `export_list` MCP tool. This is
  // additive: `exportToJson`/`exportToExcel` above are unchanged and keep
  // serving `/api/export`/`/api/export/json` unfiltered. Column names
  // mirror `exportToExcel`'s per-entity mapping above exactly, minus the
  // raw `ID` column each of those sheets includes — no database id ever
  // appears in a generated file's header row.

  /**
   * Renders one worksheet as either an xlsx or (via `ExcelJS`'s built-in
   * CSV writer) a CSV buffer. Header styling (bold + fill) only makes
   * sense for xlsx — CSV has no cell formatting — so it's applied
   * conditionally, after the CSV branch has already returned.
   */
  private async buildSingleSheetBuffer(
    sheetName: string,
    columns: Partial<ExcelJS.Column>[],
    rows: Record<string, unknown>[],
    format: ExportFormat,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = columns;
    for (const row of rows) sheet.addRow(row);

    if (format === 'csv') {
      const buffer = await workbook.csv.writeBuffer({ sheetName });
      return Buffer.from(buffer);
    }

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Kits, optionally filtered by `status` — same status-matching rule as
   * `KitService.list()`/the `list_kits` MCP tool: an unrecognized value is
   * silently ignored (treated as "no filter") rather than rejected.
   * Omitting `status` returns every non-deleted kit, matching `list_kits`
   * with no arguments.
   */
  async exportKitsList(format: ExportFormat, filters: KitListFilters = {}): Promise<FilteredExportResult> {
    const where: any = { deletedAt: null };
    if (filters.status && Object.values(KitStatus).includes(filters.status as KitStatus)) {
      where.status = filters.status;
    }

    const kits = await this.prisma.kit.findMany({
      where,
      include: {
        site: { select: { name: true } },
        custodian: { select: { displayName: true } },
        category: { select: { name: true } },
      },
      orderBy: { number: 'asc' },
    });

    const columns: Partial<ExcelJS.Column>[] = [
      { header: 'Number', key: 'number', width: 10 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Container Type', key: 'containerType', width: 15 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Site', key: 'site', width: 20 },
      { header: 'Custodian', key: 'custodian', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'QR Code', key: 'qrCode', width: 15 },
    ];
    const rows = kits.map((kit) => ({
      number: kit.number,
      name: kit.name,
      containerType: kit.containerType,
      description: kit.description || '',
      status: kit.status,
      site: kit.site?.name ?? '',
      custodian: kit.custodian?.displayName ?? '',
      category: kit.category?.name ?? '',
      qrCode: kit.qrCode || '',
    }));

    const buffer = await this.buildSingleSheetBuffer('Kits', columns, rows, format);
    return { buffer, rowCount: rows.length };
  }

  /**
   * Packs, optionally filtered to one kit (resolved by the caller from a
   * `kit_number` to a `kitId` — this service never resolves user-facing
   * identifiers itself). Omitting `kitId` returns every pack, matching
   * `list_packs` with no `kit_number`.
   */
  async exportPacksList(format: ExportFormat, filters: PackListFilters = {}): Promise<FilteredExportResult> {
    const where: any = {};
    if (filters.kitId != null) where.kitId = filters.kitId;

    const packs = await this.prisma.pack.findMany({
      where,
      include: { kit: { select: { number: true, name: true } } },
      orderBy: { displayNumber: 'asc' },
    });

    const columns: Partial<ExcelJS.Column>[] = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Kit Number', key: 'kitNumber', width: 12 },
      { header: 'Kit Name', key: 'kitName', width: 25 },
      { header: 'QR Code', key: 'qrCode', width: 15 },
    ];
    const rows = packs.map((pack) => ({
      name: pack.name,
      description: pack.description || '',
      kitNumber: pack.kit.number,
      kitName: pack.kit.name,
      qrCode: pack.qrCode || '',
    }));

    const buffer = await this.buildSingleSheetBuffer('Packs', columns, rows, format);
    return { buffer, rowCount: rows.length };
  }

  /**
   * Items, optionally filtered to one pack (resolved by the caller from a
   * pack designator to a `packId`). Omitting `packId` returns every item,
   * matching `list_items` with no `pack`.
   */
  async exportItemsList(format: ExportFormat, filters: ItemListFilters = {}): Promise<FilteredExportResult> {
    const where: any = {};
    if (filters.packId != null) where.packId = filters.packId;

    const items = await this.prisma.item.findMany({
      where,
      include: { pack: { select: { name: true, kit: { select: { number: true } } } } },
      orderBy: { name: 'asc' },
    });

    const columns: Partial<ExcelJS.Column>[] = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Expected Quantity', key: 'expectedQuantity', width: 18 },
      { header: 'Pack Name', key: 'packName', width: 25 },
      { header: 'Kit Number', key: 'kitNumber', width: 12 },
    ];
    const rows = items.map((item) => ({
      name: item.name,
      type: item.type,
      expectedQuantity: item.expectedQuantity ?? '',
      packName: item.pack.name,
      kitNumber: item.pack.kit.number,
    }));

    const buffer = await this.buildSingleSheetBuffer('Items', columns, rows, format);
    return { buffer, rowCount: rows.length };
  }

  /**
   * Computers, filtered exactly like `ComputerService.list()`/the
   * `list_computers` MCP tool: `disposition` (ignored if not a recognized
   * value), `siteId`, `kitId` (both resolved by the caller from
   * `site_id`/`kit_number`), and `unassigned` (overrides `siteId`/`kitId`
   * to `null`). Filters compose; omitting all of them returns every
   * non-deleted computer. Carries the same `adminPassword`/
   * `studentPassword` columns as `exportToExcel`'s Computers sheet — see
   * sprint 010's security-consistency note: this is a second path to data
   * already reachable via the existing unfiltered `/api/export`, under the
   * same access level, not a new exposure.
   */
  async exportComputersList(format: ExportFormat, filters: ComputerListFilters = {}): Promise<FilteredExportResult> {
    const where: any = { deletedAt: null };
    if (filters.disposition && Object.values(ComputerDisposition).includes(filters.disposition as ComputerDisposition)) {
      where.disposition = filters.disposition;
    }
    if (filters.siteId != null) where.siteId = filters.siteId;
    if (filters.kitId != null) where.kitId = filters.kitId;
    if (filters.unassigned) {
      where.siteId = null;
      where.kitId = null;
    }

    const computers = await this.prisma.computer.findMany({
      where,
      include: {
        site: { select: { name: true } },
        kit: { select: { number: true, name: true } },
        hostName: { select: { name: true } },
        custodian: { select: { displayName: true } },
        os: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
    });

    const columns: Partial<ExcelJS.Column>[] = [
      { header: 'Host Name', key: 'hostName', width: 20 },
      { header: 'Manufacturer', key: 'manufacturer', width: 15 },
      { header: 'Model', key: 'model', width: 25 },
      { header: 'Model Number', key: 'modelNumber', width: 18 },
      { header: 'Operating System', key: 'os', width: 18 },
      { header: 'Manufactured Year', key: 'manufacturedYear', width: 18 },
      { header: 'Serial Number', key: 'serialNumber', width: 20 },
      { header: 'Service Tag', key: 'serviceTag', width: 15 },
      { header: 'Disposition', key: 'disposition', width: 15 },
      { header: 'Site', key: 'site', width: 20 },
      { header: 'Kit', key: 'kit', width: 20 },
      { header: 'Custodian', key: 'custodian', width: 20 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Date Received', key: 'dateReceived', width: 15 },
      { header: 'Last Inventoried', key: 'lastInventoried', width: 15 },
      { header: 'Admin Username', key: 'adminUsername', width: 15 },
      { header: 'Admin Password', key: 'adminPassword', width: 15 },
      { header: 'Student Username', key: 'studentUsername', width: 15 },
      { header: 'Student Password', key: 'studentPassword', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];
    const rows = computers.map((c) => ({
      hostName: c.hostName?.name || '',
      manufacturer: c.manufacturer || '',
      model: c.model || '',
      modelNumber: c.modelNumber || '',
      os: c.os?.name || '',
      manufacturedYear: c.manufacturedYear ?? '',
      serialNumber: c.serialNumber || '',
      serviceTag: c.serviceTag || '',
      disposition: c.disposition,
      site: c.site?.name || '',
      kit: c.kit ? `#${c.kit.number} ${c.kit.name}` : '',
      custodian: c.custodian?.displayName || '',
      category: c.category?.name || '',
      dateReceived: c.dateReceived ? c.dateReceived.toISOString().split('T')[0] : '',
      lastInventoried: c.lastInventoried ? c.lastInventoried.toISOString().split('T')[0] : '',
      adminUsername: c.adminUsername || '',
      adminPassword: c.adminPassword || '',
      studentUsername: c.studentUsername || '',
      studentPassword: c.studentPassword || '',
      notes: c.notes || '',
    }));

    const buffer = await this.buildSingleSheetBuffer('Computers', columns, rows, format);
    return { buffer, rowCount: rows.length };
  }

  /**
   * Single dispatch point the `export_list` MCP tool calls: routes to the
   * matching per-entity method above, picking only the filter fields that
   * entity understands out of the shared `EntityListFilters` shape (e.g.
   * `filters.status` is meaningless for `entity: 'computers'` and is
   * simply not read on that branch).
   */
  async exportEntityList(
    entity: ExportEntity,
    format: ExportFormat,
    filters: EntityListFilters = {},
  ): Promise<FilteredExportResult> {
    switch (entity) {
      case 'kits':
        return this.exportKitsList(format, { status: filters.status });
      case 'packs':
        return this.exportPacksList(format, { kitId: filters.kitId });
      case 'items':
        return this.exportItemsList(format, { packId: filters.packId });
      case 'computers':
        return this.exportComputersList(format, {
          siteId: filters.siteId,
          kitId: filters.kitId,
          disposition: filters.disposition,
          unassigned: filters.unassigned,
        });
    }
  }
}
