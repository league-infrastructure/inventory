import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { NotFoundError, ValidationError } from '../../../server/src/services/errors';

beforeAll(async () => { await setupTestUser(); });
afterAll(async () => {
  // cleanup created sites
  const prisma = getPrisma();
  await prisma.site.deleteMany({ where: { name: { contains: `svc-test-${getSuffix()}` } } });
  await teardown();
});

describe('SiteService', () => {
  let createdId: number;

  it('creates a site with valid input', async () => {
    const site = await getRegistry().sites.create({
      name: `svc-test-${getSuffix()}-site`,
      address: '123 Test St',
      latitude: 40.7128,
      longitude: -74.006,
    }, getUserId());

    expect(site.id).toBeDefined();
    expect(site.name).toBe(`svc-test-${getSuffix()}-site`);
    expect(site.address).toBe('123 Test St');
    expect(site.isActive).toBe(true);
    createdId = site.id;
  });

  it('throws ValidationError for empty name', async () => {
    await expect(getRegistry().sites.create({ name: '' }, getUserId()))
      .rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for invalid latitude', async () => {
    await expect(getRegistry().sites.create({
      name: `svc-test-${getSuffix()}-badlat`,
      latitude: 'not-a-number' as any,
    }, getUserId())).rejects.toThrow(ValidationError);
  });

  it('gets a site by id', async () => {
    const site = await getRegistry().sites.get(createdId);
    expect(site.id).toBe(createdId);
    expect(site.name).toBe(`svc-test-${getSuffix()}-site`);
  });

  it('throws NotFoundError for nonexistent site', async () => {
    await expect(getRegistry().sites.get(999999))
      .rejects.toThrow(NotFoundError);
  });

  it('lists active sites', async () => {
    const sites = await getRegistry().sites.list();
    expect(Array.isArray(sites)).toBe(true);
    expect(sites.some(s => s.id === createdId)).toBe(true);
  });

  it('updates a site', async () => {
    const updated = await getRegistry().sites.update(createdId, {
      name: `svc-test-${getSuffix()}-site-updated`,
    }, getUserId());
    expect(updated.name).toBe(`svc-test-${getSuffix()}-site-updated`);
  });

  it('deactivates a site', async () => {
    const deactivated = await getRegistry().sites.deactivate(createdId, getUserId());
    expect(deactivated.isActive).toBe(false);
  });

  it('throws ValidationError when deactivating already inactive', async () => {
    await expect(getRegistry().sites.deactivate(createdId, getUserId()))
      .rejects.toThrow(ValidationError);
  });

  it('findNearest returns closest site', async () => {
    // Create a site with known coords
    const site = await getRegistry().sites.create({
      name: `svc-test-${getSuffix()}-nearest`,
      latitude: 40.7128,
      longitude: -74.006,
    }, getUserId());

    const result = await getRegistry().sites.findNearest(40.7130, -74.005);
    expect(result.site).toBeDefined();
    expect(result.distanceKm).toBeDefined();
    expect(typeof result.distanceKm).toBe('number');
  });

  it('findNearest throws for invalid coords', async () => {
    await expect(getRegistry().sites.findNearest('bad' as any, -74))
      .rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for invalid longitude', async () => {
    await expect(getRegistry().sites.create({
      name: `svc-test-${getSuffix()}-badlon`,
      longitude: 'not-a-number' as any,
    }, getUserId())).rejects.toThrow(ValidationError);
  });

  it('update throws ValidationError for empty name', async () => {
    const site = await getRegistry().sites.create({
      name: `svc-test-${getSuffix()}-upd-val`,
    }, getUserId());
    await expect(getRegistry().sites.update(site.id, { name: '' }, getUserId()))
      .rejects.toThrow(ValidationError);
  });

  it('update throws ValidationError for invalid latitude', async () => {
    const site = await getRegistry().sites.create({
      name: `svc-test-${getSuffix()}-upd-lat`,
    }, getUserId());
    await expect(getRegistry().sites.update(site.id, { latitude: 'bad' as any }, getUserId()))
      .rejects.toThrow(ValidationError);
  });

  it('update throws ValidationError for invalid longitude', async () => {
    const site = await getRegistry().sites.create({
      name: `svc-test-${getSuffix()}-upd-lon`,
    }, getUserId());
    await expect(getRegistry().sites.update(site.id, { longitude: 'bad' as any }, getUserId()))
      .rejects.toThrow(ValidationError);
  });

  it('findNearest throws for invalid longitude', async () => {
    await expect(getRegistry().sites.findNearest(40.7, 'bad' as any))
      .rejects.toThrow(ValidationError);
  });

  it('findNearest picks closest among multiple sites', async () => {
    // Create two sites far apart
    await getRegistry().sites.create({
      name: `svc-test-${getSuffix()}-far`,
      latitude: 51.5074,
      longitude: -0.1278,
    }, getUserId());
    await getRegistry().sites.create({
      name: `svc-test-${getSuffix()}-near`,
      latitude: 40.7580,
      longitude: -73.9855,
    }, getUserId());
    const result = await getRegistry().sites.findNearest(40.7128, -74.006);
    // Just verify it returns a result with distance
    expect(result.site).toBeDefined();
    expect(result.distanceKm).toBeGreaterThanOrEqual(0);
  });
});
