import { PrismaClient } from '@prisma/client';
import { AuditService } from './audit.service';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError } from './errors';
import { CategoryRecord, CreateCategoryInput, UpdateCategoryInput } from '../contracts';

export class CategoryService extends BaseService<CategoryRecord, CreateCategoryInput, UpdateCategoryInput> {
  protected readonly entityName = 'Category';
  protected readonly auditFields = ['name'];

  constructor(prisma: PrismaClient, audit: AuditService) {
    super(prisma, audit);
  }

  async list(): Promise<CategoryRecord[]> {
    const items = await this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    return items as unknown as CategoryRecord[];
  }

  async get(id: number): Promise<CategoryRecord> {
    const cat = await this.prisma.category.findUnique({ where: { id } });
    if (!cat) throw new NotFoundError('Category not found');
    return cat as unknown as CategoryRecord;
  }

  async create(input: CreateCategoryInput, userId: number): Promise<CategoryRecord> {
    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }

    const existing = await this.prisma.category.findUnique({ where: { name: input.name.trim() } });
    if (existing) {
      throw new ValidationError(`Category "${input.name.trim()}" already exists`);
    }

    const cat = await this.prisma.category.create({
      data: { name: input.name.trim() },
    });

    await this.auditCreate(userId, cat.id, cat);
    return cat as unknown as CategoryRecord;
  }

  async update(id: number, input: UpdateCategoryInput, userId: number): Promise<CategoryRecord> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Category not found');

    if (input.name != null) {
      if (typeof input.name !== 'string' || input.name.trim().length === 0) {
        throw new ValidationError('Name cannot be empty');
      }
      const dup = await this.prisma.category.findUnique({ where: { name: input.name.trim() } });
      if (dup && dup.id !== id) {
        throw new ValidationError(`Category "${input.name.trim()}" already exists`);
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(input.name != null && { name: input.name.trim() }),
      },
    });

    const auditEntries = this.buildAuditEntries(userId, id, existing, updated);
    if (auditEntries.length > 0) {
      await this.writeAudit(auditEntries);
    }

    return updated as unknown as CategoryRecord;
  }

  async delete(id: number): Promise<void> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Category not found');

    const kitCount = await this.prisma.kit.count({ where: { categoryId: id } });
    const computerCount = await this.prisma.computer.count({ where: { categoryId: id } });
    if (kitCount > 0 || computerCount > 0) {
      throw new ValidationError(`Cannot delete: ${kitCount} kit(s) and ${computerCount} computer(s) still using this category`);
    }

    await this.prisma.category.delete({ where: { id } });
  }
}
