import { PrismaClient, AuditSource, Prisma } from '@prisma/client';

export interface AuditEntry {
  userId: number | null;
  objectType: string;
  objectId: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  source?: AuditSource;
}

export class AuditService {
  private defaultSource: AuditSource;

  constructor(private prisma: PrismaClient, defaultSource: AuditSource = 'UI') {
    this.defaultSource = defaultSource;
  }

  /**
   * Write audit rows. Pass a `tx` (from `prisma.$transaction(async (tx) => ...)`)
   * to write inside a caller's own transaction, so the audit rows commit or
   * roll back atomically with the mutation they describe. Defaults to the
   * service's own PrismaClient when omitted.
   */
  async write(
    entries: AuditEntry | AuditEntry[],
    client: PrismaClient | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const list = Array.isArray(entries) ? entries : [entries];
    if (list.length === 0) return;

    await client.auditLog.createMany({
      data: list.map((e) => ({
        userId: e.userId,
        objectType: e.objectType,
        objectId: e.objectId,
        field: e.field,
        oldValue: e.oldValue,
        newValue: e.newValue,
        source: e.source ?? this.defaultSource,
      })),
    });
  }

  diff(
    userId: number | null,
    objectType: string,
    objectId: number,
    oldObj: Record<string, any>,
    newObj: Record<string, any>,
    fields: string[],
    source?: AuditSource,
  ): AuditEntry[] {
    const entries: AuditEntry[] = [];
    for (const field of fields) {
      const oldVal = oldObj[field];
      const newVal = newObj[field];
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        entries.push({
          userId,
          objectType,
          objectId,
          field,
          oldValue: oldVal != null ? String(oldVal) : null,
          newValue: newVal != null ? String(newVal) : null,
          source: source ?? this.defaultSource,
        });
      }
    }
    return entries;
  }
}
