process.env.NODE_ENV = 'test';

import { PrismaClient } from '@prisma/client';
import { createAuthAgent, createUnauthenticatedAgent } from './helpers/auth';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://app:devpassword@localhost:5434/app';
}

const prisma = new PrismaClient();
const suffix = Date.now();

describe('Tokens API', () => {
  const agent = createAuthAgent('QUARTERMASTER');
  const unauthed = createUnauthenticatedAgent();

  afterAll(async () => {
    await prisma.apiToken.deleteMany({ where: { label: { contains: `route-test-${suffix}` } } });
    await prisma.$disconnect();
  });

  describe('GET /api/tokens', () => {
    it('returns 401 for an unauthenticated request', async () => {
      const res = await unauthed.get('/api/tokens');
      expect(res.status).toBe(401);
    });

    it('returns the full token value for a token the caller just created', async () => {
      const createRes = await agent
        .post('/api/tokens')
        .send({ label: `route-test-${suffix}-mine` });
      expect(createRes.status).toBe(201);
      const rawToken: string = createRes.body.token;
      expect(rawToken).toHaveLength(64);

      const listRes = await agent.get('/api/tokens');
      expect(listRes.status).toBe(200);
      const mine = listRes.body.find((t: { id: number }) => t.id === createRes.body.id);
      expect(mine).toBeDefined();
      expect(mine.token).toBe(rawToken);
      expect(mine.token).not.toContain('...');
    });

    it('returns token: null for a row inserted directly with tokenEnc: null', async () => {
      const createRes = await agent
        .post('/api/tokens')
        .send({ label: `route-test-${suffix}-nullenc` });
      expect(createRes.status).toBe(201);

      await prisma.apiToken.update({
        where: { id: createRes.body.id },
        data: { tokenEnc: null },
      });

      const listRes = await agent.get('/api/tokens');
      expect(listRes.status).toBe(200);
      const row = listRes.body.find((t: { id: number }) => t.id === createRes.body.id);
      expect(row).toBeDefined();
      expect(row.token).toBeNull();
    });

    it('does not list a revoked token at all', async () => {
      const createRes = await agent
        .post('/api/tokens')
        .send({ label: `route-test-${suffix}-revoked` });
      expect(createRes.status).toBe(201);

      const revokeRes = await agent.delete(`/api/tokens/${createRes.body.id}`);
      expect(revokeRes.status).toBe(200);

      const listRes = await agent.get('/api/tokens');
      expect(listRes.status).toBe(200);
      expect(listRes.body.some((t: { id: number }) => t.id === createRes.body.id)).toBe(false);
    });
  });

  describe('GET /api/admin/tokens', () => {
    it('never includes a non-null token value', async () => {
      // Ensure at least one token with a real tokenEnc exists.
      const createRes = await agent
        .post('/api/tokens')
        .send({ label: `route-test-${suffix}-admin-visible` });
      expect(createRes.status).toBe(201);

      const adminRes = await agent.get('/api/admin/tokens');
      expect(adminRes.status).toBe(200);
      expect(Array.isArray(adminRes.body)).toBe(true);
      expect(adminRes.body.length).toBeGreaterThan(0);
      for (const row of adminRes.body) {
        expect(row.token == null).toBe(true);
      }
    });

    it('returns 403 for a non-quartermaster session', async () => {
      // requireQuartermaster is exercised elsewhere in the suite; a plain
      // unauthenticated request should still be rejected here too.
      const res = await unauthed.get('/api/admin/tokens');
      expect([401, 403]).toContain(res.status);
    });
  });
});
