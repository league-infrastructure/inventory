process.env.NODE_ENV = 'test';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://app:devpassword@localhost:5434/app';
}

import { PrismaClient, User } from '@prisma/client';
import { createAuthAgent, createUnauthenticatedAgent } from './helpers/auth';
import { setupTestUser, teardown as teardownServices, getRegistry, getUserId, getSuffix, getPrisma } from './services/setup';
import { ServiceRegistry } from '../../server/src/services/service.registry';
import { registerTools } from '../../server/src/mcp/tools';
import { mcpContext } from '../../server/src/mcp/context';

const prisma = new PrismaClient();

describe('Computers API', () => {
  const agent = createAuthAgent('QUARTERMASTER');
  const unauthed = createUnauthenticatedAgent();
  const createdIds: number[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await prisma.hostName.updateMany({ where: { computerId: id }, data: { computerId: null } });
      await prisma.computer.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('GET /api/computers', () => {
    it('returns 200 with array', async () => {
      const res = await agent.get('/api/computers');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 401 for unauthenticated request', async () => {
      const res = await unauthed.get('/api/computers');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/computers', () => {
    it('creates a computer and returns 201 with QR code', async () => {
      const res = await agent
        .post('/api/computers')
        .send({ serialNumber: 'SN-TEST-001', model: 'ThinkPad T14' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      createdIds.push(res.body.id);
      expect(res.body.qrCode).toMatch(/^\/c\/\d+$/);
      expect(res.body.serialNumber).toBe('SN-TEST-001');
      expect(res.body.model).toBe('ThinkPad T14');
      expect(res.body.disposition).toBe('ACTIVE');
    });

    it('rejects a computer with no identifying fields', async () => {
      const res = await agent
        .post('/api/computers')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/identifying field/i);
    });

    it('returns 400 for invalid disposition', async () => {
      const res = await agent
        .post('/api/computers')
        .send({ model: 'Test', disposition: 'INVALID' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/computers/:id', () => {
    it('returns 200 with computer detail', async () => {
      // Create one first
      const created = await agent
        .post('/api/computers')
        .send({ model: 'Detail Test' });
      expect(created.status).toBe(201);
      createdIds.push(created.body.id);

      const res = await agent.get(`/api/computers/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.model).toBe('Detail Test');
      expect(res.body).toHaveProperty('hostName');
      expect(res.body).toHaveProperty('site');
      expect(res.body).toHaveProperty('kit');
    });

    it('returns 404 for nonexistent ID', async () => {
      const res = await agent.get('/api/computers/999999');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/computers/:id', () => {
    it('updates fields and returns 200', async () => {
      const created = await agent
        .post('/api/computers')
        .send({ model: 'Before Update' });
      createdIds.push(created.body.id);

      const res = await agent
        .put(`/api/computers/${created.body.id}`)
        .send({ model: 'After Update', notes: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.model).toBe('After Update');
      expect(res.body.notes).toBe('Updated');
    });

    it('returns 404 for nonexistent ID', async () => {
      const res = await agent
        .put('/api/computers/999999')
        .send({ model: 'Nope' });
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/computers/:id/disposition', () => {
    it('changes disposition', async () => {
      const created = await agent
        .post('/api/computers')
        .send({ model: 'Disposition Test' });
      createdIds.push(created.body.id);

      const res = await agent
        .patch(`/api/computers/${created.body.id}/disposition`)
        .send({ disposition: 'NEEDS_REPAIR' });
      expect(res.status).toBe(200);
      expect(res.body.disposition).toBe('NEEDS_REPAIR');
    });

    it('returns 400 for invalid disposition', async () => {
      const created = await agent
        .post('/api/computers')
        .send({ model: 'Disposition Invalid Test' });
      createdIds.push(created.body.id);

      const res = await agent
        .patch(`/api/computers/${created.body.id}/disposition`)
        .send({ disposition: 'BOGUS' });
      expect(res.status).toBe(400);
    });
  });
});

// ─── list_computers MCP tool filter pass-through (ticket 008-003) ────────
//
// `list_computers` previously took an empty `{}` schema even though
// ComputerService.list() already implemented siteId/kitId/disposition/
// unassigned filtering. Following the fake-collector pattern established by
// tests/server/services/mcp-renumber-pack.test.ts and reused by
// tests/server/labels.test.ts for generate_labels: registerTools() only
// needs an object exposing `.tool(name, ...rest)` / `.registerTool(name,
// config, cb)`, so a minimal fake stands in for a real McpServer and the
// tool's handler is invoked directly, bypassing the transport layer.

type ListComputersResult = { isError?: boolean; content: { type: string; text: string }[] };
type ToolHandler = (args: any) => Promise<ListComputersResult>;

function fakeUser(role: string): User {
  return { id: getUserId(), role } as User;
}

/**
 * Registers the real tool catalog (via the production `registerTools()`)
 * onto a minimal fake server that records each tool's handler by name, then
 * returns the `list_computers` handler.
 */
function getListComputersHandler(): ToolHandler {
  return getMcpToolHandler('list_computers');
}

/**
 * Same fake-collector pattern, generalized to fetch any tool's handler by
 * name (used by the create_computer/update_computer kit_number tests
 * below, ticket 009-002).
 */
function getMcpToolHandler(name: string): ToolHandler {
  const handlers = new Map<string, ToolHandler>();
  const fakeServer = {
    tool: (n: string, ...rest: any[]) => {
      handlers.set(n, rest[rest.length - 1]);
    },
    registerTool: (n: string, _config: any, cb: ToolHandler) => {
      handlers.set(n, cb);
    },
    prompt: () => {},
  };
  registerTools(fakeServer as any);
  const handler = handlers.get(name);
  if (!handler) throw new Error(`${name} tool was not registered`);
  return handler;
}

describe('list_computers MCP tool filters (ticket 008-003 / 009-002)', () => {
  let siteId: number;
  let kitId: number;
  let kitNumber: number;
  let otherKitId: number;
  let otherKitNumber: number;
  let activeComputerId: number;
  let lostComputerId: number;
  let unassignedComputerId: number;

  beforeAll(async () => {
    await setupTestUser();
    const reg = getRegistry();
    const uid = getUserId();
    const suffix = getSuffix();

    const site = await reg.sites.create({ name: `svc-test-${suffix}-listcomp-site` }, uid);
    siteId = site.id;

    kitNumber = (suffix % 100000) + 840;
    const kit = await reg.kits.create({ number: kitNumber, name: `svc-test-${suffix}-listcomp-kit`, siteId }, uid);
    kitId = kit.id;

    otherKitNumber = (suffix % 100000) + 841;
    const otherKit = await reg.kits.create({ number: otherKitNumber, name: `svc-test-${suffix}-listcomp-other-kit`, siteId }, uid);
    otherKitId = otherKit.id;

    const activeComputer = await reg.computers.create({
      model: `svc-test-${suffix}-listcomp-active`,
      serialNumber: 'SN-LISTCOMP-ACTIVE',
      kitId,
      siteId,
    }, uid);
    activeComputerId = activeComputer.id;

    const lostComputer = await reg.computers.create({
      model: `svc-test-${suffix}-listcomp-lost`,
      serialNumber: 'SN-LISTCOMP-LOST',
      kitId: otherKitId,
      siteId,
    }, uid);
    lostComputerId = lostComputer.id;
    await reg.computers.changeDisposition(lostComputerId, 'LOST', uid);

    const unassignedComputer = await reg.computers.create({
      model: `svc-test-${suffix}-listcomp-unassigned`,
      serialNumber: 'SN-LISTCOMP-UNASSIGNED',
    }, uid);
    unassignedComputerId = unassignedComputer.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.computer.deleteMany({ where: { id: { in: [activeComputerId, lostComputerId, unassignedComputerId] } } });
    await prisma.kit.deleteMany({ where: { id: { in: [kitId, otherKitId] } } });
    await prisma.site.deleteMany({ where: { id: siteId } });
    await teardownServices();
  });

  it('passes each provided filter straight through to ComputerService.list unchanged', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getListComputersHandler();
    const listSpy = jest.spyOn(services.computers, 'list');

    try {
      await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
        await handler({ site_id: siteId, kit_number: kitNumber, disposition: 'ACTIVE', unassigned: true });
      });
      expect(listSpy).toHaveBeenCalledWith({ siteId, kitId, disposition: 'ACTIVE', unassigned: true });
    } finally {
      listSpy.mockRestore();
    }
  });

  it('narrows to a kit when kit_number is provided', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getListComputersHandler();

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ kit_number: kitNumber });
      expect(result.isError).toBeFalsy();
      const list = JSON.parse(result.content[0].text as string);
      expect(list.every((c: any) => c.kitId === kitId)).toBe(true);
      expect(list.some((c: any) => c.id === activeComputerId)).toBe(true);
      expect(list.some((c: any) => c.id === lostComputerId)).toBe(false);
    });
  });

  it('returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getListComputersHandler();

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ kit_number: 999990 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999990 not found/);
    });
  });

  it('narrows to a disposition when disposition is provided', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getListComputersHandler();

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ disposition: 'LOST' });
      expect(result.isError).toBeFalsy();
      const list = JSON.parse(result.content[0].text as string);
      expect(list.every((c: any) => c.disposition === 'LOST')).toBe(true);
      expect(list.some((c: any) => c.id === lostComputerId)).toBe(true);
      expect(list.some((c: any) => c.id === activeComputerId)).toBe(false);
    });
  });

  it('narrows to unassigned computers when unassigned is provided', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getListComputersHandler();

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ unassigned: true });
      expect(result.isError).toBeFalsy();
      const list = JSON.parse(result.content[0].text as string);
      expect(list.every((c: any) => c.siteId === null && c.kitId === null)).toBe(true);
      expect(list.some((c: any) => c.id === unassignedComputerId)).toBe(true);
      expect(list.some((c: any) => c.id === activeComputerId)).toBe(false);
    });
  });

  it('composes more than one filter at once (kit_number + disposition)', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getListComputersHandler();

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ kit_number: otherKitNumber, disposition: 'LOST' });
      expect(result.isError).toBeFalsy();
      const list = JSON.parse(result.content[0].text as string);
      expect(list.some((c: any) => c.id === lostComputerId)).toBe(true);
      expect(list.every((c: any) => c.kitId === otherKitId && c.disposition === 'LOST')).toBe(true);
    });
  });

  it('omitting all filters returns the full computer list, unchanged in shape (no regression)', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getListComputersHandler();

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({});
      expect(result.isError).toBeFalsy();
      const list = JSON.parse(result.content[0].text as string);
      expect(Array.isArray(list)).toBe(true);
      const ids = list.map((c: any) => c.id);
      expect(ids).toEqual(expect.arrayContaining([activeComputerId, lostComputerId, unassignedComputerId]));
    });
  });

  // ─── create_computer / update_computer kit_number (ticket 009-002) ────

  it('create_computer resolves kit_number to the correct kit', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getMcpToolHandler('create_computer');
    let createdId: number | undefined;

    try {
      await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
        const result = await handler({
          model: `svc-test-${getSuffix()}-listcomp-createcomputer`,
          serialNumber: 'SN-LISTCOMP-CREATE',
          kit_number: kitNumber,
        });
        expect(result.isError).toBeFalsy();
        const body = JSON.parse(result.content[0].text as string);
        expect(body.kitId).toBe(kitId);
        createdId = body.id;
      });
    } finally {
      if (createdId) await getPrisma().computer.delete({ where: { id: createdId } }).catch(() => {});
    }
  });

  it('create_computer returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getMcpToolHandler('create_computer');

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({
        model: `svc-test-${getSuffix()}-listcomp-createcomputer-badkit`,
        serialNumber: 'SN-LISTCOMP-CREATE-BAD',
        kit_number: 999989,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999989 not found/);
    });
  });

  it('update_computer resolves kit_number to set a computer\'s kit, and preserves null-clearing semantics', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const reg = getRegistry();
    const uid = getUserId();
    const suffix = getSuffix();
    const computer = await reg.computers.create({
      model: `svc-test-${suffix}-listcomp-updatecomputer`,
      serialNumber: 'SN-LISTCOMP-UPDATE',
    }, uid);

    try {
      const handler = getMcpToolHandler('update_computer');

      await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
        const setResult = await handler({ id: computer.id, kit_number: kitNumber });
        expect(setResult.isError).toBeFalsy();
        const setBody = JSON.parse(setResult.content[0].text as string);
        expect(setBody.kitId).toBe(kitId);

        const clearResult = await handler({ id: computer.id, kit_number: null });
        expect(clearResult.isError).toBeFalsy();
        const clearBody = JSON.parse(clearResult.content[0].text as string);
        expect(clearBody.kitId).toBeNull();
      });
    } finally {
      await getPrisma().computer.delete({ where: { id: computer.id } }).catch(() => {});
    }
  });

  it('update_computer returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const reg = getRegistry();
    const uid = getUserId();
    const suffix = getSuffix();
    const computer = await reg.computers.create({
      model: `svc-test-${suffix}-listcomp-updatecomputer-badkit`,
      serialNumber: 'SN-LISTCOMP-UPDATE-BAD',
    }, uid);

    try {
      const handler = getMcpToolHandler('update_computer');
      await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
        const result = await handler({ id: computer.id, kit_number: 999988 });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toMatch(/Kit number 999988 not found/);
      });
    } finally {
      await getPrisma().computer.delete({ where: { id: computer.id } }).catch(() => {});
    }
  });
});
