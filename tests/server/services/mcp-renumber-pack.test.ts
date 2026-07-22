/**
 * MCP tool test for `renumber_pack` (ticket 003-002).
 *
 * No MCP tool test conventions exist yet in this repo, so per the ticket's
 * testing guidance this is a focused unit test invoking the registered
 * tool's handler directly (bypassing the transport layer). `registerTools()`
 * only needs an object exposing a `.tool(name, description, schema, handler)`
 * method, so we hand it a minimal fake collector instead of a real
 * `McpServer` — this avoids depending on the SDK's internal registration
 * data structure (and on resolving `@modelcontextprotocol/sdk`'s deep
 * subpath imports from outside `server/src`, which ts-jest's classic module
 * resolution cannot do from this directory).
 */
import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { ServiceRegistry } from '../../../server/src/services/service.registry';
import { registerTools } from '../../../server/src/mcp/tools';
import { mcpContext } from '../../../server/src/mcp/context';
import type { User } from '@prisma/client';

let siteId: number;

beforeAll(async () => {
  await setupTestUser();
  const site = await getRegistry().sites.create({
    name: `svc-test-${getSuffix()}-mcp-renumber-site`,
  }, getUserId());
  siteId = site.id;
});

afterAll(async () => {
  const prisma = getPrisma();
  const kits = await prisma.kit.findMany({
    where: { name: { contains: `svc-test-${getSuffix()}-mcp-renumber` } },
    select: { id: true },
  });
  const kitIds = kits.map((k) => k.id);
  if (kitIds.length > 0) {
    const packs = await prisma.pack.findMany({ where: { kitId: { in: kitIds } }, select: { id: true } });
    const packIds = packs.map((p) => p.id);
    if (packIds.length > 0) {
      await prisma.item.deleteMany({ where: { packId: { in: packIds } } });
      await prisma.auditLog.deleteMany({ where: { objectType: 'Pack', objectId: { in: packIds } } });
      await prisma.pack.deleteMany({ where: { id: { in: packIds } } });
    }
    await prisma.kit.deleteMany({ where: { id: { in: kitIds } } });
  }
  await prisma.site.deleteMany({ where: { name: { contains: `svc-test-${getSuffix()}-mcp-renumber-site` } } });
  await teardown();
}, 30000);

let kitNumber = 0;
function nextKitNumber() { return ++kitNumber + (getSuffix() % 100000) + 70000; }

/** Creates a kit with `n` packs, created in order (so pack 1 gets displayNumber 1, etc). */
async function createKitWithPacks(n: number, label: string): Promise<{ kitId: number; packIds: number[] }> {
  const kit = await getRegistry().kits.create({
    number: nextKitNumber(),
    name: `svc-test-${getSuffix()}-mcp-renumber-${label}`,
    siteId,
  }, getUserId());

  const packIds: number[] = [];
  for (let i = 1; i <= n; i++) {
    const pack = await getRegistry().packs.create({ name: `Pack ${i}` }, getUserId(), kit.id);
    packIds.push(pack.id);
  }
  return { kitId: kit.id, packIds };
}

type ToolHandler = (args: any) => Promise<{ isError?: boolean; content: { type: string; text: string }[] }>;

/**
 * Registers the real tool set (via the production `registerTools()`) onto a
 * minimal fake server that just records each tool's handler by name, then
 * returns the `renumber_pack` handler.
 */
function getRenumberPackHandler(): ToolHandler {
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
  const handler = handlers.get('renumber_pack');
  if (!handler) throw new Error('renumber_pack tool was not registered');
  return handler;
}

/**
 * Same fake-collector pattern as `getRenumberPackHandler`, for the
 * `update_pack` tool (ticket 004-002).
 */
function getUpdatePackHandler(): ToolHandler {
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
  const handler = handlers.get('update_pack');
  if (!handler) throw new Error('update_pack tool was not registered');
  return handler;
}

function fakeUser(role: string): User {
  return { id: getUserId(), role } as User;
}

describe('renumber_pack MCP tool', () => {
  it('requires Quartermaster access', async () => {
    const { packIds } = await createKitWithPacks(3, 'access');
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getRenumberPackHandler();

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ id: packIds[0], displayNumber: 2 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Quartermaster access required/);
    });
  });

  it('returns 404-equivalent tool error for a nonexistent pack', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getRenumberPackHandler();

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ id: 999999, displayNumber: 1 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/not found/i);
    });
  });

  it('produces the same final assignment as the equivalent REST/service call, and records source: MCP vs UI', async () => {
    // UI path: call PackService.renumber() directly through the default
    // (UI-source) registry that setup.ts wires up.
    const uiScenario = await createKitWithPacks(7, 'ui-path');
    const uiEdited = uiScenario.packIds[6]; // last pack, like stakeholder example A
    const uiResult = await getRegistry().packs.renumber(uiScenario.kitId, uiEdited, 4, getUserId());
    // Express each pack's outcome as (its position among the original packIds) -> new displayNumber,
    // so the UI and MCP scenarios (built from independent kits) can be compared structurally.
    const uiByPosition = new Map(
      uiResult.map((p) => [uiScenario.packIds.indexOf(p.id), p.displayNumber]),
    );

    // MCP path: identical starting shape (7 freshly-created packs) and
    // identical edit (last pack -> 4), driven through the renumber_pack tool.
    const mcpScenario = await createKitWithPacks(7, 'mcp-path');
    const mcpEdited = mcpScenario.packIds[6];
    const mcpServices = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getRenumberPackHandler();

    let mcpBody: any;
    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services: mcpServices }, async () => {
      const result = await handler({ id: mcpEdited, displayNumber: 4 });
      expect(result.isError).toBeFalsy();
      mcpBody = JSON.parse(result.content[0].text);
    });
    const mcpByPosition = new Map(
      mcpBody.map((p: any) => [mcpScenario.packIds.indexOf(p.id), p.displayNumber]),
    );

    expect(mcpByPosition).toEqual(uiByPosition);

    // Audit source threading: UI-driven renumber -> source UI; MCP-driven -> source MCP.
    const uiAudit = await getPrisma().auditLog.findMany({
      where: { objectType: 'Pack', objectId: { in: uiScenario.packIds }, field: 'displayNumber' },
    });
    expect(uiAudit.length).toBeGreaterThan(0);
    expect(uiAudit.every((r) => r.source === 'UI')).toBe(true);

    const mcpAudit = await getPrisma().auditLog.findMany({
      where: { objectType: 'Pack', objectId: { in: mcpScenario.packIds }, field: 'displayNumber' },
    });
    expect(mcpAudit.length).toBeGreaterThan(0);
    expect(mcpAudit.every((r) => r.source === 'MCP')).toBe(true);
  });
});

describe('update_pack MCP tool (ticket 004-002)', () => {
  it('with displayNumber produces the same final assignment as renumber_pack for an equivalent input, sourced MCP', async () => {
    // renumber_pack path (already exercised above): pack 7 of 7 -> 4.
    const renumberScenario = await createKitWithPacks(7, 'update-pack-cmp-renumber');
    const renumberEdited = renumberScenario.packIds[6];
    const renumberServices = ServiceRegistry.create(getPrisma(), 'MCP');
    const renumberHandler = getRenumberPackHandler();

    let renumberBody: any;
    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services: renumberServices }, async () => {
      const result = await renumberHandler({ id: renumberEdited, displayNumber: 4 });
      expect(result.isError).toBeFalsy();
      renumberBody = JSON.parse(result.content[0].text);
    });
    const renumberByPosition = new Map(
      renumberBody.map((p: any) => [renumberScenario.packIds.indexOf(p.id), p.displayNumber]),
    );

    // update_pack path: identical starting shape and identical edit, driven
    // through update_pack instead of renumber_pack.
    const updateScenario = await createKitWithPacks(7, 'update-pack-cmp-update');
    const updateEdited = updateScenario.packIds[6];
    const updateServices = ServiceRegistry.create(getPrisma(), 'MCP');
    const updateHandler = getUpdatePackHandler();

    let updateBody: any;
    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services: updateServices }, async () => {
      const result = await updateHandler({ id: updateEdited, displayNumber: 4 });
      expect(result.isError).toBeFalsy();
      updateBody = JSON.parse(result.content[0].text);
    });

    // Contiguity invariant: full-list response, 1..N with no gaps.
    expect(Array.isArray(updateBody)).toBe(true);
    expect(updateBody).toHaveLength(7);
    const numbers = updateBody.map((p: any) => p.displayNumber).sort((a: number, b: number) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7]);

    const updateByPosition = new Map(
      updateBody.map((p: any) => [updateScenario.packIds.indexOf(p.id), p.displayNumber]),
    );
    expect(updateByPosition).toEqual(renumberByPosition);

    // Audit source: MCP.
    const updateAudit = await getPrisma().auditLog.findMany({
      where: { objectType: 'Pack', objectId: { in: updateScenario.packIds }, field: 'displayNumber' },
    });
    expect(updateAudit.length).toBeGreaterThan(0);
    expect(updateAudit.every((r) => r.source === 'MCP')).toBe(true);
  });

  it('with name/description only is unaffected: still returns a single pack record, no renumber', async () => {
    const { packIds } = await createKitWithPacks(3, 'update-pack-name-only');
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getUpdatePackHandler();

    let body: any;
    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ id: packIds[0], name: 'Renamed Pack' });
      expect(result.isError).toBeFalsy();
      body = JSON.parse(result.content[0].text);
    });

    // Single record, not the renumbered kit list.
    expect(Array.isArray(body)).toBe(false);
    expect(body.id).toBe(packIds[0]);
    expect(body.name).toBe('Renamed Pack');

    // No renumber side effect: displayNumbers untouched, no displayNumber audit rows.
    const after = await getPrisma().pack.findMany({
      where: { id: { in: packIds } },
      orderBy: { displayNumber: 'asc' },
    });
    expect(after.map((p) => p.displayNumber)).toEqual([1, 2, 3]);

    const displayNumberAudit = await getPrisma().auditLog.findMany({
      where: { objectType: 'Pack', objectId: { in: packIds }, field: 'displayNumber' },
    });
    expect(displayNumberAudit).toHaveLength(0);
  });

  it('rejects an out-of-range displayNumber with no packs changed', async () => {
    const { kitId, packIds } = await createKitWithPacks(3, 'update-pack-out-of-range');
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getUpdatePackHandler();

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ id: packIds[0], displayNumber: 10 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/must be an integer between/i);
    });

    const after = await getPrisma().pack.findMany({ where: { kitId }, orderBy: { displayNumber: 'asc' } });
    expect(after.map((p) => p.displayNumber)).toEqual([1, 2, 3]);
  });
});
