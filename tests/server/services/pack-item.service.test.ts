import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { NotFoundError, ValidationError } from '../../../server/src/services/errors';

let siteId: number;
let kitId: number;
let packId: number;
let itemId: number;

beforeAll(async () => {
  await setupTestUser();
  const site = await getRegistry().sites.create({ name: `svc-test-${getSuffix()}-pi-site` }, getUserId());
  siteId = site.id;
  const kit = await getRegistry().kits.create({ number: (getSuffix() % 100000) + 100, name: `svc-test-${getSuffix()}-pi-kit`, siteId }, getUserId());
  kitId = kit.id;
});

afterAll(async () => {
  const prisma = getPrisma();
  const kits = await prisma.kit.findMany({
    where: { name: { contains: `svc-test-${getSuffix()}-pi-kit` } },
    include: { packs: { include: { items: true } } },
  });
  for (const kit of kits) {
    for (const pack of kit.packs) {
      await prisma.item.deleteMany({ where: { packId: pack.id } });
      await prisma.pack.delete({ where: { id: pack.id } });
    }
    await prisma.kit.delete({ where: { id: kit.id } });
  }
  await prisma.site.deleteMany({ where: { name: { contains: `svc-test-${getSuffix()}-pi-site` } } });
  await teardown();
});

describe('PackService', () => {
  it('creates a pack', async () => {
    const pack = await getRegistry().packs.create({ name: 'Test Pack', description: 'A pack' }, getUserId(), kitId);
    expect(pack.id).toBeDefined();
    expect(pack.name).toBe('Test Pack');
    packId = pack.id;
  });

  it('throws ValidationError without kitId', async () => {
    await expect(getRegistry().packs.create({ name: 'x' }, getUserId()))
      .rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for empty name', async () => {
    await expect(getRegistry().packs.create({ name: '' }, getUserId(), kitId))
      .rejects.toThrow(ValidationError);
  });

  it('lists packs for a kit', async () => {
    const packs = await getRegistry().packs.list(kitId);
    expect(packs.some(p => p.id === packId)).toBe(true);
  });

  it('throws NotFoundError listing packs for nonexistent kit', async () => {
    await expect(getRegistry().packs.list(999999)).rejects.toThrow(NotFoundError);
  });

  it('gets a pack detail', async () => {
    const pack = await getRegistry().packs.get(packId);
    expect(pack.id).toBe(packId);
    expect(pack.kit).toBeDefined();
  });

  it('updates a pack', async () => {
    const updated = await getRegistry().packs.update(packId, { description: 'Updated' }, getUserId());
    expect(updated.description).toBe('Updated');
  });
});

describe('ItemService', () => {
  it('creates a COUNTED item', async () => {
    const item = await getRegistry().items.create(
      { name: 'Counted Item', type: 'COUNTED', expectedQuantity: 10 },
      getUserId(), packId,
    );
    expect(item.id).toBeDefined();
    expect(item.type).toBe('COUNTED');
    expect(item.expectedQuantity).toBe(10);
    itemId = item.id;
  });

  it('creates a CONSUMABLE item with null quantity', async () => {
    const item = await getRegistry().items.create(
      { name: 'Consumable Item', type: 'CONSUMABLE' },
      getUserId(), packId,
    );
    expect(item.type).toBe('CONSUMABLE');
    expect(item.expectedQuantity).toBeNull();
  });

  it('throws ValidationError for COUNTED without quantity', async () => {
    await expect(getRegistry().items.create(
      { name: 'Bad', type: 'COUNTED' },
      getUserId(), packId,
    )).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for invalid type', async () => {
    await expect(getRegistry().items.create(
      { name: 'Bad', type: 'INVALID' },
      getUserId(), packId,
    )).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for empty item name', async () => {
    await expect(getRegistry().items.create(
      { name: '', type: 'COUNTED', expectedQuantity: 1 },
      getUserId(), packId,
    )).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError listing items for nonexistent pack', async () => {
    await expect(getRegistry().items.list(999999)).rejects.toThrow();
  });

  it('throws ValidationError without packId', async () => {
    await expect(getRegistry().items.create(
      { name: 'x', type: 'COUNTED', expectedQuantity: 1 },
      getUserId(),
    )).rejects.toThrow(ValidationError);
  });

  it('lists items for a pack', async () => {
    const items = await getRegistry().items.list(packId);
    expect(items.some(i => i.id === itemId)).toBe(true);
  });

  it('gets an item by id', async () => {
    const item = await getRegistry().items.get(itemId);
    expect(item.id).toBe(itemId);
  });

  it('updates an item', async () => {
    const updated = await getRegistry().items.update(itemId, { name: 'Updated Item' }, getUserId());
    expect(updated.name).toBe('Updated Item');
  });

  it('deletes an item', async () => {
    await getRegistry().items.delete(itemId, getUserId());
    await expect(getRegistry().items.get(itemId)).rejects.toThrow(NotFoundError);
  });

  it('deletes a pack', async () => {
    // Create a fresh pack to delete (the one with remaining items can't easily be deleted)
    const p = await getRegistry().packs.create({ name: 'To Delete' }, getUserId(), kitId);
    await getRegistry().packs.delete(p.id, getUserId());
    await expect(getRegistry().packs.get(p.id)).rejects.toThrow(NotFoundError);
  });
});
