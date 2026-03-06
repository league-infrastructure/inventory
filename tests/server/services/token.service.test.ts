import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';

beforeAll(async () => { await setupTestUser(); });
afterAll(async () => {
  const prisma = getPrisma();
  await prisma.apiToken.deleteMany({ where: { label: { contains: `test-${getSuffix()}` } } });
  await teardown();
});

describe('TokenService', () => {
  let tokenId: number;
  let rawToken: string;

  it('creates a token', async () => {
    const result = await getRegistry().tokens.create(getUserId(), `test-${getSuffix()}-token`);
    expect(result.id).toBeDefined();
    expect(result.token).toHaveLength(64); // 32 bytes hex
    expect(result.prefix).toHaveLength(8);
    expect(result.token.startsWith(result.prefix)).toBe(true);
    expect(result.label).toBe(`test-${getSuffix()}-token`);
    tokenId = result.id;
    rawToken = result.token;
  });

  it('validates a valid token', async () => {
    const result = await getRegistry().tokens.validate(rawToken);
    expect(result.userId).toBe(getUserId());
    expect(result.role).toBeDefined();
  });

  it('updates lastUsedAt on validation', async () => {
    const prisma = getPrisma();
    const token = await prisma.apiToken.findUnique({ where: { id: tokenId } });
    expect(token!.lastUsedAt).not.toBeNull();
  });

  it('rejects an invalid token', async () => {
    await expect(getRegistry().tokens.validate('invalid-token-value'))
      .rejects.toThrow('Invalid token');
  });

  it('lists tokens for user', async () => {
    const tokens = await getRegistry().tokens.list(getUserId());
    expect(tokens.some(t => t.id === tokenId)).toBe(true);
  });

  it('lists all tokens (admin)', async () => {
    const tokens = await getRegistry().tokens.list();
    expect(tokens.some(t => t.id === tokenId)).toBe(true);
    expect(tokens[0].user).toBeDefined();
  });

  it('revokes a token', async () => {
    await getRegistry().tokens.revoke(tokenId, getUserId());
    const prisma = getPrisma();
    const token = await prisma.apiToken.findUnique({ where: { id: tokenId } });
    expect(token!.revokedAt).not.toBeNull();
  });

  it('rejects a revoked token', async () => {
    await expect(getRegistry().tokens.validate(rawToken))
      .rejects.toThrow('Token revoked');
  });

  it('revokeAllForUser revokes all active tokens', async () => {
    // Create two tokens
    const t1 = await getRegistry().tokens.create(getUserId(), `test-${getSuffix()}-bulk1`);
    const t2 = await getRegistry().tokens.create(getUserId(), `test-${getSuffix()}-bulk2`);

    await getRegistry().tokens.revokeAllForUser(getUserId());

    await expect(getRegistry().tokens.validate(t1.token)).rejects.toThrow('Token revoked');
    await expect(getRegistry().tokens.validate(t2.token)).rejects.toThrow('Token revoked');
  });

  it('rejects expired token', async () => {
    const result = await getRegistry().tokens.create(getUserId(), `test-${getSuffix()}-expired`);
    // Manually set expiresAt to the past
    const prisma = getPrisma();
    await prisma.apiToken.update({
      where: { id: result.id },
      data: { expiresAt: new Date('2020-01-01') },
    });

    await expect(getRegistry().tokens.validate(result.token))
      .rejects.toThrow('Token expired');
  });
});
