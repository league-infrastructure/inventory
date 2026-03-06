/**
 * Service-level tests for SearchService and ReportService.
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
const createdSiteIds: number[] = [];
const createdKitIds: number[] = [];

beforeAll(async () => {
  const user = await prisma.user.findFirst();
  if (user) {
    testUserId = user.id;
  } else {
    const created = await prisma.user.create({
      data: {
        email: `sr-test-${suffix}@example.com`,
        googleId: `sr-test-${suffix}`,
        displayName: 'SR Test User',
        role: 'QUARTERMASTER',
      },
    });
    testUserId = created.id;
  }

  // Create test data for search
  const site = await registry.sites.create({
    name: `SR Searchable Site ${suffix}`,
    address: '456 Test Ave',
    latitude: 0,
    longitude: 0,
    isHomeSite: false,
  }, testUserId);
  createdSiteIds.push(site.id);

  const kit = await registry.kits.create({
    number: 8000 + (suffix % 999),
    name: `SR Searchable Kit ${suffix}`,
    siteId: site.id,
    containerType: 'BAG',
    description: 'A searchable test kit',
  }, testUserId);
  createdKitIds.push(kit.id);
});

afterAll(async () => {
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

describe('SearchService', () => {
  it('returns empty for short queries', async () => {
    const results = await registry.search.search('a');
    expect(results).toEqual([]);
  });

  it('finds kits by name', async () => {
    const results = await registry.search.search(`Searchable Kit ${suffix}`);
    expect(results.length).toBeGreaterThan(0);
    const kitResult = results.find((r) => r.type === 'kit' && r.title.includes(String(suffix)));
    expect(kitResult).toBeTruthy();
  });

  it('finds sites by name', async () => {
    const results = await registry.search.search(`Searchable Site ${suffix}`);
    const siteResult = results.find((r) => r.type === 'site');
    expect(siteResult).toBeTruthy();
  });
});

describe('ReportService', () => {
  it('queries audit log with pagination', async () => {
    const page = await registry.reports.queryAuditLog({ page: 1, pageSize: 10 });
    expect(page).toHaveProperty('records');
    expect(page).toHaveProperty('total');
    expect(page).toHaveProperty('page', 1);
    expect(page).toHaveProperty('pageSize', 10);
    expect(Array.isArray(page.records)).toBe(true);
  });

  it('filters audit log by objectType', async () => {
    const page = await registry.reports.queryAuditLog({ objectType: 'Kit', page: 1, pageSize: 5 });
    for (const record of page.records) {
      expect(record.objectType).toBe('Kit');
    }
  });

  it('gets user activity', async () => {
    const records = await registry.reports.getUserActivity(testUserId, 10);
    expect(Array.isArray(records)).toBe(true);
  });

  it('returns inventory age report', async () => {
    const rows = await registry.reports.getInventoryAge();
    expect(Array.isArray(rows)).toBe(true);
    for (const row of rows) {
      expect(row).toHaveProperty('type');
      expect(row).toHaveProperty('name');
      expect(row).toHaveProperty('lastInventoried');
      expect(row).toHaveProperty('daysSinceInventory');
    }
  });

  it('returns checked-out-by-person report', async () => {
    const data = await registry.reports.getCheckedOutByPerson();
    expect(typeof data).toBe('object');
  });
});
