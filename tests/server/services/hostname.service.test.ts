import { setupTestUser, teardown, getRegistry, getSuffix, getPrisma } from './setup';
import { NotFoundError, ValidationError, ConflictError } from '../../../server/src/services/errors';

beforeAll(async () => { await setupTestUser(); });
afterAll(async () => {
  const prisma = getPrisma();
  await prisma.hostName.deleteMany({ where: { name: { contains: `svc-test-${getSuffix()}` } } });
  await teardown();
});

describe('HostNameService', () => {
  let createdId: number;

  it('creates a hostname', async () => {
    const hn = await getRegistry().hostNames.create({ name: `svc-test-${getSuffix()}-hn1` });
    expect(hn.id).toBeDefined();
    expect(hn.name).toBe(`svc-test-${getSuffix()}-hn1`);
    createdId = hn.id;
  });

  it('throws ValidationError for empty name', async () => {
    await expect(getRegistry().hostNames.create({ name: '' }))
      .rejects.toThrow(ValidationError);
  });

  it('throws ConflictError for duplicate name', async () => {
    await expect(getRegistry().hostNames.create({ name: `svc-test-${getSuffix()}-hn1` }))
      .rejects.toThrow(ConflictError);
  });

  it('lists hostnames', async () => {
    const list = await getRegistry().hostNames.list();
    expect(Array.isArray(list)).toBe(true);
    expect(list.some(h => h.id === createdId)).toBe(true);
  });

  it('gets a hostname by id', async () => {
    const hn = await getRegistry().hostNames.get(createdId);
    expect(hn.id).toBe(createdId);
  });

  it('deletes an unassigned hostname', async () => {
    await getRegistry().hostNames.delete(createdId);
    await expect(getRegistry().hostNames.get(createdId))
      .rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError deleting nonexistent', async () => {
    await expect(getRegistry().hostNames.delete(999999))
      .rejects.toThrow(NotFoundError);
  });
});
