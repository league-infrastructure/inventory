import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { ServiceRegistry } from '../../../server/src/services/service.registry';
import { AuditService } from '../../../server/src/services/audit.service';
import { QrService } from '../../../server/src/services/qr.service';
import { SiteService } from '../../../server/src/services/site.service';
import { NotFoundError } from '../../../server/src/services/errors';

beforeAll(async () => { await setupTestUser(); });
afterAll(async () => {
  const prisma = getPrisma();
  // Delete in FK order: items → packs → computers → kits → sites
  const kits = await prisma.kit.findMany({
    where: { name: { contains: `svc-test-${getSuffix()}-aqr` } },
    include: { packs: { include: { items: true } } },
  });
  for (const kit of kits) {
    for (const pack of kit.packs) {
      await prisma.item.deleteMany({ where: { packId: pack.id } });
      await prisma.pack.delete({ where: { id: pack.id } });
    }
    await prisma.kit.delete({ where: { id: kit.id } });
  }
  await prisma.computer.deleteMany({ where: { model: { contains: `svc-test-${getSuffix()}-aqr` } } });
  await prisma.site.deleteMany({ where: { name: { contains: `svc-test-${getSuffix()}-aqr` } } });
  await teardown();
});

describe('AuditService', () => {
  it('writes a single audit entry', async () => {
    const site = await getRegistry().sites.create({
      name: `svc-test-${getSuffix()}-aqr-audit`,
    }, getUserId());

    // Verify audit entries were written (create writes audit)
    const prisma = getPrisma();
    const entries = await prisma.auditLog.findMany({
      where: { objectType: 'Site', objectId: site.id },
    });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].objectType).toBe('Site');
  });

  it('diff detects changes', () => {
    const audit = getRegistry().audit;
    const entries = audit.diff(
      1, 'Test', 1,
      { name: 'old', status: 'active' },
      { name: 'new', status: 'active' },
      ['name', 'status'],
    );
    expect(entries.length).toBe(1);
    expect(entries[0].field).toBe('name');
    expect(entries[0].oldValue).toBe('old');
    expect(entries[0].newValue).toBe('new');
  });

  it('diff ignores unchanged fields', () => {
    const audit = getRegistry().audit;
    const entries = audit.diff(
      1, 'Test', 1,
      { name: 'same', status: 'same' },
      { name: 'same', status: 'same' },
      ['name', 'status'],
    );
    expect(entries.length).toBe(0);
  });

  it('write handles empty array', async () => {
    await getRegistry().audit.write([]);
    // Should not throw
  });
});

describe('QrService', () => {
  let testKitId: number;
  let testComputerId: number;
  let testPackId: number;

  beforeAll(async () => {
    const site = await getRegistry().sites.create({
      name: `svc-test-${getSuffix()}-aqr-qrsite`,
    }, getUserId());
    const kit = await getRegistry().kits.create({
      number: (getSuffix() % 100000) + 300,
      name: `svc-test-${getSuffix()}-aqr-qrkit`,
      siteId: site.id,
    }, getUserId());
    testKitId = kit.id;
    const comp = await getRegistry().computers.create({
      model: `svc-test-${getSuffix()}-aqr-model`,
      siteId: site.id,
    }, getUserId());
    testComputerId = comp.id;
    const pack = await getRegistry().packs.create({ name: 'QR Pack' }, getUserId(), testKitId);
    testPackId = pack.id;
  });

  it('generates a QR data URL', async () => {
    const dataUrl = await getRegistry().qr.generateDataUrl('/test');
    expect(dataUrl).toContain('data:image/png;base64');
  });

  it('getKitQrInfo returns info for existing kit', async () => {
    const info = await getRegistry().qr.getKitQrInfo(testKitId);
    expect(info.type).toBe('Kit');
    expect(info.qrDataUrl).toContain('data:image/png;base64');
  });

  it('getComputerQrInfo returns info for existing computer', async () => {
    const info = await getRegistry().qr.getComputerQrInfo(testComputerId);
    expect(info.type).toBe('Computer');
    expect(info.qrDataUrl).toContain('data:image/png;base64');
  });

  it('getPackQrInfo returns info for existing pack', async () => {
    const info = await getRegistry().qr.getPackQrInfo(testPackId);
    expect(info.type).toBe('Pack');
    expect(info.qrDataUrl).toContain('data:image/png;base64');
  });

  it('getKitQrInfo throws for nonexistent kit', async () => {
    await expect(getRegistry().qr.getKitQrInfo(999999)).rejects.toThrow(NotFoundError);
  });

  it('getComputerQrInfo throws for nonexistent computer', async () => {
    await expect(getRegistry().qr.getComputerQrInfo(999999)).rejects.toThrow(NotFoundError);
  });

  it('getPackQrInfo throws for nonexistent pack', async () => {
    await expect(getRegistry().qr.getPackQrInfo(999999)).rejects.toThrow(NotFoundError);
  });
});

describe('ServiceRegistry', () => {
  it('create() returns a registry with all services', () => {
    const reg = getRegistry();
    expect(reg.audit).toBeInstanceOf(AuditService);
    expect(reg.qr).toBeInstanceOf(QrService);
    expect(reg.sites).toBeInstanceOf(SiteService);
    expect(reg.hostNames).toBeDefined();
    expect(reg.computers).toBeDefined();
    expect(reg.kits).toBeDefined();
    expect(reg.packs).toBeDefined();
    expect(reg.items).toBeDefined();
    expect(reg.checkouts).toBeDefined();
  });

  it('create() accepts a custom PrismaClient', () => {
    const prisma = getPrisma();
    const reg = ServiceRegistry.create(prisma);
    expect(reg.sites).toBeInstanceOf(SiteService);
  });
});
