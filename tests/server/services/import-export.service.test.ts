/**
 * Service-level tests for ExportService and ImportService.
 * Requires a running test database.
 */

process.env.NODE_ENV = 'test';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://app:devpassword@localhost:5433/app';
}

import { PrismaClient } from '@prisma/client';
import { ServiceRegistry } from '../../../server/src/services/service.registry';

const prisma = new PrismaClient();
const registry = ServiceRegistry.create(prisma);

let testUserId: number;
const suffix = Date.now();

// Track IDs for cleanup
const createdSiteIds: number[] = [];
const createdKitIds: number[] = [];

beforeAll(async () => {
  const user = await prisma.user.findFirst();
  if (user) {
    testUserId = user.id;
  } else {
    const created = await prisma.user.create({
      data: {
        email: `ie-test-${suffix}@example.com`,
        googleId: `ie-test-${suffix}`,
        displayName: 'IE Test',
        role: 'QUARTERMASTER',
      },
    });
    testUserId = created.id;
  }
});

afterAll(async () => {
  // Clean up in reverse FK order
  for (const kitId of createdKitIds) {
    const kit = await prisma.kit.findUnique({
      where: { id: kitId },
      include: { packs: { include: { items: true } } },
    });
    if (kit) {
      for (const pack of kit.packs) {
        await prisma.item.deleteMany({ where: { packId: pack.id } });
      }
      await prisma.pack.deleteMany({ where: { kitId: kit.id } });
      await prisma.kit.delete({ where: { id: kitId } });
    }
  }
  for (const siteId of createdSiteIds) {
    await prisma.site.delete({ where: { id: siteId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('ExportService', () => {
  it('exports an xlsx buffer with expected sheets', async () => {
    const buffer = await registry.exports.exportToExcel();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);

    // Verify xlsx magic bytes (PK zip header)
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });
});

describe('ImportService', () => {
  let kitId: number;

  beforeAll(async () => {
    // Create test data
    const site = await registry.sites.create({
      name: `IE Test Site ${suffix}`,
      address: '123 Test St',
      latitude: 0,
      longitude: 0,
      isHomeSite: false,
    }, testUserId);
    createdSiteIds.push(site.id);

    const kit = await registry.kits.create({
      number: 9000 + (suffix % 999),
      name: `IE Test Kit ${suffix}`,
      siteId: site.id,
      containerType: 'BAG',
      description: 'Original description',
    }, testUserId);
    kitId = kit.id;
    createdKitIds.push(kit.id);
  });

  it('round-trips export then import preview detecting updates', async () => {
    // Export
    const buffer = await registry.exports.exportToExcel();

    // Modify the buffer — parse and re-export with changed description
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const kitsSheet = workbook.getWorksheet('Kits');
    expect(kitsSheet).toBeTruthy();

    // Find our test kit row and update description
    let found = false;
    kitsSheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber === 1) return;
      const id = row.getCell(1).value;
      if (id === kitId) {
        row.getCell(5).value = 'Updated via import';
        found = true;
      }
    });
    expect(found).toBe(true);

    const modifiedBuffer = await workbook.xlsx.writeBuffer();

    // Preview
    const diffs = await registry.imports.parseAndDiff(Buffer.from(modifiedBuffer));
    expect(diffs.length).toBeGreaterThan(0);

    const kitDiff = diffs.find(d => d.sheet === 'Kits' && d.id === kitId);
    expect(kitDiff).toBeTruthy();
    expect(kitDiff!.action).toBe('update');
  });

  it('applies import updates', async () => {
    const diffs = [
      {
        sheet: 'Kits',
        id: kitId,
        action: 'update' as const,
        name: `IE Test Kit ${suffix}`,
        fields: [{ field: 'description', oldValue: null, newValue: 'Applied via import' }],
      },
    ];

    const result = await registry.imports.applyImport(diffs, testUserId);
    expect(result.updated).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify the update persisted
    const kit = await prisma.kit.findUnique({ where: { id: kitId } });
    expect(kit!.description).toBe('Applied via import');
  });
});
