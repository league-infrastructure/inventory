/**
 * Tests for the shared kit/pack identifier resolver module (sprint 009,
 * ticket 001) — `server/src/mcp/identifiers.ts`.
 *
 * The fixtures below reproduce, in the test database, the exact live
 * collision the stakeholder verified in production: kit number 26 has
 * database id 17, while kit number 17 is a distinct row. A resolver that
 * regresses to id-based lookup — the bug this sprint exists to close —
 * would silently return the wrong kit for one of these two numbers. Pack
 * designators 26/1, 16/1 and 7/1 mirror the stakeholder's verified pack
 * fixtures (503, 413, 535 respectively); the exact ids aren't load-bearing
 * for the pack tests (a pack is looked up via kitId+displayNumber, not by
 * its own id), so they're reproduced here for continuity with the ticket's
 * stated fixture, not because the resolver reads them.
 */
import { setupTestUser, teardown, getPrisma, getSuffix } from './setup';
import {
  resolveKitByNumber,
  resolvePackByDesignator,
  parsePackDesignator,
} from '../../../server/src/mcp/identifiers';
import { NotFoundError, ValidationError } from '../../../server/src/services/errors';

// Mirrors the stakeholder-verified production collision: kit number 26 ->
// database id 17. Explicit ids on these two rows are the actual point of
// the fixture.
const KIT_26_ID = 17;
const KIT_17_ID = 26;

// Mirrors the stakeholder-verified pack ids (503/413/535), reproduced here
// for continuity with the ticket, though the resolver never looks a pack
// up by its own id.
const PACK_26_1_ID = 503;
const PACK_16_1_ID = 413;
const PACK_7_1_ID = 535;

let kit16Id: number;
let kit7Id: number;
const createdKitIds: number[] = [];
const createdPackIds: number[] = [];

beforeAll(async () => {
  await setupTestUser();
  const prisma = getPrisma();
  const suffix = getSuffix();

  await prisma.kit.create({
    data: { id: KIT_26_ID, number: 26, name: `svc-test-${suffix}-identifiers-kit-26` },
  });
  await prisma.kit.create({
    data: { id: KIT_17_ID, number: 17, name: `svc-test-${suffix}-identifiers-kit-17` },
  });
  createdKitIds.push(KIT_26_ID, KIT_17_ID);

  const kit16 = await prisma.kit.create({
    data: { number: 16, name: `svc-test-${suffix}-identifiers-kit-16` },
  });
  const kit7 = await prisma.kit.create({
    data: { number: 7, name: `svc-test-${suffix}-identifiers-kit-7` },
  });
  kit16Id = kit16.id;
  kit7Id = kit7.id;
  createdKitIds.push(kit16Id, kit7Id);

  await prisma.pack.create({
    data: { id: PACK_26_1_ID, kitId: KIT_26_ID, displayNumber: 1, name: 'Pack 26/1' },
  });
  await prisma.pack.create({
    data: { id: PACK_16_1_ID, kitId: kit16Id, displayNumber: 1, name: 'Pack 16/1' },
  });
  await prisma.pack.create({
    data: { id: PACK_7_1_ID, kitId: kit7Id, displayNumber: 1, name: 'Pack 7/1' },
  });
  createdPackIds.push(PACK_26_1_ID, PACK_16_1_ID, PACK_7_1_ID);
});

afterAll(async () => {
  const prisma = getPrisma();
  await prisma.pack.deleteMany({ where: { id: { in: createdPackIds } } });
  await prisma.kit.deleteMany({ where: { id: { in: createdKitIds } } });
  await teardown();
}, 30000);

describe('resolveKitByNumber', () => {
  it('resolves a valid kit_number to the correct Kit', async () => {
    const kit = await resolveKitByNumber(getPrisma(), 16);
    expect(kit.id).toBe(kit16Id);
    expect(kit.number).toBe(16);
  });

  it('collision fixture: kit number 26 (id 17) and kit number 17 (id 26) resolve to their own distinct kits', async () => {
    const kit26 = await resolveKitByNumber(getPrisma(), 26);
    const kit17 = await resolveKitByNumber(getPrisma(), 17);

    expect(kit26.id).toBe(KIT_26_ID);
    expect(kit26.number).toBe(26);

    expect(kit17.id).toBe(KIT_17_ID);
    expect(kit17.number).toBe(17);

    expect(kit26.id).not.toBe(kit17.id);
  });

  it('throws an explicit not-found error for an unknown kit_number, with no fallback to id lookup', async () => {
    // kit16Id is a real database id (a row genuinely exists there), but no
    // kit has that value as its `number`. A resolver that regressed to
    // interpreting the input as an id would find kit16's row here instead
    // of failing.
    await expect(resolveKitByNumber(getPrisma(), kit16Id)).rejects.toThrow(NotFoundError);
    await expect(resolveKitByNumber(getPrisma(), kit16Id)).rejects.toThrow(
      `Kit number ${kit16Id} not found`,
    );
  });
});

describe('parsePackDesignator', () => {
  it('parses the combined "kit_number/pack_number" string', () => {
    expect(parsePackDesignator('26/1')).toEqual({ kitNumber: 26, packNumber: 1 });
  });

  it('throws ValidationError for a malformed designator', () => {
    expect(() => parsePackDesignator('not-a-designator')).toThrow(ValidationError);
    expect(() => parsePackDesignator('26')).toThrow(ValidationError);
    expect(() => parsePackDesignator('26/1/2')).toThrow(ValidationError);
  });
});

describe('resolvePackByDesignator', () => {
  it('resolves a structured {kitNumber, packNumber} pair to the correct Pack', async () => {
    const pack = await resolvePackByDesignator(getPrisma(), { kitNumber: 16, packNumber: 1 });
    expect(pack.id).toBe(PACK_16_1_ID);
    expect(pack.kitId).toBe(kit16Id);
    expect(pack.displayNumber).toBe(1);
  });

  it('resolves the equivalent combined "kit_number/pack_number" string to the same Pack', async () => {
    const viaString = await resolvePackByDesignator(getPrisma(), '16/1');
    const viaPair = await resolvePackByDesignator(getPrisma(), { kitNumber: 16, packNumber: 1 });
    expect(viaString.id).toBe(viaPair.id);
    expect(viaString.id).toBe(PACK_16_1_ID);
  });

  it('collision fixtures: packs 26/1, 16/1 and 7/1 each resolve to their own distinct Pack', async () => {
    const pack26_1 = await resolvePackByDesignator(getPrisma(), '26/1');
    const pack16_1 = await resolvePackByDesignator(getPrisma(), '16/1');
    const pack7_1 = await resolvePackByDesignator(getPrisma(), '7/1');

    expect(pack26_1.id).toBe(PACK_26_1_ID);
    expect(pack16_1.id).toBe(PACK_16_1_ID);
    expect(pack7_1.id).toBe(PACK_7_1_ID);

    const ids = [pack26_1.id, pack16_1.id, pack7_1.id];
    expect(new Set(ids).size).toBe(3);
  });

  it('throws an explicit not-found error for an unknown kit, distinguishable from an unknown pack within a known kit', async () => {
    await expect(
      resolvePackByDesignator(getPrisma(), { kitNumber: 999999, packNumber: 1 }),
    ).rejects.toThrow('Kit number 999999 not found');

    await expect(
      resolvePackByDesignator(getPrisma(), { kitNumber: 26, packNumber: 9 }),
    ).rejects.toThrow('Pack 26/9 not found');
  });

  it('never falls back to id-based lookup for the kit half of the designator', async () => {
    // kit16Id is a real kit id, not a kit number — same non-fallback
    // guarantee as the resolveKitByNumber test above, exercised through
    // the pack resolver's kit-resolution step.
    await expect(
      resolvePackByDesignator(getPrisma(), { kitNumber: kit16Id, packNumber: 1 }),
    ).rejects.toThrow(`Kit number ${kit16Id} not found`);
  });
});
