import request from 'supertest';

process.env.NODE_ENV = 'test';

import app from '../../server/src/app';

describe('Import/Export endpoints', () => {
  describe('GET /api/export', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/export');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/import/preview', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).post('/api/import/preview');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/import/apply', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/import/apply')
        .send({ diffs: [] });
      expect(res.status).toBe(401);
    });
  });
});
