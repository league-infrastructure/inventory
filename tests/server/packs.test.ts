process.env.NODE_ENV = 'test';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://app:devpassword@localhost:5434/app';
}

import { PrismaClient } from '@prisma/client';
import { createAuthAgent, createUnauthenticatedAgent } from './helpers/auth';

const prisma = new PrismaClient();

describe('Packs API', () => {
  const agent = createAuthAgent('QUARTERMASTER');
  const instructorAgent = createAuthAgent('INSTRUCTOR');
  const unauthed = createUnauthenticatedAgent();

  const createdKitIds: number[] = [];
  let kitCounter = 0;

  afterAll(async () => {
    for (const kitId of createdKitIds) {
      const packs = await prisma.pack.findMany({ where: { kitId }, select: { id: true } });
      const packIds = packs.map((p) => p.id);
      if (packIds.length > 0) {
        await prisma.item.deleteMany({ where: { packId: { in: packIds } } });
        await prisma.auditLog.deleteMany({ where: { objectType: 'Pack', objectId: { in: packIds } } });
        await prisma.pack.deleteMany({ where: { id: { in: packIds } } });
      }
      await prisma.kit.delete({ where: { id: kitId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  function nextKitNumber(): number {
    return (Date.now() % 100000) + 60000 + (kitCounter++);
  }

  /** Creates a kit with `n` packs via the HTTP API, in order (pack 1 gets displayNumber 1, etc). */
  async function createKitWithPacks(n: number, label: string): Promise<{ kitId: number; packIds: number[] }> {
    const kitRes = await agent.post('/api/kits').send({
      number: nextKitNumber(),
      name: `Renumber Route Test ${label} ${Date.now()}`,
    });
    expect(kitRes.status).toBe(201);
    const kitId = kitRes.body.id;
    createdKitIds.push(kitId);

    const packIds: number[] = [];
    for (let i = 1; i <= n; i++) {
      const packRes = await agent.post(`/api/kits/${kitId}/packs`).send({ name: `Pack ${i}` });
      expect(packRes.status).toBe(201);
      packIds.push(packRes.body.id);
    }
    return { kitId, packIds };
  }

  describe('PATCH /api/packs/:id/renumber', () => {
    it('renumbers the whole kit end to end (stakeholder example A: pack 7 -> 4)', async () => {
      const { packIds } = await createKitWithPacks(7, 'example-a');
      const [p1, p2, p3, p4, p5, p6, p7] = packIds;

      const res = await agent.patch(`/api/packs/${p7}/renumber`).send({ displayNumber: 4 });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(7);

      const byId = new Map(res.body.map((p: any) => [p.id, p.displayNumber]));
      expect(byId.get(p7)).toBe(4);
      expect(byId.get(p4)).toBe(5);
      expect(byId.get(p5)).toBe(6);
      expect(byId.get(p6)).toBe(7);
      expect(byId.get(p1)).toBe(1);
      expect(byId.get(p2)).toBe(2);
      expect(byId.get(p3)).toBe(3);

      const numbers = res.body.map((p: any) => p.displayNumber).sort((a: number, b: number) => a - b);
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('renumbers the whole kit end to end (stakeholder example B: pack 3 -> 6)', async () => {
      const { packIds } = await createKitWithPacks(7, 'example-b');
      const [p1, p2, p3, p4, p5, p6, p7] = packIds;

      const res = await agent.patch(`/api/packs/${p3}/renumber`).send({ displayNumber: 6 });
      expect(res.status).toBe(200);

      const byId = new Map(res.body.map((p: any) => [p.id, p.displayNumber]));
      expect(byId.get(p4)).toBe(3);
      expect(byId.get(p1)).toBe(1);
      expect(byId.get(p2)).toBe(2);
      expect(byId.get(p5)).toBe(4);
      expect(byId.get(p3)).toBe(5);
      expect(byId.get(p6)).toBe(6);
      expect(byId.get(p7)).toBe(7);

      const numbers = res.body.map((p: any) => p.displayNumber).sort((a: number, b: number) => a - b);
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('rejects an unauthenticated request', async () => {
      const { packIds } = await createKitWithPacks(2, 'unauthed');
      const res = await unauthed.patch(`/api/packs/${packIds[0]}/renumber`).send({ displayNumber: 2 });
      expect(res.status).toBe(401);
    });

    it('rejects a non-quartermaster user', async () => {
      const { kitId, packIds } = await createKitWithPacks(3, 'non-qm');
      const res = await instructorAgent.patch(`/api/packs/${packIds[0]}/renumber`).send({ displayNumber: 2 });
      expect(res.status).toBe(403);

      // No packs changed.
      const after = await prisma.pack.findMany({ where: { kitId }, orderBy: { displayNumber: 'asc' } });
      expect(after.map((p) => p.displayNumber)).toEqual([1, 2, 3]);
    });

    it('rejects an out-of-range number with no packs changed', async () => {
      const { kitId, packIds } = await createKitWithPacks(3, 'out-of-range');

      const res = await agent.patch(`/api/packs/${packIds[0]}/renumber`).send({ displayNumber: 10 });
      expect(res.status).toBe(400);

      const after = await prisma.pack.findMany({ where: { kitId }, orderBy: { displayNumber: 'asc' } });
      expect(after.map((p) => p.displayNumber)).toEqual([1, 2, 3]);
    });

    it('returns 404 for a nonexistent pack', async () => {
      const res = await agent.patch('/api/packs/999999/renumber').send({ displayNumber: 1 });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/packs/:id displayNumber (ticket 004-002)', () => {
    it('renumbers via displayNumber and returns a single PackDetailRecord (not an array)', async () => {
      const { packIds } = await createKitWithPacks(7, 'put-displaynumber');
      const [p1, p2, p3, p4, p5, p6, p7] = packIds;

      const res = await agent.put(`/api/packs/${p7}`).send({ displayNumber: 4 });
      expect(res.status).toBe(200);

      // Single-record response shape — explicit guard on the
      // shape-preservation decision (PUT never switches to the array shape
      // renumber_pack/PATCH .../renumber use).
      expect(Array.isArray(res.body)).toBe(false);
      expect(res.body.id).toBe(p7);
      expect(res.body.displayNumber).toBe(4);

      // Same renumbered outcome as an equivalent PATCH .../renumber call
      // (stakeholder example A: pack 7 -> 4), verified via a follow-up read.
      const after = await prisma.pack.findMany({ where: { id: { in: packIds } } });
      const byId = new Map(after.map((p) => [p.id, p.displayNumber]));
      expect(byId.get(p7)).toBe(4);
      expect(byId.get(p4)).toBe(5);
      expect(byId.get(p5)).toBe(6);
      expect(byId.get(p6)).toBe(7);
      expect(byId.get(p1)).toBe(1);
      expect(byId.get(p2)).toBe(2);
      expect(byId.get(p3)).toBe(3);

      const numbers = after.map((p) => p.displayNumber).sort((a, b) => a - b);
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('applies both name and displayNumber when both are present in the body', async () => {
      // Edit the last pack (p3, displayNumber 3) and move it to the front
      // (displayNumber 1) at the same time as a rename — same shift pattern
      // as the PATCH renumber "stakeholder example A" case, so the other
      // packs' resulting numbers are unambiguous.
      const { kitId, packIds } = await createKitWithPacks(3, 'put-mixed');
      const [p1, p2, p3] = packIds;

      const res = await agent.put(`/api/packs/${p3}`).send({ name: 'Renamed via PUT', displayNumber: 1 });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed via PUT');
      expect(res.body.displayNumber).toBe(1);

      const after = await prisma.pack.findMany({ where: { kitId }, orderBy: { displayNumber: 'asc' } });
      expect(after.map((p) => p.displayNumber)).toEqual([1, 2, 3]);
      const byId = new Map(after.map((p) => [p.id, p.displayNumber]));
      expect(byId.get(p3)).toBe(1);
      expect(byId.get(p1)).toBe(2);
      expect(byId.get(p2)).toBe(3);
      const renamed = after.find((p) => p.id === p3);
      expect(renamed?.name).toBe('Renamed via PUT');
    });

    it('rejects an out-of-range displayNumber with no packs changed', async () => {
      const { kitId, packIds } = await createKitWithPacks(3, 'put-out-of-range');

      const res = await agent.put(`/api/packs/${packIds[0]}`).send({ displayNumber: 10 });
      expect(res.status).toBe(400);

      const after = await prisma.pack.findMany({ where: { kitId }, orderBy: { displayNumber: 'asc' } });
      expect(after.map((p) => p.displayNumber)).toEqual([1, 2, 3]);
    });

    it('rejects an unauthenticated request', async () => {
      const { packIds } = await createKitWithPacks(2, 'put-unauthed');
      const res = await unauthed.put(`/api/packs/${packIds[0]}`).send({ displayNumber: 2 });
      expect(res.status).toBe(401);
    });

    it('rejects a non-quartermaster user, leaving numbering untouched', async () => {
      const { kitId, packIds } = await createKitWithPacks(3, 'put-non-qm');

      const res = await instructorAgent.put(`/api/packs/${packIds[0]}`).send({ displayNumber: 2 });
      expect(res.status).toBe(403);

      const after = await prisma.pack.findMany({ where: { kitId }, orderBy: { displayNumber: 'asc' } });
      expect(after.map((p) => p.displayNumber)).toEqual([1, 2, 3]);
    });

    it('without displayNumber is unaffected: still updates via the normal path, single record', async () => {
      const { packIds } = await createKitWithPacks(2, 'put-no-displaynumber');

      const res = await agent.put(`/api/packs/${packIds[0]}`).send({ name: 'Plain Rename' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(false);
      expect(res.body.name).toBe('Plain Rename');
      expect(res.body.displayNumber).toBe(1);
    });
  });

  describe('DELETE /api/packs/:id', () => {
    it('deletes a middle pack and compacts the remaining packs to 1..N', async () => {
      const { kitId, packIds } = await createKitWithPacks(5, 'delete-middle');
      const [p1, p2, p3, p4, p5] = packIds;

      const res = await agent.delete(`/api/packs/${p3}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });

      const after = await prisma.pack.findMany({ where: { kitId }, orderBy: { displayNumber: 'asc' } });
      expect(after.map((p) => p.displayNumber)).toEqual([1, 2, 3, 4]);
      const byId = new Map(after.map((p) => [p.id, p.displayNumber]));
      expect(byId.get(p1)).toBe(1);
      expect(byId.get(p2)).toBe(2);
      expect(byId.get(p4)).toBe(3);
      expect(byId.get(p5)).toBe(4);
      expect(byId.has(p3)).toBe(false);

      // Deleted pack is gone via a follow-up GET.
      const getRes = await agent.get(`/api/packs/${p3}`);
      expect(getRes.status).toBe(404);
    });

    it('deleting the last pack leaves the others unchanged', async () => {
      const { kitId, packIds } = await createKitWithPacks(3, 'delete-last');
      const [p1, p2, p3] = packIds;

      const res = await agent.delete(`/api/packs/${p3}`);
      expect(res.status).toBe(200);

      const after = await prisma.pack.findMany({ where: { kitId }, orderBy: { displayNumber: 'asc' } });
      expect(after.map((p) => p.displayNumber)).toEqual([1, 2]);
      const byId = new Map(after.map((p) => [p.id, p.displayNumber]));
      expect(byId.get(p1)).toBe(1);
      expect(byId.get(p2)).toBe(2);
    });

    it('rejects an unauthenticated request', async () => {
      const { packIds } = await createKitWithPacks(1, 'delete-unauthed');
      const res = await unauthed.delete(`/api/packs/${packIds[0]}`);
      expect(res.status).toBe(401);
    });

    it('rejects a non-quartermaster user, leaving the pack and numbering untouched', async () => {
      const { kitId, packIds } = await createKitWithPacks(3, 'delete-non-qm');

      const res = await instructorAgent.delete(`/api/packs/${packIds[1]}`);
      expect(res.status).toBe(403);

      const after = await prisma.pack.findMany({ where: { kitId }, orderBy: { displayNumber: 'asc' } });
      expect(after.map((p) => p.displayNumber)).toEqual([1, 2, 3]);
    });

    it('returns 404 for a nonexistent pack', async () => {
      const res = await agent.delete('/api/packs/999999');
      expect(res.status).toBe(404);
    });
  });
});
