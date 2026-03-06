import request from 'supertest';

process.env.NODE_ENV = 'test';

import app from '../../server/src/app';

describe('Report endpoints', () => {
  describe('GET /api/reports/audit-log', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/reports/audit-log');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/reports/user-activity/:userId', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/reports/user-activity/1');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/reports/inventory-age', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/reports/inventory-age');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/reports/transferred-by-person', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/reports/transferred-by-person');
      expect(res.status).toBe(401);
    });
  });
});
