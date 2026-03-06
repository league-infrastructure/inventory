import { setupTestUser, teardown, getUserId, getSuffix, getPrisma } from './setup';
import { ServiceRegistry } from '../../../server/src/services/service.registry';

let prisma: ReturnType<typeof getPrisma>;

beforeAll(async () => {
  await setupTestUser();
  prisma = getPrisma();
});
afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { objectType: { contains: `audit-src-test-${getSuffix()}` } } });
  await prisma.site.deleteMany({ where: { name: { contains: `audit-src-${getSuffix()}` } } });
  await teardown();
});

describe('Audit source propagation', () => {
  it('defaults to UI source', async () => {
    const registry = ServiceRegistry.create(prisma);
    const site = await registry.sites.create(
      { name: `audit-src-${getSuffix()}-ui` },
      getUserId(),
    );

    const logs = await prisma.auditLog.findMany({
      where: { objectType: 'Site', objectId: site.id },
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(l => l.source === 'UI')).toBe(true);
  });

  it('uses MCP source when specified', async () => {
    const registry = ServiceRegistry.create(prisma, 'MCP');
    const site = await registry.sites.create(
      { name: `audit-src-${getSuffix()}-mcp` },
      getUserId(),
    );

    const logs = await prisma.auditLog.findMany({
      where: { objectType: 'Site', objectId: site.id },
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(l => l.source === 'MCP')).toBe(true);
  });
});
