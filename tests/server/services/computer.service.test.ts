import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { NotFoundError, ValidationError } from '../../../server/src/services/errors';

let siteId: number;
let computerId: number;

beforeAll(async () => {
  await setupTestUser();
  const site = await getRegistry().sites.create({
    name: `svc-test-${getSuffix()}-comp-site`,
  }, getUserId());
  siteId = site.id;
});

afterAll(async () => {
  const prisma = getPrisma();
  await prisma.hostName.updateMany({ where: { name: { contains: `svc-test-${getSuffix()}` } }, data: { computerId: null } });
  await prisma.computer.deleteMany({ where: { model: { contains: `svc-test-${getSuffix()}` } } });
  await prisma.hostName.deleteMany({ where: { name: { contains: `svc-test-${getSuffix()}` } } });
  await prisma.site.deleteMany({ where: { name: { contains: `svc-test-${getSuffix()}-comp-site` } } });
  await teardown();
});

describe('ComputerService', () => {
  it('creates a computer', async () => {
    const comp = await getRegistry().computers.create({
      model: `svc-test-${getSuffix()}-model`,
      serialNumber: `SN-${getSuffix()}`,
      siteId,
    }, getUserId());

    expect(comp.id).toBeDefined();
    expect(comp.model).toBe(`svc-test-${getSuffix()}-model`);
    expect(comp.qrCode).toBe(`/c/${comp.id}`);
    computerId = comp.id;
  });

  it('creates a computer with hostname assignment', async () => {
    const hn = await getRegistry().hostNames.create({ name: `svc-test-${getSuffix()}-comp-hn` });
    const comp = await getRegistry().computers.create({
      model: `svc-test-${getSuffix()}-model2`,
      hostNameId: hn.id,
    }, getUserId());

    const fetched = await getRegistry().computers.get(comp.id);
    expect(fetched.hostName).toBeDefined();
    expect(fetched.hostName!.id).toBe(hn.id);
  });

  it('throws ValidationError for invalid disposition', async () => {
    await expect(getRegistry().computers.create({
      disposition: 'INVALID',
    }, getUserId())).rejects.toThrow(ValidationError);
  });

  it('gets a computer by id', async () => {
    const comp = await getRegistry().computers.get(computerId);
    expect(comp.id).toBe(computerId);
    expect(comp.site).toBeDefined();
  });

  it('throws NotFoundError for nonexistent', async () => {
    await expect(getRegistry().computers.get(999999)).rejects.toThrow(NotFoundError);
  });

  it('lists computers', async () => {
    const list = await getRegistry().computers.list();
    expect(list.some(c => c.id === computerId)).toBe(true);
  });

  it('lists computers with disposition filter', async () => {
    const list = await getRegistry().computers.list({ disposition: 'ACTIVE' });
    expect(list.every(c => c.disposition === 'ACTIVE')).toBe(true);
  });

  it('updates a computer', async () => {
    const updated = await getRegistry().computers.update(computerId, {
      notes: 'Updated notes',
    }, getUserId());
    expect(updated.notes).toBe('Updated notes');
  });

  it('changes disposition', async () => {
    const updated = await getRegistry().computers.changeDisposition(computerId, 'NEEDS_REPAIR', getUserId());
    expect(updated.disposition).toBe('NEEDS_REPAIR');
  });

  it('throws ValidationError for invalid disposition change', async () => {
    await expect(getRegistry().computers.changeDisposition(computerId, 'BOGUS', getUserId()))
      .rejects.toThrow(ValidationError);
  });

  it('lists unassigned computers', async () => {
    const list = await getRegistry().computers.list({ unassigned: true });
    expect(list.every(c => c.siteId == null && c.kitId == null)).toBe(true);
  });

  it('lists computers filtered by siteId', async () => {
    const list = await getRegistry().computers.list({ siteId });
    expect(list.every(c => c.site?.id === siteId)).toBe(true);
  });

  it('create validates siteId type', async () => {
    await expect(getRegistry().computers.create({
      kitId: 'bad' as any,
    }, getUserId())).rejects.toThrow(ValidationError);
  });

  it('update validates siteId and kitId', async () => {
    await expect(getRegistry().computers.update(computerId, {
      siteId: 'bad' as any,
    }, getUserId())).rejects.toThrow(ValidationError);

    await expect(getRegistry().computers.update(computerId, {
      kitId: 'bad' as any,
    }, getUserId())).rejects.toThrow(ValidationError);
  });

  it('update with invalid disposition throws', async () => {
    await expect(getRegistry().computers.update(computerId, {
      disposition: 'INVALID',
    }, getUserId())).rejects.toThrow(ValidationError);
  });

  it('update changes hostname assignment', async () => {
    const hn1 = await getRegistry().hostNames.create({ name: `svc-test-${getSuffix()}-comp-hn-upd1` });
    const hn2 = await getRegistry().hostNames.create({ name: `svc-test-${getSuffix()}-comp-hn-upd2` });

    // Assign hostname
    const comp = await getRegistry().computers.update(computerId, {
      hostNameId: hn1.id,
    }, getUserId());

    // Reassign to different hostname
    await getRegistry().computers.update(computerId, {
      hostNameId: hn2.id,
    }, getUserId());

    // Remove hostname
    await getRegistry().computers.update(computerId, {
      hostNameId: null,
    }, getUserId());
  });
});
