import request from 'supertest';

process.env.NODE_ENV = 'test';

import app from '../../server/src/app';
import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './services/setup';
import { ServiceRegistry } from '../../server/src/services/service.registry';
import { registerTools } from '../../server/src/mcp/tools';
import { mcpContext } from '../../server/src/mcp/context';
import type { User } from '@prisma/client';

describe('Label endpoints', () => {
  describe('GET /api/labels/kit/:id', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/labels/kit/1');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/labels/pack/:id', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/labels/pack/1');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/labels/computer/:id', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/labels/computer/1');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/labels/kit/:id/batch', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/labels/kit/1/batch')
        .send({ packIds: [] });
      expect(res.status).toBe(401);
    });
  });
});

// ─── generate_labels MCP tool (ticket 008-002) ───────────────────────────
//
// No REST route backs this tool — it is registered directly on the MCP
// server. Following the fake-collector pattern established by
// tests/server/services/mcp-renumber-pack.test.ts and
// mcp-tool-metadata.test.ts: registerTools() only needs an object exposing
// `.tool(name, ...rest)` / `.registerTool(name, config, cb)`, so a minimal
// fake stands in for a real McpServer and the tool's handler is invoked
// directly, bypassing the transport layer. Fixtures reuse the
// tests/server/services/setup.ts helper (live test DB via ServiceRegistry),
// the same fixture pattern ticket 001 used in
// tests/server/services/label.service.test.ts.

type GenerateLabelsResult = {
  isError?: boolean;
  content: { type: string; text?: string; resource?: { uri: string; mimeType: string; blob: string } }[];
};
type ToolHandler = (args: any) => Promise<GenerateLabelsResult>;

function fakeUser(role: string): User {
  return { id: getUserId(), role } as User;
}

/**
 * Registers the real tool catalog (via the production `registerTools()`)
 * onto a minimal fake server that records each tool's handler by name, then
 * returns the `generate_labels` handler.
 */
function getGenerateLabelsHandler(): ToolHandler {
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
  const handler = handlers.get('generate_labels');
  if (!handler) throw new Error('generate_labels tool was not registered');
  return handler;
}

describe('generate_labels MCP tool', () => {
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

    const site = await reg.sites.create({ name: `svc-test-${suffix}-genlabels-site` }, uid);
    siteId = site.id;

    kitNumber = (suffix % 100000) + 900;
    const kit = await reg.kits.create({ number: kitNumber, name: `svc-test-${suffix}-genlabels-kit`, siteId }, uid);
    kitId = kit.id;

    const pack = await reg.packs.create({ name: `svc-test-${suffix}-genlabels-pack` }, uid, kitId);
    packId = pack.id;

    const computer = await reg.computers.create({
      model: `svc-test-${suffix}-genlabels-computer`,
      serialNumber: 'SN-GENLABELS-TEST',
      kitId,
      siteId,
    }, uid);
    computerId = computer.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.item.deleteMany({ where: { packId } });
    await prisma.computer.deleteMany({ where: { id: computerId } });
    await prisma.pack.deleteMany({ where: { kitId } });
    await prisma.kit.deleteMany({ where: { id: kitId } });
    await prisma.site.deleteMany({ where: { id: siteId } });
    await teardown();
  });

  it('returns a toolError naming the three accepted parameters for an empty selection, without calling the service', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getGenerateLabelsHandler();
    const generateLabelSetSpy = jest.spyOn(services.labels, 'generateLabelSet');

    try {
      await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
        const result = await handler({});
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toMatch(/kit_ids/);
        expect(result.content[0].text).toMatch(/pack_ids/);
        expect(result.content[0].text).toMatch(/computer_ids/);
      });
      expect(generateLabelSetSpy).not.toHaveBeenCalled();
    } finally {
      generateLabelSetSpy.mockRestore();
    }
  });

  it('returns a toolError stating the actual count for a selection over the 60-label cap, without calling the service', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getGenerateLabelsHandler();
    const generateLabelSetSpy = jest.spyOn(services.labels, 'generateLabelSet');

    // 61 fake computer IDs — the cap check must reject before any
    // resolution/rendering, so these need not exist in the DB.
    const computerIds = Array.from({ length: 61 }, (_, i) => -(i + 1));

    try {
      await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
        const result = await handler({ computer_ids: computerIds });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toMatch(/61/);
        expect(result.content[0].text).toMatch(/60/);
      });
      expect(generateLabelSetSpy).not.toHaveBeenCalled();
    } finally {
      generateLabelSetSpy.mockRestore();
    }
  });

  it('returns a text manifest and one resource block for a valid single-kit selection with include_kit_packs', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getGenerateLabelsHandler();

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ kit_ids: [kitId], include_kit_packs: true });
      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(2);

      expect(result.content[0].type).toBe('text');
      const manifest = JSON.parse(result.content[0].text as string);
      expect(manifest.bundles).toHaveLength(1);
      expect(manifest.bundles[0].stock).toBe('102x59');
      expect(manifest.bundles[0].labelCount).toBe(2); // the kit + its one pack
      expect(manifest.bundles[0].contents.some((c: string) => c.includes(String(kitNumber)))).toBe(true);
      // Raw PDF bytes must be omitted from the text manifest.
      expect(JSON.stringify(manifest)).not.toMatch(/%PDF-/);

      expect(result.content[1].type).toBe('resource');
      const resource = result.content[1].resource!;
      expect(resource.uri).toBe('inventory://labels/102x59.pdf');
      expect(resource.mimeType).toBe('application/pdf');
      const pdfBuffer = Buffer.from(resource.blob, 'base64');
      expect(pdfBuffer.subarray(0, 5).toString()).toBe('%PDF-');
    });
  });

  it('returns two resource blocks for a mixed kit+computer selection', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getGenerateLabelsHandler();

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ kit_ids: [kitId], computer_ids: [computerId] });
      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(3); // 1 text block + 2 resource blocks

      const manifest = JSON.parse(result.content[0].text as string);
      expect(manifest.bundles).toHaveLength(2);
      const stocks = manifest.bundles.map((b: any) => b.stock).sort();
      expect(stocks).toEqual(['102x59', '89x28']);

      const resourceBlocks = result.content.slice(1);
      expect(resourceBlocks.every((b) => b.type === 'resource')).toBe(true);
      const uris = resourceBlocks.map((b) => b.resource!.uri).sort();
      expect(uris).toEqual(['inventory://labels/102x59.pdf', 'inventory://labels/89x28.pdf'].sort());
    });
  });

  it('does not require Quartermaster role — a non-QM authenticated caller succeeds', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getGenerateLabelsHandler();

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ kit_ids: [kitId] });
      expect(result.isError).toBeFalsy();
      const manifest = JSON.parse(result.content[0].text as string);
      expect(manifest.bundles).toHaveLength(1);
    });
  });

  it('propagates NotFoundError for an unknown kit ID as a tool error', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getGenerateLabelsHandler();

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ kit_ids: [999999] });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit 999999 not found/);
    });
  });
});
