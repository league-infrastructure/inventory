import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

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
    const prefix = rawToken.substring(0, 8);

    const record = await this.prisma.apiToken.create({
      data: {
        label,
        tokenHash,
        prefix,
        userId,
        role: user.role,
      },
    });

    return { id: record.id, label: record.label, prefix, token: rawToken };
  }

  async list(userId?: number): Promise<TokenListItem[]> {
    const where = userId != null
      ? { userId, revokedAt: null }
      : {};

    const tokens = await this.prisma.apiToken.findMany({
      where,
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return tokens.map((t) => ({
      id: t.id,
      label: t.label,
      prefix: t.prefix,
      role: t.role,
      lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
      revokedAt: t.revokedAt?.toISOString() ?? null,
      expiresAt: t.expiresAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      user: t.user ? { id: t.user.id, displayName: t.user.displayName, email: t.user.email } : undefined,
    }));
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
