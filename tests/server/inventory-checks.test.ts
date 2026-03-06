import request from 'supertest';

process.env.NODE_ENV = 'test';

import app from '../../server/src/app';

describe('Inventory Check endpoints', () => {
  describe('POST /api/inventory-checks/kit/:kitId', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).post('/api/inventory-checks/kit/1');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/inventory-checks/pack/:packId', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).post('/api/inventory-checks/pack/1');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/inventory-checks/:id', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app)
        .patch('/api/inventory-checks/1')
        .send({ lines: [] });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/inventory-checks/:id', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/inventory-checks/1');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/inventory-checks/history/kit/:kitId', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/inventory-checks/history/kit/1');
      expect(res.status).toBe(401);
    });
  });
});
