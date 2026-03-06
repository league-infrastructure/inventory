import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { NotFoundError, ValidationError } from '../../../server/src/services/errors';

let siteId: number;
let kitId: number;
let checkoutId: number;

beforeAll(async () => {
  await setupTestUser();
  const site = await getRegistry().sites.create({ name: `svc-test-${getSuffix()}-co-site` }, getUserId());
  siteId = site.id;
  const kit = await getRegistry().kits.create({ number: (getSuffix() % 100000) + 200, name: `svc-test-${getSuffix()}-co-kit`, siteId }, getUserId());
  kitId = kit.id;
});

afterAll(async () => {
  const prisma = getPrisma();
  await prisma.checkout.deleteMany({ where: { kit: { name: { contains: `svc-test-${getSuffix()}-co-kit` } } } });
  const kits = await prisma.kit.findMany({ where: { name: { contains: `svc-test-${getSuffix()}-co-kit` } } });
  for (const k of kits) await prisma.kit.delete({ where: { id: k.id } });
  await prisma.site.deleteMany({ where: { name: { contains: `svc-test-${getSuffix()}-co-site` } } });
  await teardown();
});

describe('CheckoutService', () => {
  it('checks out a kit', async () => {
    const co = await getRegistry().checkouts.checkOut({
      kitId,
      destinationSiteId: siteId,
    }, getUserId());

    expect(co.id).toBeDefined();
    expect(co.kitId).toBe(kitId);
    expect(co.checkedInAt).toBeNull();
    checkoutId = co.id;
  });

  it('throws ValidationError for double checkout', async () => {
    await expect(getRegistry().checkouts.checkOut({
      kitId,
      destinationSiteId: siteId,
    }, getUserId())).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for missing kitId', async () => {
    await expect(getRegistry().checkouts.checkOut({
      kitId: 0,
      destinationSiteId: siteId,
    } as any, getUserId())).rejects.toThrow(ValidationError);
  });

  it('lists open checkouts', async () => {
    const list = await getRegistry().checkouts.list('open');
    expect(list.some(c => c.id === checkoutId)).toBe(true);
  });

  it('lists all checkouts', async () => {
    const list = await getRegistry().checkouts.list('all');
    expect(list.length).toBeGreaterThan(0);
  });

  it('gets checkout by id', async () => {
    const co = await getRegistry().checkouts.get(checkoutId);
    expect(co.id).toBe(checkoutId);
  });

  it('gets checkout history for kit', async () => {
    const history = await getRegistry().checkouts.getHistory(kitId);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].kitId).toBe(kitId);
  });

  it('checks in a kit', async () => {
    const co = await getRegistry().checkouts.checkIn(checkoutId, {
      returnSiteId: siteId,
    }, getUserId());

    expect(co.checkedInAt).not.toBeNull();
    expect(co.returnSiteId).toBe(siteId);
  });

  it('throws ValidationError checking in already checked in', async () => {
    await expect(getRegistry().checkouts.checkIn(checkoutId, {
      returnSiteId: siteId,
    }, getUserId())).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError for nonexistent checkout', async () => {
    await expect(getRegistry().checkouts.checkIn(999999, {
      returnSiteId: siteId,
    }, getUserId())).rejects.toThrow(NotFoundError);
  });

  it('lists closed checkouts', async () => {
    const list = await getRegistry().checkouts.list('closed');
    expect(list.some(c => c.id === checkoutId)).toBe(true);
  });

  it('create delegates to checkOut', async () => {
    // Create a fresh kit for this test
    const kit2 = await getRegistry().kits.create({ number: (getSuffix() % 100000) + 201, name: `svc-test-${getSuffix()}-co-kit2`, siteId }, getUserId());
    const co = await getRegistry().checkouts.create({
      kitId: kit2.id,
      destinationSiteId: siteId,
    }, getUserId());
    expect(co.kitId).toBe(kit2.id);
    // Check in so cleanup works
    await getRegistry().checkouts.checkIn(co.id, { returnSiteId: siteId }, getUserId());
  });

  it('update delegates to checkIn', async () => {
    const kit3 = await getRegistry().kits.create({ number: (getSuffix() % 100000) + 202, name: `svc-test-${getSuffix()}-co-kit3`, siteId }, getUserId());
    const co = await getRegistry().checkouts.checkOut({ kitId: kit3.id, destinationSiteId: siteId }, getUserId());
    const result = await getRegistry().checkouts.update(co.id, { returnSiteId: siteId }, getUserId());
    expect(result.checkedInAt).not.toBeNull();
  });

  it('throws ValidationError for missing destinationSiteId', async () => {
    await expect(getRegistry().checkouts.checkOut({
      kitId,
      destinationSiteId: 0,
    } as any, getUserId())).rejects.toThrow(ValidationError);
  });
});
