import { AuditSource } from '@prisma/client';
import { prisma } from './prisma';

interface AuditEntry {
  userId: number | null;
  objectType: string;
  objectId: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  source?: AuditSource;
}

/**
 * Write one or more audit log entries. Call this after a successful
 * database write to record what changed.
 */
export async function writeAuditLog(entries: AuditEntry | AuditEntry[]) {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) return;

  await prisma.auditLog.createMany({
    data: list.map((e) => ({
      userId: e.userId,
      objectType: e.objectType,
      objectId: e.objectId,
      field: e.field,
      oldValue: e.oldValue,
      newValue: e.newValue,
      source: e.source ?? 'UI',
    })),
  });
}

/**
 * Compare two objects and return audit entries for changed fields.
 * Useful for update operations.
 */
export function diffForAudit(
  userId: number | null,
  objectType: string,
  objectId: number,
  oldObj: Record<string, any>,
  newObj: Record<string, any>,
  fields: string[],
  source: AuditSource = 'UI',
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
        source,
      });
    }
  }
  return entries;
}
