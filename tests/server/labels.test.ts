import request from 'supertest';

process.env.NODE_ENV = 'test';

import app from '../../server/src/app';

describe('Label endpoints', () => {
  describe('GET /api/labels/kit/:id', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/labels/kit/1');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/labels/pack/:id', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/labels/pack/1');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/labels/computer/:id', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/labels/computer/1');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/labels/kit/:id/batch', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/labels/kit/1/batch')
        .send({ packIds: [] });
      expect(res.status).toBe(401);
    });
  });
});
