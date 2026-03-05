import { PrismaClient } from '@prisma/client';
import { AuditService, AuditEntry } from './audit.service';

export abstract class BaseService<TRecord, TCreate, TUpdate> {
  protected prisma: PrismaClient;
  protected audit: AuditService;

  protected abstract readonly entityName: string;
  protected abstract readonly auditFields: string[];

  constructor(prisma: PrismaClient, audit: AuditService) {
    this.prisma = prisma;
    this.audit = audit;
  }

  abstract list(filters?: unknown): Promise<TRecord[]>;
  abstract get(id: number): Promise<TRecord>;
  abstract create(input: TCreate, userId: number): Promise<TRecord>;
  abstract update(id: number, input: TUpdate, userId: number): Promise<TRecord>;

  protected buildAuditEntries(
    userId: number,
    id: number,
    oldObj: Record<string, any>,
    newObj: Record<string, any>,
  ): AuditEntry[] {
    return this.audit.diff(userId, this.entityName, id, oldObj, newObj, this.auditFields);
  }

  protected async writeAudit(entries: AuditEntry | AuditEntry[]): Promise<void> {
    await this.audit.write(entries);
  }

  protected createAuditEntry(
    userId: number,
    id: number,
    field: string,
    oldValue: string | null,
    newValue: string | null,
  ): AuditEntry {
    return {
      userId,
      objectType: this.entityName,
      objectId: id,
      field,
      oldValue,
      newValue,
    };
  }

  protected async auditCreate(
    userId: number,
    id: number,
    obj: Record<string, any>,
  ): Promise<void> {
    const entries = this.auditFields
      .map((field) => ({
        userId,
        objectType: this.entityName,
        objectId: id,
        field,
        oldValue: null as string | null,
        newValue: (obj as any)[field] != null ? String((obj as any)[field]) : null,
      }))
      .filter((e) => e.newValue != null);
    if (entries.length > 0) {
      await this.audit.write(entries);
    }
  }
}
