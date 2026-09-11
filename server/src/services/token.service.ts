import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { encryptToken, decryptToken } from './tokenCrypto';

export interface TokenCreateResult {
  id: number;
  label: string;
  prefix: string;
  token: string;
}

export interface TokenListItem {
  id: number;
  label: string;
  prefix: string;
  role: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  user?: { id: number; displayName: string; email: string };
  /**
   * The decrypted full token value, or `null`. Convention (relied on by
   * ticket 003 / the MCP Setup page):
   *   - `null` for revoked rows — never expose a revoked token's value.
   *   - `null` for rows created before this encryption support shipped
   *     (`tokenEnc` is `NULL` in the database).
   *   - `null` if decryption fails for any reason (tampered/corrupt blob,
   *     wrong key) rather than throwing.
   *   - `null` whenever `list()` was called with `includeToken: false`
   *     (e.g. the admin listing, which must never expose tokens).
   *   - Otherwise, the decrypted plaintext token.
   */
  token: string | null;
}

export interface TokenListOptions {
  /** When true, decrypt and include the full token value for eligible rows. */
  includeToken?: boolean;
}

export interface TokenValidationResult {
  userId: number;
  role: string;
}

export class TokenService {
  constructor(private prisma: PrismaClient) {}

  async create(userId: number, label: string): Promise<TokenCreateResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenEnc = encryptToken(rawToken);
    const prefix = rawToken.substring(0, 8);

    const record = await this.prisma.apiToken.create({
      data: {
        label,
        tokenHash,
        tokenEnc,
        prefix,
        userId,
        role: user.role,
      },
    });

    return { id: record.id, label: record.label, prefix, token: rawToken };
  }

  async list(userId?: number, options?: TokenListOptions): Promise<TokenListItem[]> {
    const where = userId != null
      ? { userId, revokedAt: null }
      : {};

    const tokens = await this.prisma.apiToken.findMany({
      where,
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const includeToken = options?.includeToken ?? false;

    return tokens.map((t) => {
      let token: string | null = null;
      if (includeToken && !t.revokedAt && t.tokenEnc) {
        try {
          token = decryptToken(t.tokenEnc);
        } catch {
          token = null;
        }
      }

      return {
        id: t.id,
        label: t.label,
        prefix: t.prefix,
        role: t.role,
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
        revokedAt: t.revokedAt?.toISOString() ?? null,
        expiresAt: t.expiresAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        user: t.user ? { id: t.user.id, displayName: t.user.displayName, email: t.user.email ?? '—' } : undefined,
        token,
      };
    });
  }

  async revoke(id: number, userId?: number): Promise<void> {
    const token = await this.prisma.apiToken.findUnique({ where: { id } });
    if (!token) throw new Error('Token not found');
    if (userId != null && token.userId !== userId) {
      throw new Error('Token not found');
    }

    await this.prisma.apiToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: number): Promise<void> {
    await this.prisma.apiToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async validate(rawToken: string): Promise<TokenValidationResult> {
    // Default dev token — bypasses DB, assumes first quartermaster
    const defaultToken = process.env.MCP_DEFAULT_TOKEN;
    if (defaultToken && rawToken === defaultToken) {
      const qm = await this.prisma.user.findFirst({
        where: { role: { in: ['QUARTERMASTER', 'ADMIN'] } },
        orderBy: { id: 'asc' },
      });
      if (!qm) throw new Error('No quartermaster/admin user found for default token');
      return { userId: qm.id, role: qm.role };
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const token = await this.prisma.apiToken.findUnique({ where: { tokenHash } });
    if (!token) throw new Error('Invalid token');
    if (token.revokedAt) throw new Error('Token revoked');
    if (token.expiresAt && token.expiresAt < new Date()) throw new Error('Token expired');

    await this.prisma.apiToken.update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    });

    return { userId: token.userId, role: token.role };
  }
}
