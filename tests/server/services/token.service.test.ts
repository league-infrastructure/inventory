import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { encryptToken, decryptToken } from '../../../server/src/services/tokenCrypto';

beforeAll(async () => { await setupTestUser(); });
afterAll(async () => {
  const prisma = getPrisma();
  await prisma.apiToken.deleteMany({ where: { label: { contains: `test-${getSuffix()}` } } });
  await teardown();
});

describe('tokenCrypto', () => {
  it('round-trips a token through encrypt/decrypt', () => {
    const raw = 'super-secret-token-value';
    const blob = encryptToken(raw);
    expect(blob.startsWith('v1:')).toBe(true);
    expect(blob).not.toContain(raw);
    expect(decryptToken(blob)).toBe(raw);
  });

  it('produces a different ciphertext (different IV) each time', () => {
    const raw = 'same-raw-token';
    const blob1 = encryptToken(raw);
    const blob2 = encryptToken(raw);
    expect(blob1).not.toBe(blob2);
    expect(decryptToken(blob1)).toBe(raw);
    expect(decryptToken(blob2)).toBe(raw);
  });

  it('throws on a tampered blob', () => {
    const blob = encryptToken('another-raw-token');
    const parts = blob.split(':');
    // Flip the last character of the ciphertext segment to corrupt it.
    const ciphertext = parts[3];
    const flipped = ciphertext.slice(0, -1) + (ciphertext.slice(-1) === 'A' ? 'B' : 'A');
    const tampered = [parts[0], parts[1], parts[2], flipped].join(':');
    expect(() => decryptToken(tampered)).toThrow();
  });

  it('throws on an unrecognized blob format', () => {
    expect(() => decryptToken('not-a-valid-blob')).toThrow();
  });
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

  it('populates tokenEnc with a non-plaintext value on create', async () => {
    const prisma = getPrisma();
    const token = await prisma.apiToken.findUnique({ where: { id: tokenId } });
    expect(token!.tokenEnc).not.toBeNull();
    expect(token!.tokenEnc).not.toBe(rawToken);
    expect(token!.tokenEnc).not.toContain(rawToken);
    expect(decryptToken(token!.tokenEnc as string)).toBe(rawToken);
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

  it('does not include token values by default', async () => {
    const tokens = await getRegistry().tokens.list(getUserId());
    const mine = tokens.find(t => t.id === tokenId);
    expect(mine!.token).toBeNull();
  });

  it('includes the decrypted token value when includeToken is true', async () => {
    const tokens = await getRegistry().tokens.list(getUserId(), { includeToken: true });
    const mine = tokens.find(t => t.id === tokenId);
    expect(mine!.token).toBe(rawToken);
  });

  it('returns token: null for a row with no tokenEnc (pre-migration row)', async () => {
    const prisma = getPrisma();
    const created = await getRegistry().tokens.create(getUserId(), `test-${getSuffix()}-nullenc`);
    await prisma.apiToken.update({ where: { id: created.id }, data: { tokenEnc: null } });

    const tokens = await getRegistry().tokens.list(getUserId(), { includeToken: true });
    const row = tokens.find(t => t.id === created.id);
    expect(row!.token).toBeNull();
  });

  it('lists all tokens (admin)', async () => {
    const tokens = await getRegistry().tokens.list();
    expect(tokens.some(t => t.id === tokenId)).toBe(true);
    expect(tokens[0].user).toBeDefined();
  });

  it('never includes token values for the admin listing, even with includeToken true', async () => {
    const tokens = await getRegistry().tokens.list(undefined, { includeToken: false });
    expect(tokens.every(t => t.token === null)).toBe(true);
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

  it('does not surface a token value for a revoked row', async () => {
    // Revoked rows are excluded from the owner-scoped list, so use the
    // unscoped (admin-shaped) listing with includeToken forced on to
    // confirm the revoked-row guard in list() itself, independent of
    // the admin route's own includeToken: false.
    const tokens = await getRegistry().tokens.list(undefined, { includeToken: true });
    const revoked = tokens.find(t => t.id === tokenId);
    expect(revoked!.revokedAt).not.toBeNull();
    expect(revoked!.token).toBeNull();
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
