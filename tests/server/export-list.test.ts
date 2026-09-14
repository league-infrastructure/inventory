import request from 'supertest';

process.env.NODE_ENV = 'test';

import app from '../../server/src/app';
import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './services/setup';
import { ServiceRegistry } from '../../server/src/services/service.registry';
import { registerTools } from '../../server/src/mcp/tools';
import { mcpContext } from '../../server/src/mcp/context';
import type { User } from '@prisma/client';

// ─── export_list MCP tool (ticket 010-004) ───────────────────────────────
//
// Same fake-collector pattern as labels.test.ts / mcp-tool-metadata.test.ts:
// registerTools() only needs an object exposing `.tool(name, ...rest)` /
// `.registerTool(name, config, cb)`, so a minimal fake stands in for a real
// McpServer and the tool's handler is invoked directly, bypassing the
// transport layer.

type ToolResult = {
  isError?: boolean;
  content: { type: string; text?: string }[];
};
type ToolHandler = (args: any) => Promise<ToolResult>;

function fakeUser(role: string): User {
  return { id: getUserId(), role } as User;
}

function getExportListHandler(): ToolHandler {
  const handlers = new Map<string, ToolHandler>();
  const fakeServer = {
    tool: (name: string, ...rest: any[]) => {
      handlers.set(name, rest[rest.length - 1]);
    },
    registerTool: (name: string, _config: any, cb: ToolHandler) => {
      handlers.set(name, cb);
    },
    prompt: () => {},
  };
  registerTools(fakeServer as any);
  const handler = handlers.get('export_list');
  if (!handler) throw new Error('export_list tool was not registered');
  return handler;
}

describe('export_list MCP tool', () => {
  let siteId: number;
  let kitId: number;
  let kitNumber: number;
  let packId: number;
  let computerId: number;

  beforeAll(async () => {
    await setupTestUser();
    const reg = getRegistry();
    const uid = getUserId();
    const suffix = getSuffix();

    const site = await reg.sites.create({ name: `svc-test-${suffix}-export-list-tool-site` }, uid);
    siteId = site.id;

    kitNumber = (suffix % 100000) + 130000;
    const kit = await reg.kits.create({ number: kitNumber, name: `svc-test-${suffix}-export-list-tool-kit`, siteId }, uid);
    kitId = kit.id;

    const pack = await reg.packs.create({ name: `svc-test-${suffix}-export-list-tool-pack` }, uid, kitId);
    packId = pack.id;

    const computer = await reg.computers.create({
      model: `svc-test-${suffix}-export-list-tool-computer`,
      serialNumber: `SN-EXPORTLISTTOOL-${suffix}`,
      kitId,
      siteId,
    }, uid);
    computerId = computer.id;
  }, 30000);

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.computer.deleteMany({ where: { id: computerId } });
    await prisma.item.deleteMany({ where: { packId } });
    await prisma.pack.deleteMany({ where: { kitId } });
    await prisma.kit.deleteMany({ where: { id: kitId } });
    await prisma.site.deleteMany({ where: { id: siteId } });
    await teardown();
  }, 30000);

  it('kits: returns a download_url, rowCount, and echoes entity/format back', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getExportListHandler();

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ entity: 'kits', format: 'xlsx' });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text as string);
      expect(body.entity).toBe('kits');
      expect(body.format).toBe('xlsx');
      expect(typeof body.rowCount).toBe('number');
      expect(body.rowCount).toBeGreaterThan(0);
      expect(body.download_url).toMatch(/^https?:\/\/.+\/api\/downloads\/[0-9a-f]{64}$/);
    });
  });

  it('does not require Quartermaster role — a non-QM authenticated caller succeeds (same access level as /api/export)', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getExportListHandler();

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ entity: 'computers', format: 'csv' });
      expect(result.isError).toBeFalsy();
    });
  });

  it('packs: kit_number resolves via resolveKitByNumber, never a raw database id', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getExportListHandler();

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ entity: 'packs', format: 'xlsx', kit_number: kitNumber });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text as string);
      expect(body.rowCount).toBe(1);
    });
  });

  it('packs: an unknown kit_number surfaces the same NotFoundError as list_packs/resolveKitByNumber', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getExportListHandler();

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ entity: 'packs', format: 'xlsx', kit_number: 999999 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999999 not found/);
    });
  });

  it('items: pack designator (kit_number/pack_number) resolves via resolvePackByDesignator', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getExportListHandler();

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({
        entity: 'items',
        format: 'xlsx',
        pack: { kit_number: kitNumber, pack_number: 1 },
      });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text as string);
      expect(body.rowCount).toBe(0); // pack has no items in this fixture
    });
  });

  it('computers: site_id + kit_number + disposition compose to match (matching list_computers semantics)', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getExportListHandler();

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({
        entity: 'computers', format: 'xlsx', site_id: siteId, kit_number: kitNumber, disposition: 'ACTIVE',
      });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text as string);
      expect(body.rowCount).toBe(1);
    });
  });

  it('computers: composed filters that exclude the fixture computer (wrong disposition) return zero rows', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getExportListHandler();

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({
        entity: 'computers', format: 'xlsx', site_id: siteId, kit_number: kitNumber, disposition: 'LOST',
      });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text as string);
      expect(body.rowCount).toBe(0);
    });
  });

  describe('download_url round trip', () => {
    it('resolves over HTTP to a CSV file whose row count matches the tool response, with no id column', async () => {
      const services = ServiceRegistry.create(getPrisma(), 'MCP');
      const handler = getExportListHandler();

      const result = await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, () =>
        handler({ entity: 'computers', format: 'csv', kit_number: kitNumber }));
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text as string);
      expect(body.rowCount).toBe(1);

      const downloadPath = new URL(body.download_url).pathname;

      const agent = request.agent(app);
      await agent.post('/api/test/login').send({ role: 'QUARTERMASTER' });

      const res = await agent.get(downloadPath);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toContain('computers-export.csv');

      const text: string = res.text;
      const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
      expect(lines.length - 1).toBe(1); // header + 1 data row

      const header = lines[0].split(',').map((h) => h.trim());
      expect(header).toEqual([
        'Host Name', 'Manufacturer', 'Model', 'Model Number', 'Operating System',
        'Manufactured Year', 'Serial Number', 'Service Tag', 'Disposition', 'Site', 'Kit',
        'Custodian', 'Category', 'Date Received', 'Last Inventoried', 'Admin Username',
        'Admin Password', 'Student Username', 'Student Password', 'Notes',
      ]);
      expect(header.some((h) => /^id$/i.test(h))).toBe(false);
    });

    it('mints a distinct token per call, resolvable via GeneratedFileService under the requesting user', async () => {
      const services = ServiceRegistry.create(getPrisma(), 'MCP');
      const handler = getExportListHandler();
      const uid = getUserId();

      const result = await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, () =>
        handler({ entity: 'kits', format: 'xlsx', status: 'ACTIVE' }));
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text as string);
      const token = new URL(body.download_url).pathname.split('/').pop()!;

      const resolution = await services.generatedFiles.resolveForDownload(token, { id: uid, role: 'QUARTERMASTER' });
      expect(resolution.outcome).toBe('ok');
      if (resolution.outcome !== 'ok') return;
      expect(resolution.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(resolution.filename).toBe('kits-export.xlsx');
      expect(resolution.filename).not.toMatch(new RegExp(`\\b${kitId}\\b`));
    });
  });
});
