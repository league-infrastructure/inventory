process.env.NODE_ENV = 'test';

import { createAuthAgent, createUnauthenticatedAgent } from './helpers/auth';

describe('Host Names API', () => {
  const agent = createAuthAgent('QUARTERMASTER');
  const unauthed = createUnauthenticatedAgent();

  describe('GET /api/hostnames', () => {
    it('returns 200 with array', async () => {
      const res = await agent.get('/api/hostnames');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 401 for unauthenticated request', async () => {
      const res = await unauthed.get('/api/hostnames');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/hostnames', () => {
    it('creates a host name and returns 201', async () => {
      const name = `TestHost-${Date.now()}`;
      const res = await agent
        .post('/api/hostnames')
        .send({ name });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe(name);
      expect(res.body.id).toBeDefined();
    });

    it('returns 400 for empty name', async () => {
      const res = await agent
        .post('/api/hostnames')
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing name', async () => {
      const res = await agent
        .post('/api/hostnames')
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 409 for duplicate name', async () => {
      const name = `DupHost-${Date.now()}`;
      await agent.post('/api/hostnames').send({ name });

      const res = await agent
        .post('/api/hostnames')
        .send({ name });
      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /api/hostnames/:id', () => {
    it('deletes an unassigned host name', async () => {
      const name = `DelHost-${Date.now()}`;
      const created = await agent
        .post('/api/hostnames')
        .send({ name });

      const res = await agent
        .delete(`/api/hostnames/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for nonexistent ID', async () => {
      const res = await agent.delete('/api/hostnames/999999');
      expect(res.status).toBe(404);
    });
  });
});
