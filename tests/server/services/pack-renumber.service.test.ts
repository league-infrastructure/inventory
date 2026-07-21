import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { NotFoundError, ValidationError } from '../../../server/src/services/errors';

let siteId: number;

beforeAll(async () => {
  await setupTestUser();
  const site = await getRegistry().sites.create({
    name: `svc-test-${getSuffix()}-renumber-site`,
  }, getUserId());
  siteId = site.id;
});

afterAll(async () => {
  const prisma = getPrisma();
  // This file creates many kits/packs (renumbering needs several packs per
  // kit to be meaningful) — clean up with a handful of batched deleteMany
  // calls rather than one round trip per pack, which was slow enough under
  // full-suite load to exceed jest's default afterAll hook timeout.
  const kits = await prisma.kit.findMany({
    where: { name: { contains: `svc-test-${getSuffix()}-renumber` } },
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
  await prisma.site.deleteMany({ where: { name: { contains: `svc-test-${getSuffix()}-renumber-site` } } });
  await teardown();
}, 30000);

let kitNumber = 0;
function nextKitNumber() { return ++kitNumber + (getSuffix() % 100000); }

/** Creates a kit with `n` packs, created in order (so pack 1 gets displayNumber 1, etc). */
async function createKitWithPacks(n: number, label: string): Promise<{ kitId: number; packIds: number[] }> {
  const kit = await getRegistry().kits.create({
    number: nextKitNumber(),
    name: `svc-test-${getSuffix()}-renumber-${label}`,
    siteId,
  }, getUserId());

  const packIds: number[] = [];
  for (let i = 1; i <= n; i++) {
    const pack = await getRegistry().packs.create({ name: `Pack ${i}` }, getUserId(), kit.id);
    packIds.push(pack.id);
  }
  return { kitId: kit.id, packIds };
}

async function getDisplayNumbers(kitId: number): Promise<number[]> {
  const packs = await getPrisma().pack.findMany({ where: { kitId }, orderBy: { displayNumber: 'asc' } });
  return packs.map((p) => p.displayNumber);
}

async function getDisplayNumberMap(kitId: number): Promise<Map<number, number>> {
  const packs = await getPrisma().pack.findMany({ where: { kitId } });
  return new Map(packs.map((p) => [p.id, p.displayNumber]));
}

describe('PackService.renumber()', () => {
  it('stakeholder example A: renumber pack 7 to 4 in a 7-pack kit', async () => {
    const { kitId, packIds } = await createKitWithPacks(7, 'example-a');
    const [p1, p2, p3, p4, p5, p6, p7] = packIds;

    const result = await getRegistry().packs.renumber(kitId, p7, 4, getUserId());
    const byId = new Map(result.map((p) => [p.id, p.displayNumber]));

    expect(byId.get(p7)).toBe(4);
    expect(byId.get(p4)).toBe(5);
    expect(byId.get(p5)).toBe(6);
    expect(byId.get(p6)).toBe(7);
    // Unaffected packs keep their numbers.
    expect(byId.get(p1)).toBe(1);
    expect(byId.get(p2)).toBe(2);
    expect(byId.get(p3)).toBe(3);

    const numbers = result.map((p) => p.displayNumber).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7]);

    const auditRows = await getPrisma().auditLog.findMany({
      where: { objectType: 'Pack', objectId: { in: packIds }, field: 'displayNumber' },
    });
    const byPack = new Map(auditRows.map((r) => [r.objectId, r]));
    expect(auditRows.length).toBe(4);
    expect(byPack.get(p7)).toMatchObject({ oldValue: '7', newValue: '4' });
    expect(byPack.get(p4)).toMatchObject({ oldValue: '4', newValue: '5' });
    expect(byPack.get(p5)).toMatchObject({ oldValue: '5', newValue: '6' });
    expect(byPack.get(p6)).toMatchObject({ oldValue: '6', newValue: '7' });
    // No audit rows for the packs that didn't change.
    expect(byPack.has(p1)).toBe(false);
    expect(byPack.has(p2)).toBe(false);
    expect(byPack.has(p3)).toBe(false);
  });

  it('stakeholder example B: renumber pack 3 to 6 in a 7-pack kit', async () => {
    const { kitId, packIds } = await createKitWithPacks(7, 'example-b');
    const [p1, p2, p3, p4, p5, p6, p7] = packIds;

    const result = await getRegistry().packs.renumber(kitId, p3, 6, getUserId());
    const byId = new Map(result.map((p) => [p.id, p.displayNumber]));

    // Required by the ticket: old pack 4 becomes 3.
    expect(byId.get(p4)).toBe(3);
    // Remainder renumbers continuously per the sort+renumber algorithm.
    expect(byId.get(p1)).toBe(1);
    expect(byId.get(p2)).toBe(2);
    expect(byId.get(p5)).toBe(4);
    expect(byId.get(p3)).toBe(5);
    expect(byId.get(p6)).toBe(6);
    expect(byId.get(p7)).toBe(7);

    const numbers = result.map((p) => p.displayNumber).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('no-op edit: requesting a pack\'s own current number changes nothing and writes no audit rows', async () => {
    const { kitId, packIds } = await createKitWithPacks(5, 'noop');
    const [, , p3] = packIds;

    const result = await getRegistry().packs.renumber(kitId, p3, 3, getUserId());
    const byId = new Map(result.map((p) => [p.id, p.displayNumber]));
    packIds.forEach((id, idx) => expect(byId.get(id)).toBe(idx + 1));

    const numbers = result.map((p) => p.displayNumber).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);

    const auditRows = await getPrisma().auditLog.findMany({
      where: { objectType: 'Pack', objectId: { in: packIds }, field: 'displayNumber' },
    });
    expect(auditRows.length).toBe(0);
  });

  it('moves a pack to the first position', async () => {
    const { kitId, packIds } = await createKitWithPacks(5, 'move-first');
    const [p1, p2, p3, p4, p5] = packIds;

    const result = await getRegistry().packs.renumber(kitId, p5, 1, getUserId());
    const byId = new Map(result.map((p) => [p.id, p.displayNumber]));

    expect(byId.get(p5)).toBe(1);
    expect(byId.get(p1)).toBe(2);
    expect(byId.get(p2)).toBe(3);
    expect(byId.get(p3)).toBe(4);
    expect(byId.get(p4)).toBe(5);

    const numbers = result.map((p) => p.displayNumber).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
  });

  it('moves a pack to the last position', async () => {
    const { kitId, packIds } = await createKitWithPacks(5, 'move-last');
    const [p1, p2, p3, p4, p5] = packIds;

    // p1 (currently 1) requests 5 (currently held by p5). Moving down ties
    // the edited pack against p5's original number; the edited pack wins
    // the tie and lands at N-1 (4), pushing everything between up by one
    // and leaving p5 — which already held the contested number — unchanged.
    const result = await getRegistry().packs.renumber(kitId, p1, 5, getUserId());
    const byId = new Map(result.map((p) => [p.id, p.displayNumber]));

    expect(byId.get(p1)).toBe(4);
    expect(byId.get(p2)).toBe(1);
    expect(byId.get(p3)).toBe(2);
    expect(byId.get(p4)).toBe(3);
    expect(byId.get(p5)).toBe(5);

    const numbers = result.map((p) => p.displayNumber).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
  });

  it('single-pack kit: requesting 1 is a no-op; anything else is a validation error', async () => {
    const { kitId, packIds } = await createKitWithPacks(1, 'single');
    const [p1] = packIds;

    const result = await getRegistry().packs.renumber(kitId, p1, 1, getUserId());
    expect(result.map((p) => p.displayNumber)).toEqual([1]);

    await expect(getRegistry().packs.renumber(kitId, p1, 2, getUserId())).rejects.toThrow(ValidationError);
    await expect(getRegistry().packs.renumber(kitId, p1, 0, getUserId())).rejects.toThrow(ValidationError);
    await expect(getRegistry().packs.renumber(kitId, p1, -1, getUserId())).rejects.toThrow(ValidationError);

    const numbers = await getDisplayNumbers(kitId);
    expect(numbers).toEqual([1]);
  });

  it('rejects out-of-range requests (0, negative, > N) and leaves all packs unchanged', async () => {
    const { kitId, packIds } = await createKitWithPacks(4, 'out-of-range');
    const before = await getDisplayNumberMap(kitId);

    await expect(getRegistry().packs.renumber(kitId, packIds[0], 0, getUserId())).rejects.toThrow(ValidationError);
    await expect(getRegistry().packs.renumber(kitId, packIds[0], -1, getUserId())).rejects.toThrow(ValidationError);
    await expect(getRegistry().packs.renumber(kitId, packIds[0], 5, getUserId())).rejects.toThrow(ValidationError);

    const after = await getDisplayNumberMap(kitId);
    expect(after).toEqual(before);

    const auditRows = await getPrisma().auditLog.findMany({
      where: { objectType: 'Pack', objectId: { in: packIds }, field: 'displayNumber' },
    });
    expect(auditRows.length).toBe(0);
  });

  it('throws NotFoundError when packId does not belong to kitId', async () => {
    const { kitId: kitA } = await createKitWithPacks(3, 'nf-a');
    const { packIds: packIdsB } = await createKitWithPacks(3, 'nf-b');

    await expect(getRegistry().packs.renumber(kitA, packIdsB[0], 1, getUserId())).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError for a nonexistent kit', async () => {
    await expect(getRegistry().packs.renumber(999999, 1, 1, getUserId())).rejects.toThrow(NotFoundError);
  });
});

describe('PackService.create() displayNumber stamping', () => {
  it('assigns the next sequential displayNumber in a kit that already has packs', async () => {
    const { kitId } = await createKitWithPacks(3, 'create-seq');

    const newPack = await getRegistry().packs.create({ name: 'Fourth Pack' }, getUserId(), kitId);
    expect(newPack.displayNumber).toBe(4);

    const numbers = await getDisplayNumbers(kitId);
    expect(numbers).toEqual([1, 2, 3, 4]);
  });

  it('assigns displayNumber 1 to the first pack in a new kit', async () => {
    const kit = await getRegistry().kits.create({
      number: nextKitNumber(),
      name: `svc-test-${getSuffix()}-renumber-create-first`,
      siteId,
    }, getUserId());

    const pack = await getRegistry().packs.create({ name: 'Only Pack' }, getUserId(), kit.id);
    expect(pack.displayNumber).toBe(1);
  });
});

describe('KitService.clone() displayNumber stamping', () => {
  it('preserves relative pack order (by displayNumber) in the cloned kit', async () => {
    const kit = await getRegistry().kits.create({
      number: nextKitNumber(),
      name: `svc-test-${getSuffix()}-renumber-clone-src`,
      siteId,
    }, getUserId());

    const packA = await getRegistry().packs.create({ name: 'A' }, getUserId(), kit.id);
    await getRegistry().packs.create({ name: 'B' }, getUserId(), kit.id);
    const packC = await getRegistry().packs.create({ name: 'C' }, getUserId(), kit.id);

    // Reorder so relative order differs from creation/id order: C -> 1, A -> 2, B -> 3.
    await getRegistry().packs.renumber(kit.id, packC.id, 1, getUserId());

    const cloned = await getRegistry().kits.clone(kit.id, getUserId());
    const clonedSorted = [...cloned.packs].sort((a, b) => a.displayNumber - b.displayNumber);

    expect(clonedSorted.map((p) => p.name)).toEqual(['C', 'A', 'B']);
    expect(clonedSorted.map((p) => p.displayNumber)).toEqual([1, 2, 3]);
    expect(packA.id).not.toBe(clonedSorted[1].id);
  });
});
