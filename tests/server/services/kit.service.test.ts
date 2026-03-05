import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { NotFoundError, ValidationError } from '../../../server/src/services/errors';

let siteId: number;
let kitId: number;

beforeAll(async () => {
  await setupTestUser();
  const site = await getRegistry().sites.create({
    name: `svc-test-${getSuffix()}-kit-site`,
  }, getUserId());
  siteId = site.id;
});

afterAll(async () => {
  const prisma = getPrisma();
  // Delete kits and their packs/items
  const kits = await prisma.kit.findMany({
    where: { name: { contains: `svc-test-${getSuffix()}` } },
    include: { packs: { include: { items: true } } },
  });
  for (const kit of kits) {
    for (const pack of kit.packs) {
      await prisma.item.deleteMany({ where: { packId: pack.id } });
      await prisma.pack.delete({ where: { id: pack.id } });
    }
    await prisma.kit.delete({ where: { id: kit.id } });
  }
  await prisma.site.deleteMany({ where: { name: { contains: `svc-test-${getSuffix()}-kit-site` } } });
  await teardown();
});

describe('KitService', () => {
  it('creates a kit', async () => {
    const kit = await getRegistry().kits.create({
      name: `svc-test-${getSuffix()}-kit`,
      description: 'Test kit',
      siteId,
    }, getUserId());

    expect(kit.id).toBeDefined();
    expect(kit.name).toBe(`svc-test-${getSuffix()}-kit`);
    expect(kit.qrCode).toBe(`/k/${kit.id}`);
    kitId = kit.id;
  });

  it('throws ValidationError for missing name', async () => {
    await expect(getRegistry().kits.create({ name: '', siteId }, getUserId()))
      .rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for missing siteId', async () => {
    await expect(getRegistry().kits.create({ name: 'x', siteId: 0 } as any, getUserId()))
      .rejects.toThrow(ValidationError);
  });

  it('gets a kit detail', async () => {
    const kit = await getRegistry().kits.get(kitId);
    expect(kit.id).toBe(kitId);
    expect(kit.packs).toBeDefined();
    expect(kit.computers).toBeDefined();
  });

  it('throws NotFoundError for nonexistent kit', async () => {
    await expect(getRegistry().kits.get(999999)).rejects.toThrow(NotFoundError);
  });

  it('lists kits', async () => {
    const kits = await getRegistry().kits.list();
    expect(kits.some(k => k.id === kitId)).toBe(true);
  });

  it('lists kits with status filter', async () => {
    const active = await getRegistry().kits.list('ACTIVE');
    expect(active.every(k => k.status === 'ACTIVE')).toBe(true);
  });

  it('updates a kit', async () => {
    const updated = await getRegistry().kits.update(kitId, {
      description: 'Updated desc',
    }, getUserId());
    expect(updated.description).toBe('Updated desc');
  });

  it('update throws ValidationError for empty name', async () => {
    await expect(getRegistry().kits.update(kitId, { name: '' }, getUserId()))
      .rejects.toThrow(ValidationError);
  });

  it('update throws ValidationError for invalid siteId', async () => {
    await expect(getRegistry().kits.update(kitId, { siteId: 'bad' as any }, getUserId()))
      .rejects.toThrow(ValidationError);
  });

  it('clones a kit with packs and items', async () => {
    // Add a pack with an item first
    const pack = await getRegistry().packs.create({ name: 'Clone Pack' }, getUserId(), kitId);
    await getRegistry().items.create({ name: 'Clone Item', type: 'COUNTED', expectedQuantity: 5 }, getUserId(), pack.id);

    const cloned = await getRegistry().kits.clone(kitId, getUserId());
    expect(cloned.name).toBe(`svc-test-${getSuffix()}-kit (Copy)`);
    expect(cloned.packs.length).toBe(1);
    expect(cloned.packs[0].items.length).toBe(1);
    expect(cloned.id).not.toBe(kitId);
  });

  it('retires a kit', async () => {
    const retired = await getRegistry().kits.retire(kitId, getUserId());
    expect(retired.status).toBe('RETIRED');
  });

  it('throws ValidationError retiring already retired', async () => {
    await expect(getRegistry().kits.retire(kitId, getUserId()))
      .rejects.toThrow(ValidationError);
  });
});
