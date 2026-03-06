import request from 'supertest';

process.env.NODE_ENV = 'test';

import app from '../../server/src/app';

describe('Search endpoint', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const res = await request(app).get('/api/search?q=test');
    expect(res.status).toBe(401);
  });
});
