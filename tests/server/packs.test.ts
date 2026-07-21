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
});
