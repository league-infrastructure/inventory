import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { NotFoundError, ValidationError } from '../../../server/src/services/errors';

let siteId: number;
let kitId: number;
let packId: number;
let countedItemId: number;
let consumableItemId: number;

beforeAll(async () => {
  await setupTestUser();
  const reg = getRegistry();
  const uid = getUserId();

  const site = await reg.sites.create({ name: `svc-test-${getSuffix()}-iss-site` }, uid);
  siteId = site.id;

  const kit = await reg.kits.create({
    number: (getSuffix() % 100000) + 600,
    name: `svc-test-${getSuffix()}-iss-kit`,
    siteId,
  }, uid);
  kitId = kit.id;

  const pack = await reg.packs.create({ name: `svc-test-${getSuffix()}-iss-pack` }, uid, kitId);
  packId = pack.id;

  const counted = await reg.items.create({
    name: `svc-test-${getSuffix()}-iss-counted`,
    type: 'COUNTED',
    expectedQuantity: 3,
  }, uid, packId);
  countedItemId = counted.id;

  const consumable = await reg.items.create({
    name: `svc-test-${getSuffix()}-iss-consumable`,
    type: 'CONSUMABLE',
  }, uid, packId);
  consumableItemId = consumable.id;
});

afterAll(async () => {
  const prisma = getPrisma();
  await prisma.issue.deleteMany({ where: { packId } });
  await prisma.item.deleteMany({ where: { packId } });
  await prisma.pack.deleteMany({ where: { kitId } });
  await prisma.kit.deleteMany({ where: { id: kitId } });
  await prisma.site.deleteMany({ where: { id: siteId } });
  await teardown();
});

describe('IssueService', () => {
  let issueId: number;

  it('creates a MISSING_ITEM issue', async () => {
    const issue = await getRegistry().issues.create({
      type: 'MISSING_ITEM',
      packId,
      itemId: countedItemId,
      notes: 'Item is missing from pack',
    }, getUserId());

    expect(issue.id).toBeDefined();
    expect(issue.type).toBe('MISSING_ITEM');
    expect(issue.status).toBe('OPEN');
    expect(issue.packId).toBe(packId);
    expect(issue.itemId).toBe(countedItemId);
    expect(issue.notes).toBe('Item is missing from pack');
    expect(issue.reporter.displayName).toBeDefined();
    issueId = issue.id;
  });

  it('creates a REPLENISHMENT issue', async () => {
    const issue = await getRegistry().issues.create({
      type: 'REPLENISHMENT',
      packId,
      itemId: consumableItemId,
    }, getUserId());

    expect(issue.type).toBe('REPLENISHMENT');
    expect(issue.status).toBe('OPEN');
  });

  it('throws ValidationError for invalid type', async () => {
    await expect(
      getRegistry().issues.create({
        type: 'INVALID',
        packId,
        itemId: countedItemId,
      }, getUserId()),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for mismatched item/pack', async () => {
    // Create another pack
    const otherPack = await getRegistry().packs.create(
      { name: `svc-test-${getSuffix()}-iss-other` }, getUserId(), kitId,
    );
    await expect(
      getRegistry().issues.create({
        type: 'MISSING_ITEM',
        packId: otherPack.id,
        itemId: countedItemId, // belongs to original pack
      }, getUserId()),
    ).rejects.toThrow(ValidationError);
  });

  it('lists open issues', async () => {
    const issues = await getRegistry().issues.list({ status: 'OPEN' });
    expect(issues.some((i) => i.id === issueId)).toBe(true);
  });

  it('lists issues by pack', async () => {
    const issues = await getRegistry().issues.list({ packId });
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });

  it('gets an issue by id', async () => {
    const issue = await getRegistry().issues.get(issueId);
    expect(issue.id).toBe(issueId);
    expect(issue.pack.name).toBeDefined();
    expect(issue.item.name).toBeDefined();
  });

  it('resolves an issue', async () => {
    const resolved = await getRegistry().issues.resolve(issueId, {
      notes: 'Replaced item',
    }, getUserId());

    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolvedAt).not.toBeNull();
    expect(resolved.resolver).not.toBeNull();
    expect(resolved.notes).toBe('Replaced item');
  });

  it('throws ValidationError when resolving already resolved', async () => {
    await expect(
      getRegistry().issues.resolve(issueId, {}, getUserId()),
    ).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError for nonexistent issue', async () => {
    await expect(
      getRegistry().issues.get(999999),
    ).rejects.toThrow(NotFoundError);
  });
});
