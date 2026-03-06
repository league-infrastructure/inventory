import { PrismaClient, AuditSource } from '@prisma/client';

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

  async write(entries: AuditEntry | AuditEntry[]): Promise<void> {
    const list = Array.isArray(entries) ? entries : [entries];
    if (list.length === 0) return;

    await this.prisma.auditLog.createMany({
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
