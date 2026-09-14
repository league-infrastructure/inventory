/**
 * Ticket 010-004 (sprint 010: AI-Generated Labels and Exports Downloadable
 * via Link): `ExportService`'s new filtered, single-entity CSV/xlsx export
 * methods (`exportKitsList`/`exportPacksList`/`exportItemsList`/
 * `exportComputersList`/`exportEntityList`) that back the `export_list`
 * MCP tool.
 *
 * These are additive — `exportToJson`/`exportToExcel` (tested in
 * import-export.service.test.ts) are unchanged and unexercised here.
 *
 * Row-count assertions compare against the corresponding entity service's
 * own `list()`/`listAll()` result for the same filter (the ground truth
 * `list_*` MCP tools already use) rather than a hardcoded number — this
 * test file runs against the shared dev/test database (dynamic,
 * suffix-scoped fixtures, not a clean slate), so an absolute count would
 * be flaky against leftover rows from other test files/runs. Matching the
 * `list_*` service's own result set is exactly what the ticket's
 * acceptance criteria ask this to verify.
 */
process.env.NODE_ENV = 'test';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://app:devpassword@localhost:5434/app';
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExcelJS = require('exceljs');
import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';

// Disjoint from other test files' kit-number offsets (+70000, +80000,
// +900, +950001, etc.) so parallel workers can't collide on Kit.number.
function kitNumber(n: number) { return n + (getSuffix() % 100000) + 120000; }

/** Reads row 1 of an xlsx buffer's single worksheet as an array of header strings. */
async function xlsxHeaderRow(buffer: Buffer): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  const values = sheet.getRow(1).values as unknown[];
  // ExcelJS row.values is 1-indexed (index 0 is always empty) — drop it.
  return values.slice(1).map((v) => String(v));
}

/** Reads row 1 of a CSV buffer as an array of header strings. */
function csvHeaderRow(buffer: Buffer): string[] {
  const text = buffer.toString('utf-8');
  const firstLine = text.split(/\r?\n/)[0];
  return firstLine.split(',').map((s) => s.trim());
}

/** Data row count: total non-empty lines minus the header row. */
function csvDataRowCount(buffer: Buffer): number {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  return Math.max(0, lines.length - 1);
}

describe('ExportService filtered exports (ticket 010-004)', () => {
  let siteId: number;
  let activeKitId: number;
  let activeKitNumber: number;
  let retiredKitId: number;
  let retiredKitNumber: number;
  let packId: number;
  let itemId: number;
  let assignedComputerId: number;
  let unassignedComputerId: number;

  beforeAll(async () => {
    await setupTestUser();
    const reg = getRegistry();
    const uid = getUserId();

    const site = await reg.sites.create({ name: `svc-test-${getSuffix()}-export-list-site` }, uid);
    siteId = site.id;

    const activeKit = await reg.kits.create(
      { number: kitNumber(1), name: `svc-test-${getSuffix()}-export-list-active`, siteId },
      uid,
    );
    activeKitId = activeKit.id;
    activeKitNumber = activeKit.number;

    const retiredKit = await reg.kits.create(
      { number: kitNumber(2), name: `svc-test-${getSuffix()}-export-list-retired`, siteId },
      uid,
    );
    retiredKitId = retiredKit.id;
    retiredKitNumber = retiredKit.number;
    await reg.kits.update(retiredKitId, { status: 'RETIRED' }, uid);

    const pack = await reg.packs.create(
      { name: `svc-test-${getSuffix()}-export-list-pack` },
      uid,
      activeKitId,
    );
    packId = pack.id;

    const item = await reg.items.create(
      { name: `svc-test-${getSuffix()}-export-list-item`, type: 'CONSUMABLE' },
      uid,
      packId,
    );
    itemId = item.id;

    const assignedComputer = await reg.computers.create(
      {
        model: `svc-test-${getSuffix()}-export-list-computer-assigned`,
        serialNumber: `SN-EXPORTLIST-A-${getSuffix()}`,
        kitId: activeKitId,
        siteId,
        disposition: 'ACTIVE',
        adminUsername: 'admin',
        adminPassword: 'admin-secret',
        studentUsername: 'student',
        studentPassword: 'student-secret',
      },
      uid,
    );
    assignedComputerId = assignedComputer.id;

    const unassignedComputer = await reg.computers.create(
      {
        model: `svc-test-${getSuffix()}-export-list-computer-unassigned`,
        serialNumber: `SN-EXPORTLIST-U-${getSuffix()}`,
        disposition: 'NEEDS_REPAIR',
      },
      uid,
    );
    unassignedComputerId = unassignedComputer.id;
  }, 30000);

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.item.deleteMany({ where: { id: itemId } });
    await prisma.computer.deleteMany({ where: { id: { in: [assignedComputerId, unassignedComputerId] } } });
    await prisma.pack.deleteMany({ where: { id: packId } });
    await prisma.kit.deleteMany({ where: { id: { in: [activeKitId, retiredKitId] } } });
    await prisma.site.deleteMany({ where: { id: siteId } });
    await teardown();
  }, 30000);

  describe('kits', () => {
    it('status filter matches KitService.list(status), and no id column appears', async () => {
      const reg = getRegistry();
      const groundTruth = await reg.kits.list('RETIRED');

      const { buffer, rowCount } = await reg.exports.exportKitsList('xlsx', { status: 'RETIRED' });
      expect(rowCount).toBe(groundTruth.length);

      const header = await xlsxHeaderRow(buffer);
      expect(header).toEqual([
        'Number', 'Name', 'Container Type', 'Description', 'Status',
        'Site', 'Custodian', 'Category', 'QR Code',
      ]);
      expect(header.some((h) => /^id$/i.test(h))).toBe(false);
    });

    it('omitting status matches the full KitService.list() result', async () => {
      const reg = getRegistry();
      const groundTruth = await reg.kits.list();

      const { rowCount } = await reg.exports.exportKitsList('xlsx');
      expect(rowCount).toBe(groundTruth.length);
    });

    it('an unrecognized status value is ignored, same as list_kits/KitService.list()', async () => {
      const reg = getRegistry();
      const groundTruth = await reg.kits.list('NOT_A_REAL_STATUS');

      const { rowCount } = await reg.exports.exportKitsList('xlsx', { status: 'NOT_A_REAL_STATUS' });
      expect(rowCount).toBe(groundTruth.length);
    });
  });

  describe('packs', () => {
    it('kit_number (resolved to kitId) filter matches PackService.list(kitId)', async () => {
      const reg = getRegistry();
      const groundTruth = await reg.packs.list(activeKitId);

      const { buffer, rowCount } = await reg.exports.exportPacksList('xlsx', { kitId: activeKitId });
      expect(rowCount).toBe(groundTruth.length);
      expect(rowCount).toBeGreaterThan(0);

      const header = await xlsxHeaderRow(buffer);
      expect(header).toEqual(['Name', 'Description', 'Kit Number', 'Kit Name', 'QR Code']);
      expect(header.some((h) => /^id$/i.test(h))).toBe(false);

      // Kit identified by number, never database id.
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const rows: string[] = [];
      workbook.worksheets[0].eachRow((row: any, i: number) => { if (i > 1) rows.push(String(row.getCell(3).value)); });
      expect(rows).toContain(String(activeKitNumber));
    });

    it('omitting kit_number matches PackService.listAll()', async () => {
      const reg = getRegistry();
      const groundTruth = await reg.packs.listAll();

      const { rowCount } = await reg.exports.exportPacksList('xlsx');
      expect(rowCount).toBe(groundTruth.length);
    });
  });

  describe('items', () => {
    it('pack (resolved to packId) filter matches ItemService.list(packId)', async () => {
      const reg = getRegistry();
      const groundTruth = await reg.items.list(packId);

      const { buffer, rowCount } = await reg.exports.exportItemsList('xlsx', { packId });
      expect(rowCount).toBe(groundTruth.length);
      expect(rowCount).toBeGreaterThan(0);

      const header = await xlsxHeaderRow(buffer);
      expect(header).toEqual(['Name', 'Type', 'Expected Quantity', 'Pack Name', 'Kit Number']);
      expect(header.some((h) => /^id$/i.test(h))).toBe(false);
    });

    it('omitting pack matches ItemService.listAll()', async () => {
      const reg = getRegistry();
      const groundTruth = await reg.items.listAll();

      const { rowCount } = await reg.exports.exportItemsList('xlsx');
      expect(rowCount).toBe(groundTruth.length);
    });
  });

  describe('computers', () => {
    it('composed siteId + kitId filters match ComputerService.list()', async () => {
      const reg = getRegistry();
      const groundTruth = await reg.computers.list({ siteId, kitId: activeKitId });

      const { buffer, rowCount } = await reg.exports.exportComputersList('xlsx', { siteId, kitId: activeKitId });
      expect(rowCount).toBe(groundTruth.length);
      expect(rowCount).toBeGreaterThan(0);

      const header = await xlsxHeaderRow(buffer);
      expect(header).toEqual([
        'Host Name', 'Manufacturer', 'Model', 'Model Number', 'Operating System',
        'Manufactured Year', 'Serial Number', 'Service Tag', 'Disposition', 'Site', 'Kit',
        'Custodian', 'Category', 'Date Received', 'Last Inventoried', 'Admin Username',
        'Admin Password', 'Student Username', 'Student Password', 'Notes',
      ]);
      expect(header.some((h) => /^id$/i.test(h))).toBe(false);
    });

    it('unassigned=true matches ComputerService.list({ unassigned: true })', async () => {
      const reg = getRegistry();
      const groundTruth = await reg.computers.list({ unassigned: true });

      const { rowCount } = await reg.exports.exportComputersList('xlsx', { unassigned: true });
      expect(rowCount).toBe(groundTruth.length);
      expect(rowCount).toBeGreaterThan(0);
    });

    it('disposition filter matches ComputerService.list({ disposition })', async () => {
      const reg = getRegistry();
      const groundTruth = await reg.computers.list({ disposition: 'NEEDS_REPAIR' });

      const { rowCount } = await reg.exports.exportComputersList('xlsx', { disposition: 'NEEDS_REPAIR' });
      expect(rowCount).toBe(groundTruth.length);
      expect(rowCount).toBeGreaterThan(0);
    });
  });

  describe('CSV vs xlsx', () => {
    it('same filtered query produces matching row counts and header names in both formats', async () => {
      const reg = getRegistry();

      const xlsx = await reg.exports.exportKitsList('xlsx', { status: 'RETIRED' });
      const csv = await reg.exports.exportKitsList('csv', { status: 'RETIRED' });

      expect(csv.rowCount).toBe(xlsx.rowCount);
      expect(csvDataRowCount(csv.buffer)).toBe(xlsx.rowCount);

      const xlsxHeader = await xlsxHeaderRow(xlsx.buffer);
      const csvHeader = csvHeaderRow(csv.buffer);
      expect(csvHeader).toEqual(xlsxHeader);
    });

    it('xlsx buffer has the PK zip magic bytes; csv buffer does not', async () => {
      const reg = getRegistry();
      const xlsx = await reg.exports.exportKitsList('xlsx');
      const csv = await reg.exports.exportKitsList('csv');

      expect(xlsx.buffer[0]).toBe(0x50); // 'P'
      expect(xlsx.buffer[1]).toBe(0x4b); // 'K'
      expect(!(csv.buffer[0] === 0x50 && csv.buffer[1] === 0x4b)).toBe(true);
    });
  });

  describe('exportEntityList dispatch', () => {
    it('routes each entity to the matching per-entity method, ignoring filter fields that entity does not understand', async () => {
      const reg = getRegistry();

      const kits = await reg.exports.exportEntityList('kits', 'xlsx', { status: 'RETIRED', kitId: 999999 });
      const direct = await reg.exports.exportKitsList('xlsx', { status: 'RETIRED' });
      expect(kits.rowCount).toBe(direct.rowCount);

      const computers = await reg.exports.exportEntityList('computers', 'xlsx', {
        siteId, kitId: activeKitId, status: 'RETIRED',
      });
      const directComputers = await reg.exports.exportComputersList('xlsx', { siteId, kitId: activeKitId });
      expect(computers.rowCount).toBe(directComputers.rowCount);
    });
  });
});
