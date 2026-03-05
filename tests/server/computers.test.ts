process.env.NODE_ENV = 'test';

import { createAuthAgent, createUnauthenticatedAgent } from './helpers/auth';

describe('Computers API', () => {
  const agent = createAuthAgent('QUARTERMASTER');
  const unauthed = createUnauthenticatedAgent();

  describe('GET /api/computers', () => {
    it('returns 200 with array', async () => {
      const res = await agent.get('/api/computers');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 401 for unauthenticated request', async () => {
      const res = await unauthed.get('/api/computers');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/computers', () => {
    it('creates a computer and returns 201 with QR code', async () => {
      const res = await agent
        .post('/api/computers')
        .send({ serialNumber: 'SN-TEST-001', model: 'ThinkPad T14' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.qrCode).toMatch(/^\/c\/\d+$/);
      expect(res.body.serialNumber).toBe('SN-TEST-001');
      expect(res.body.model).toBe('ThinkPad T14');
      expect(res.body.disposition).toBe('ACTIVE');
    });

    it('creates a computer with no fields (all optional)', async () => {
      const res = await agent
        .post('/api/computers')
        .send({});
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it('returns 400 for invalid disposition', async () => {
      const res = await agent
        .post('/api/computers')
        .send({ disposition: 'INVALID' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/computers/:id', () => {
    it('returns 200 with computer detail', async () => {
      // Create one first
      const created = await agent
        .post('/api/computers')
        .send({ model: 'Detail Test' });
      expect(created.status).toBe(201);

      const res = await agent.get(`/api/computers/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.model).toBe('Detail Test');
      expect(res.body).toHaveProperty('hostName');
      expect(res.body).toHaveProperty('site');
      expect(res.body).toHaveProperty('kit');
    });

    it('returns 404 for nonexistent ID', async () => {
      const res = await agent.get('/api/computers/999999');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/computers/:id', () => {
    it('updates fields and returns 200', async () => {
      const created = await agent
        .post('/api/computers')
        .send({ model: 'Before Update' });

      const res = await agent
        .put(`/api/computers/${created.body.id}`)
        .send({ model: 'After Update', notes: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.model).toBe('After Update');
      expect(res.body.notes).toBe('Updated');
    });

    it('returns 404 for nonexistent ID', async () => {
      const res = await agent
        .put('/api/computers/999999')
        .send({ model: 'Nope' });
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/computers/:id/disposition', () => {
    it('changes disposition', async () => {
      const created = await agent
        .post('/api/computers')
        .send({});

      const res = await agent
        .patch(`/api/computers/${created.body.id}/disposition`)
        .send({ disposition: 'NEEDS_REPAIR' });
      expect(res.status).toBe(200);
      expect(res.body.disposition).toBe('NEEDS_REPAIR');
    });

    it('returns 400 for invalid disposition', async () => {
      const created = await agent
        .post('/api/computers')
        .send({});

      const res = await agent
        .patch(`/api/computers/${created.body.id}/disposition`)
        .send({ disposition: 'BOGUS' });
      expect(res.status).toBe(400);
    });
  });
});
