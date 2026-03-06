import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';

let siteId: number;
let kitId: number;
let packId: number;
let itemCountedId: number;
let itemConsumableId: number;
let computerId: number;

beforeAll(async () => {
  await setupTestUser();
  const reg = getRegistry();
  const uid = getUserId();

  const site = await reg.sites.create({ name: `svc-test-${getSuffix()}-ic-site` }, uid);
  siteId = site.id;

  const kit = await reg.kits.create({
    number: (getSuffix() % 100000) + 500,
    name: `svc-test-${getSuffix()}-ic-kit`,
    siteId,
  }, uid);
  kitId = kit.id;

  const pack = await reg.packs.create({ name: `svc-test-${getSuffix()}-ic-pack` }, uid, kitId);
  packId = pack.id;

  const countedItem = await reg.items.create({
    name: `svc-test-${getSuffix()}-ic-counted`,
    type: 'COUNTED',
    expectedQuantity: 5,
  }, uid, packId);
  itemCountedId = countedItem.id;

  const consumableItem = await reg.items.create({
    name: `svc-test-${getSuffix()}-ic-consumable`,
    type: 'CONSUMABLE',
  }, uid, packId);
  itemConsumableId = consumableItem.id;

  const computer = await reg.computers.create({
    model: `svc-test-${getSuffix()}-ic-computer`,
    kitId,
    siteId,
  }, uid);
  computerId = computer.id;
});

afterAll(async () => {
  const prisma = getPrisma();
  await prisma.inventoryCheckLine.deleteMany({ where: { inventoryCheck: { kitId } } });
  await prisma.inventoryCheckLine.deleteMany({ where: { inventoryCheck: { packId } } });
  await prisma.inventoryCheck.deleteMany({ where: { kitId } });
  await prisma.inventoryCheck.deleteMany({ where: { packId } });
  await prisma.item.deleteMany({ where: { packId } });
  await prisma.pack.deleteMany({ where: { kitId } });
  await prisma.computer.deleteMany({ where: { id: computerId } });
  await prisma.kit.deleteMany({ where: { id: kitId } });
  await prisma.site.deleteMany({ where: { id: siteId } });
  await teardown();
});

describe('InventoryCheckService', () => {
  let kitCheckId: number;

  it('starts a kit check with correct lines', async () => {
    const check = await getRegistry().inventoryChecks.startKitCheck(kitId, getUserId());
    expect(check.id).toBeDefined();
    expect(check.kitId).toBe(kitId);
    // Should have 2 items + 1 computer = 3 lines
    expect(check.lines.length).toBe(3);

    const itemLines = check.lines.filter((l) => l.objectType === 'Item');
    const computerLines = check.lines.filter((l) => l.objectType === 'Computer');
    expect(itemLines.length).toBe(2);
    expect(computerLines.length).toBe(1);

    // Counted item should have "5" as expected
    const countedLine = itemLines.find((l) => l.objectId === itemCountedId);
    expect(countedLine?.expectedValue).toBe('5');

    // Consumable item should have "present" as expected
    const consumableLine = itemLines.find((l) => l.objectId === itemConsumableId);
    expect(consumableLine?.expectedValue).toBe('present');

    // Computer should have "present" as expected
    expect(computerLines[0].expectedValue).toBe('present');

    kitCheckId = check.id;
  });

  it('submits a check with no discrepancies', async () => {
    const check = await getRegistry().inventoryChecks.getCheck(kitCheckId);
    const lines = check.lines.map((l) => ({
      id: l.id,
      actualValue: l.expectedValue!,
    }));

    const result = await getRegistry().inventoryChecks.submitCheck(
      kitCheckId,
      { lines, notes: 'All good' },
      getUserId(),
    );

    expect(result.discrepancyCount).toBe(0);
    expect(result.notes).toBe('All good');
    expect(result.lines.every((l) => !l.hasDiscrepancy)).toBe(true);
  });

  it('starts another kit check and submits with discrepancies', async () => {
    const check = await getRegistry().inventoryChecks.startKitCheck(kitId, getUserId());

    const lines = check.lines.map((l) => {
      if (l.objectId === itemCountedId) {
        return { id: l.id, actualValue: '3' }; // Expected 5, found 3
      }
      if (l.objectId === itemConsumableId) {
        return { id: l.id, actualValue: 'absent' }; // Expected present, found absent
      }
      return { id: l.id, actualValue: l.expectedValue! };
    });

    const result = await getRegistry().inventoryChecks.submitCheck(
      check.id,
      { lines },
      getUserId(),
    );

    expect(result.discrepancyCount).toBe(2);

    const discrepancies = result.lines.filter((l) => l.hasDiscrepancy);
    expect(discrepancies.length).toBe(2);
  });

  it('updates computer lastInventoried when present', async () => {
    const before = await getPrisma().computer.findUnique({ where: { id: computerId } });

    const check = await getRegistry().inventoryChecks.startKitCheck(kitId, getUserId());
    const lines = check.lines.map((l) => ({
      id: l.id,
      actualValue: l.objectType === 'Computer' ? 'present' : l.expectedValue!,
    }));

    await getRegistry().inventoryChecks.submitCheck(check.id, { lines }, getUserId());

    const after = await getPrisma().computer.findUnique({ where: { id: computerId } });
    expect(after!.lastInventoried).not.toBeNull();
    if (before?.lastInventoried) {
      expect(after!.lastInventoried!.getTime()).toBeGreaterThanOrEqual(before.lastInventoried.getTime());
    }
  });

  it('starts a pack check with correct lines', async () => {
    const check = await getRegistry().inventoryChecks.startPackCheck(packId, getUserId());
    expect(check.packId).toBe(packId);
    expect(check.lines.length).toBe(2); // 2 items in the pack
  });

  it('gets check history for kit', async () => {
    const history = await getRegistry().inventoryChecks.getHistory(kitId);
    expect(history.length).toBeGreaterThanOrEqual(3); // We created at least 3 kit checks
    expect(history[0].kitId).toBe(kitId);
  });

  it('gets check history for pack', async () => {
    const history = await getRegistry().inventoryChecks.getHistory(undefined, packId);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].packId).toBe(packId);
  });

  it('throws NotFoundError for nonexistent kit', async () => {
    await expect(
      getRegistry().inventoryChecks.startKitCheck(999999, getUserId()),
    ).rejects.toThrow('Kit not found');
  });

  it('throws NotFoundError for nonexistent pack', async () => {
    await expect(
      getRegistry().inventoryChecks.startPackCheck(999999, getUserId()),
    ).rejects.toThrow('Pack not found');
  });

  it('throws NotFoundError for nonexistent check', async () => {
    await expect(
      getRegistry().inventoryChecks.getCheck(999999),
    ).rejects.toThrow('Inventory check not found');
  });
});
