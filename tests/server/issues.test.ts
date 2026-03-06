import request from 'supertest';

process.env.NODE_ENV = 'test';

import app from '../../server/src/app';

describe('Issue endpoints', () => {
  describe('GET /api/issues', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/issues');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/issues', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/issues')
        .send({ type: 'MISSING_ITEM', packId: 1, itemId: 1 });
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/issues/:id/resolve', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app)
        .patch('/api/issues/1/resolve')
        .send({});
      expect(res.status).toBe(401);
    });
  });
});
