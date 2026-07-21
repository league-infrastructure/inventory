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
    prompt: () => {},
  };
  registerTools(fakeServer as any);
  const handler = handlers.get('renumber_pack');
  if (!handler) throw new Error('renumber_pack tool was not registered');
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
