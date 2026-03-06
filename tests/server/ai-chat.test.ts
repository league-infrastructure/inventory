import request from 'supertest';

process.env.NODE_ENV = 'test';

import app from '../../server/src/app';

describe('AI Chat endpoints', () => {
  describe('GET /api/ai/status', () => {
    it('returns configured status', async () => {
      const res = await request(app).get('/api/ai/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('configured');
      expect(typeof res.body.configured).toBe('boolean');
    });

    it('does not require authentication', async () => {
      const res = await request(app).get('/api/ai/status');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/ai/chat', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .send({ message: 'hello' });
      expect(res.status).toBe(401);
    });
  });
});
