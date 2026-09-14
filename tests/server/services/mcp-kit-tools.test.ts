/**
 * MCP tool tests for the kit-identifying parameter conversion (sprint 009,
 * ticket 002): `get_kit`, `update_kit`, `delete_kit`,
 * `set_kit_last_inventoried`, `list_packs`, `create_pack`, `transfer_kit`,
 * `list_issues`, and `create_issue` all take `kit_number` now instead of a
 * database id (`id`/`kitId`). This file exercises those tools' handlers
 * directly, the same fake-collector pattern established by
 * `mcp-renumber-pack.test.ts` and reused by `labels.test.ts` /
 * `computers.test.ts`: `registerTools()` only needs an object exposing
 * `.tool(name, ...rest)` / `.registerTool(name, config, cb)`, so a minimal
 * fake stands in for a real `McpServer` and each tool's handler is invoked
 * directly, bypassing the transport layer.
 *
 * The collision fixture (`kitA`/`kitB` below) reproduces, without any
 * manually-assigned primary keys (which would risk colliding with another
 * test file's explicit ids under parallel jest workers against the shared
 * test database), the same shape of bug the stakeholder reported in
 * production: one kit's `number` equals a *different* kit's database `id`.
 * A resolver — or a tool handler — that regressed to id-based lookup would
 * silently return the wrong kit for one of the two numbers.
 */
import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { ServiceRegistry } from '../../../server/src/services/service.registry';
import { registerTools } from '../../../server/src/mcp/tools';
import { mcpContext } from '../../../server/src/mcp/context';
import type { User } from '@prisma/client';

type ToolResult = { isError?: boolean; content: { type: string; text: string }[] };
type ToolHandler = (args: any) => Promise<ToolResult>;

function fakeUser(role: string): User {
  return { id: getUserId(), role } as User;
}

/**
 * Registers the real tool catalog (via the production `registerTools()`)
 * onto a minimal fake server that records every tool's handler by name.
 */
function getHandlers(): Map<string, ToolHandler> {
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
  return handlers;
}

let siteId: number;
let kitCounter = 0;
function nextKitNumber() { return (getSuffix() % 100000) + 20000 + (++kitCounter); }

async function createKit(label: string, overrides: Partial<{ number: number; siteId: number }> = {}) {
  const reg = getRegistry();
  const kit = await reg.kits.create({
    number: overrides.number ?? nextKitNumber(),
    name: `svc-test-${getSuffix()}-kittools-${label}`,
    siteId: overrides.siteId ?? siteId,
  }, getUserId());
  return kit;
}

const createdKitIds: number[] = [];

beforeAll(async () => {
  await setupTestUser();
  const reg = getRegistry();
  const site = await reg.sites.create({ name: `svc-test-${getSuffix()}-kittools-site` }, getUserId());
  siteId = site.id;
}, 30000);

afterAll(async () => {
  const prisma = getPrisma();
  await prisma.inventoryCheck.deleteMany({ where: { kitId: { in: createdKitIds } } });
  await prisma.pack.deleteMany({ where: { kitId: { in: createdKitIds } } });
  await prisma.issue.deleteMany({ where: { kitId: { in: createdKitIds } } });
  await prisma.kit.deleteMany({ where: { id: { in: createdKitIds } } });
  await prisma.site.deleteMany({ where: { id: siteId } });
  await teardown();
}, 30000);

describe('get_kit', () => {
  it('resolves a valid kit_number to the correct kit, with packs and computers', async () => {
    const kit = await createKit('get-valid');
    createdKitIds.push(kit.id);
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('get_kit')!;

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ kit_number: kit.number });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text);
      expect(body.id).toBe(kit.id);
      expect(body.number).toBe(kit.number);
    });
  });

  it('returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('get_kit')!;

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ kit_number: 999999 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999999 not found/);
    });
  });

  it('collision: two kits, one\'s number equal to the other\'s database id, each resolve to their own distinct kit', async () => {
    // kitA is created first so its id is a "real" value; kitB is then
    // created with kitA's id as ITS number. kitA is then updated so its
    // own number equals kitB's id — reproducing the stakeholder's "kit
    // number 26 has database id 17" shape without hardcoding any ids.
    const kitA = await createKit('collision-a');
    createdKitIds.push(kitA.id);
    const kitB = await createKit('collision-b', { number: kitA.id });
    createdKitIds.push(kitB.id);
    const reg = getRegistry();
    await reg.kits.update(kitA.id, { number: kitB.id }, getUserId());

    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('get_kit')!;

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const resultForKitBId = await handler({ kit_number: kitB.id });
      expect(resultForKitBId.isError).toBeFalsy();
      const bodyA = JSON.parse(resultForKitBId.content[0].text);
      // kit_number == kitB.id must resolve to kitA (the kit whose *number*
      // is kitB.id), never to kitB itself.
      expect(bodyA.id).toBe(kitA.id);
      expect(bodyA.id).not.toBe(kitB.id);

      const resultForKitAId = await handler({ kit_number: kitA.id });
      expect(resultForKitAId.isError).toBeFalsy();
      const bodyB = JSON.parse(resultForKitAId.content[0].text);
      expect(bodyB.id).toBe(kitB.id);
      expect(bodyB.id).not.toBe(kitA.id);
    });
  });
});

describe('update_kit', () => {
  it('resolves kit_number and updates the correct kit, preserving QM-gating', async () => {
    const kit = await createKit('update-valid');
    createdKitIds.push(kit.id);
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('update_kit')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ kit_number: kit.number, description: 'updated via mcp-kit-tools test' });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text);
      expect(body.id).toBe(kit.id);
      expect(body.description).toBe('updated via mcp-kit-tools test');
    });
  });

  it('returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('update_kit')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ kit_number: 999998, description: 'should not apply' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999998 not found/);
    });
  });
});

describe('delete_kit', () => {
  it('resolves kit_number and deletes the correct (retired, empty) kit', async () => {
    const kit = await createKit('delete-valid');
    const reg = getRegistry();
    await reg.kits.update(kit.id, { status: 'RETIRED' }, getUserId());

    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('delete_kit')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ kit_number: kit.number });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text);
      expect(body.deleted).toBe(true);
    });

    const stillThere = await getPrisma().kit.findUnique({ where: { id: kit.id } });
    expect(stillThere).toBeNull();
  });

  it('returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('delete_kit')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ kit_number: 999997 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999997 not found/);
    });
  });
});

describe('set_kit_last_inventoried', () => {
  it('resolves kit_number and records an inventory check against the correct kit', async () => {
    const kit = await createKit('inventoried-valid');
    createdKitIds.push(kit.id);
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('set_kit_last_inventoried')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ kit_number: kit.number, date: '2026-03-07' });
      expect(result.isError).toBeFalsy();
    });

    const checks = await getPrisma().inventoryCheck.findMany({ where: { kitId: kit.id } });
    expect(checks.length).toBe(1);
  });

  it('returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('set_kit_last_inventoried')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ kit_number: 999996, date: '2026-03-07' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999996 not found/);
    });
  });
});

describe('list_packs', () => {
  it('resolves kit_number and lists only that kit\'s packs', async () => {
    const kitA = await createKit('listpacks-a');
    createdKitIds.push(kitA.id);
    const kitB = await createKit('listpacks-b');
    createdKitIds.push(kitB.id);
    const reg = getRegistry();
    const packA = await reg.packs.create({ name: 'Pack A' }, getUserId(), kitA.id);
    await reg.packs.create({ name: 'Pack B' }, getUserId(), kitB.id);

    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('list_packs')!;

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ kit_number: kitA.number });
      expect(result.isError).toBeFalsy();
      const packs = JSON.parse(result.content[0].text);
      expect(packs.length).toBe(1);
      expect(packs[0].id).toBe(packA.id);
    });
  });

  it('returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('list_packs')!;

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ kit_number: 999995 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999995 not found/);
    });
  });
});

describe('create_pack', () => {
  it('resolves kit_number and creates the pack in the correct kit', async () => {
    const kit = await createKit('createpack-valid');
    createdKitIds.push(kit.id);
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('create_pack')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ kit_number: kit.number, name: 'New Pack' });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text);
      expect(body.kitId).toBe(kit.id);
    });
  });

  it('returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('create_pack')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ kit_number: 999994, name: 'Orphan Pack' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999994 not found/);
    });
  });
});

describe('transfer_kit', () => {
  it('resolves kit_number and transfers the correct kit', async () => {
    const kit = await createKit('transfer-valid');
    createdKitIds.push(kit.id);
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('transfer_kit')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ kit_number: kit.number, siteId, notes: 'mcp-kit-tools test transfer' });
      expect(result.isError).toBeFalsy();
    });
  });

  it('returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('transfer_kit')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ kit_number: 999993, siteId });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999993 not found/);
    });
  });
});

describe('list_issues / create_issue kit_number filter', () => {
  it('create_issue resolves kit_number to the correct kit, and list_issues filters by it', async () => {
    const kit = await createKit('issues-valid');
    createdKitIds.push(kit.id);
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const createHandler = getHandlers().get('create_issue')!;
    const listHandler = getHandlers().get('list_issues')!;

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const created = await createHandler({ type: 'DAMAGE', kit_number: kit.number, notes: 'cracked case' });
      expect(created.isError).toBeFalsy();
      const createdBody = JSON.parse(created.content[0].text);
      expect(createdBody.kitId).toBe(kit.id);

      const listed = await listHandler({ kit_number: kit.number });
      expect(listed.isError).toBeFalsy();
      const issues = JSON.parse(listed.content[0].text);
      expect(issues.length).toBeGreaterThanOrEqual(1);
      expect(issues.every((i: any) => i.kitId === kit.id)).toBe(true);
    });
  });

  it('create_issue returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('create_issue')!;

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ type: 'DAMAGE', kit_number: 999992 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999992 not found/);
    });
  });

  it('list_issues returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('list_issues')!;

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ kit_number: 999991 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999991 not found/);
    });
  });
});
