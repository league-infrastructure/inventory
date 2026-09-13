/**
 * MCP tool tests for the pack-identifying parameter conversion (sprint 009,
 * ticket 003): `update_pack`, `delete_pack`, `renumber_pack`, `list_items`,
 * `create_item`, `list_issues`, `create_issue`, and `generate_labels` all
 * take a pack designator now — structured `{kit_number, pack_number}` or
 * the combined `"kit_number/pack_number"` string — instead of a database id
 * (`id`/`packId`/`pack_ids`). `renumber_pack` and `update_pack`'s
 * displayNumber-editing behavior are already covered in depth by
 * `mcp-renumber-pack.test.ts` (updated by this ticket to use the new
 * designator); this file covers the remaining converted tools plus the
 * tool-layer collision guarantee.
 *
 * Same fake-collector pattern as `mcp-kit-tools.test.ts` /
 * `mcp-renumber-pack.test.ts`: `registerTools()` only needs an object
 * exposing `.tool(name, ...rest)` / `.registerTool(name, config, cb)`, so a
 * minimal fake stands in for a real `McpServer` and each tool's handler is
 * invoked directly, bypassing the transport layer (and, with it, zod
 * validation — the schema itself is exercised end-to-end by
 * `ai-chat-mcp-unification.test.ts`, which calls through a real MCP
 * client).
 *
 * The collision fixture below reproduces, without any manually-assigned
 * primary keys (which would risk colliding with another test file's
 * explicit ids under parallel jest workers against the shared test
 * database), the same shape of confusion the old `id`-based pack
 * parameters were vulnerable to: a pack designator whose *kit_number* half
 * equals a *different pack's own database id*. A tool that regressed to
 * id-based lookup for any part of the designator would silently operate on
 * the wrong pack.
 */
import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { ServiceRegistry } from '../../../server/src/services/service.registry';
import { registerTools } from '../../../server/src/mcp/tools';
import { mcpContext } from '../../../server/src/mcp/context';
import type { User } from '@prisma/client';

type ToolResult = { isError?: boolean; content: { type: string; text?: string }[] };
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
function nextKitNumber() { return (getSuffix() % 100000) + 30000 + (++kitCounter); }

async function createKit(label: string, overrides: Partial<{ number: number; siteId: number }> = {}) {
  const reg = getRegistry();
  const kit = await reg.kits.create({
    number: overrides.number ?? nextKitNumber(),
    name: `svc-test-${getSuffix()}-packtools-${label}`,
    siteId: overrides.siteId ?? siteId,
  }, getUserId());
  return kit;
}

/** Creates a pack in the given kit. Packs are numbered 1..N in creation order. */
async function createPack(kitId: number, name: string) {
  const reg = getRegistry();
  return reg.packs.create({ name }, getUserId(), kitId);
}

const createdKitIds: number[] = [];

beforeAll(async () => {
  await setupTestUser();
  const reg = getRegistry();
  const site = await reg.sites.create({ name: `svc-test-${getSuffix()}-packtools-site` }, getUserId());
  siteId = site.id;
}, 30000);

afterAll(async () => {
  const prisma = getPrisma();
  const packs = await prisma.pack.findMany({ where: { kitId: { in: createdKitIds } }, select: { id: true } });
  const packIds = packs.map((p) => p.id);
  if (packIds.length > 0) {
    await prisma.item.deleteMany({ where: { packId: { in: packIds } } });
    await prisma.issue.deleteMany({ where: { packId: { in: packIds } } });
    await prisma.auditLog.deleteMany({ where: { objectType: 'Pack', objectId: { in: packIds } } });
  }
  await prisma.pack.deleteMany({ where: { kitId: { in: createdKitIds } } });
  await prisma.issue.deleteMany({ where: { kitId: { in: createdKitIds } } });
  await prisma.kit.deleteMany({ where: { id: { in: createdKitIds } } });
  await prisma.site.deleteMany({ where: { id: siteId } });
  await teardown();
}, 30000);

describe('delete_pack', () => {
  it('resolves a valid designator and deletes the correct pack', async () => {
    const kit = await createKit('delete-valid');
    createdKitIds.push(kit.id);
    const pack = await createPack(kit.id, 'Pack To Delete');
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('delete_pack')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ pack: { kit_number: kit.number, pack_number: pack.displayNumber } });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text!);
      expect(body.deleted).toBe(true);
    });

    const stillThere = await getPrisma().pack.findUnique({ where: { id: pack.id } });
    expect(stillThere).toBeNull();
  });

  it('resolves the combined "kit_number/pack_number" string form identically', async () => {
    const kit = await createKit('delete-string');
    createdKitIds.push(kit.id);
    const pack = await createPack(kit.id, 'Pack To Delete Via String');
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('delete_pack')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ pack: `${kit.number}/${pack.displayNumber}` });
      expect(result.isError).toBeFalsy();
    });

    const stillThere = await getPrisma().pack.findUnique({ where: { id: pack.id } });
    expect(stillThere).toBeNull();
  });

  it('returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('delete_pack')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ pack: { kit_number: 999989, pack_number: 1 } });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999989 not found/);
    });
  });

  it('returns an explicit not-found error for an unknown pack-within-kit', async () => {
    const kit = await createKit('delete-unknown-pack');
    createdKitIds.push(kit.id);
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('delete_pack')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ pack: { kit_number: kit.number, pack_number: 9 } });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(new RegExp(`Pack ${kit.number}/9 not found`));
    });
  });
});

describe('list_items', () => {
  it('resolves a valid pack designator and lists only that pack\'s items', async () => {
    const kit = await createKit('listitems');
    createdKitIds.push(kit.id);
    const packA = await createPack(kit.id, 'Pack A');
    const packB = await createPack(kit.id, 'Pack B');
    const reg = getRegistry();
    const itemA = await reg.items.create({ name: 'Item A', type: 'CONSUMABLE' } as any, getUserId(), packA.id);
    await reg.items.create({ name: 'Item B', type: 'CONSUMABLE' } as any, getUserId(), packB.id);

    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('list_items')!;

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ pack: { kit_number: kit.number, pack_number: packA.displayNumber } });
      expect(result.isError).toBeFalsy();
      const items = JSON.parse(result.content[0].text!);
      expect(items.length).toBe(1);
      expect(items[0].id).toBe(itemA.id);
    });
  });

  it('returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('list_items')!;

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ pack: { kit_number: 999988, pack_number: 1 } });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999988 not found/);
    });
  });

  it('returns an explicit not-found error for an unknown pack-within-kit', async () => {
    const kit = await createKit('listitems-unknown-pack');
    createdKitIds.push(kit.id);
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('list_items')!;

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ pack: { kit_number: kit.number, pack_number: 9 } });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(new RegExp(`Pack ${kit.number}/9 not found`));
    });
  });
});

describe('create_item', () => {
  it('resolves a valid pack designator and creates the item in the correct pack', async () => {
    const kit = await createKit('createitem');
    createdKitIds.push(kit.id);
    const pack = await createPack(kit.id, 'Pack For Item');
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('create_item')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({
        pack: { kit_number: kit.number, pack_number: pack.displayNumber },
        name: 'New Item',
        type: 'CONSUMABLE',
      });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text!);
      expect(body.packId).toBe(pack.id);
    });
  });

  it('returns an explicit not-found error for an unknown kit_number', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('create_item')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({
        pack: { kit_number: 999987, pack_number: 1 },
        name: 'Orphan Item',
        type: 'CONSUMABLE',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999987 not found/);
    });
  });
});

describe('list_issues / create_issue pack filter', () => {
  it('create_issue resolves a pack designator to the correct pack, and list_issues filters by it', async () => {
    const kit = await createKit('issues-pack');
    createdKitIds.push(kit.id);
    const pack = await createPack(kit.id, 'Pack For Issue');
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const createHandler = getHandlers().get('create_issue')!;
    const listHandler = getHandlers().get('list_issues')!;

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const created = await createHandler({
        type: 'DAMAGE',
        pack: { kit_number: kit.number, pack_number: pack.displayNumber },
        notes: 'torn strap',
      });
      expect(created.isError).toBeFalsy();
      const createdBody = JSON.parse(created.content[0].text!);
      expect(createdBody.packId).toBe(pack.id);

      const listed = await listHandler({ pack: { kit_number: kit.number, pack_number: pack.displayNumber } });
      expect(listed.isError).toBeFalsy();
      const issues = JSON.parse(listed.content[0].text!);
      expect(issues.length).toBeGreaterThanOrEqual(1);
      expect(issues.every((i: any) => i.packId === pack.id)).toBe(true);
    });
  });

  it('create_issue returns an explicit not-found error for an unknown kit_number in its pack designator', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('create_issue')!;

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ type: 'DAMAGE', pack: { kit_number: 999986, pack_number: 1 } });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999986 not found/);
    });
  });

  it('list_issues returns an explicit not-found error for an unknown pack-within-kit', async () => {
    const kit = await createKit('issues-unknown-pack');
    createdKitIds.push(kit.id);
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('list_issues')!;

    await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
      const result = await handler({ pack: { kit_number: kit.number, pack_number: 9 } });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(new RegExp(`Pack ${kit.number}/9 not found`));
    });
  });
});

describe('generate_labels packs designators', () => {
  it('resolves a packs array of designators to the correct packs', async () => {
    const kit = await createKit('genlabels-packs');
    createdKitIds.push(kit.id);
    const pack = await createPack(kit.id, 'Pack For Labels');
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('generate_labels')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ packs: [{ kit_number: kit.number, pack_number: pack.displayNumber }] });
      expect(result.isError).toBeFalsy();
      const manifest = JSON.parse(result.content[0].text as string);
      expect(manifest.bundles).toHaveLength(1);
      expect(manifest.bundles[0].labelCount).toBe(1);
    });
  });

  it('accepts the combined string designator form in the packs array', async () => {
    const kit = await createKit('genlabels-packs-string');
    createdKitIds.push(kit.id);
    const pack = await createPack(kit.id, 'Pack For Labels String');
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('generate_labels')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ packs: [`${kit.number}/${pack.displayNumber}`] });
      expect(result.isError).toBeFalsy();
      const manifest = JSON.parse(result.content[0].text as string);
      expect(manifest.bundles).toHaveLength(1);
    });
  });

  it('propagates an explicit not-found error for an unknown pack designator', async () => {
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('generate_labels')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      const result = await handler({ packs: [{ kit_number: 999985, pack_number: 1 }] });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Kit number 999985 not found/);
    });
  });
});

describe('pack designator collision guard (update_pack)', () => {
  it('never falls back to id-based lookup: a pack designator whose kit_number equals a different pack\'s own database id resolves to the correct pack', async () => {
    // packA: an ordinary pack, created first so its database id is a "real"
    // value that exists independently of any kit_number in this test.
    const kitA = await createKit('collision-a');
    createdKitIds.push(kitA.id);
    const packA = await createPack(kitA.id, 'Pack A (collision source)');

    // kitB's number is then set to packA's own database id, and packB is
    // its first (displayNumber 1) pack — reproducing, without hardcoding
    // any ids, the exact shape of confusion the old `id`-based pack
    // parameters were vulnerable to: "packA.id" is simultaneously a real
    // Pack primary key AND, here, a valid kit_number for a *different*
    // kit/pack entirely.
    const kitB = await createKit('collision-b', { number: packA.id });
    createdKitIds.push(kitB.id);
    const packB = await createPack(kitB.id, 'Pack B (collision target)');

    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const handler = getHandlers().get('update_pack')!;

    await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services }, async () => {
      // Designator {kit_number: packA.id, pack_number: 1} must resolve to
      // packB (the pack whose kit's *number* is packA.id), never to packA
      // itself — a regression to id-based lookup would return packA here.
      const result = await handler({
        pack: { kit_number: packA.id, pack_number: 1 },
        name: 'Renamed via collision designator',
      });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text!);
      expect(body.id).toBe(packB.id);
      expect(body.id).not.toBe(packA.id);
      expect(body.name).toBe('Renamed via collision designator');
    });

    // packA itself must be untouched.
    const packAAfter = await getPrisma().pack.findUnique({ where: { id: packA.id } });
    expect(packAAfter!.name).toBe('Pack A (collision source)');
  });
});
