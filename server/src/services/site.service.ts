import { PrismaClient } from '@prisma/client';
import { AuditService } from './audit.service';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError } from './errors';
import { SiteRecord, CreateSiteInput, UpdateSiteInput, NearestSiteResult } from '../contracts';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class SiteService extends BaseService<SiteRecord, CreateSiteInput, UpdateSiteInput> {
  protected readonly entityName = 'Site';
  protected readonly auditFields = ['name', 'address', 'latitude', 'longitude', 'isHomeSite', 'isActive'];

  constructor(prisma: PrismaClient, audit: AuditService) {
    super(prisma, audit);
  }

  async list(): Promise<SiteRecord[]> {
    const sites = await this.prisma.site.findMany({
      where: { isActive: true },
      orderBy: [{ isHomeSite: 'desc' }, { name: 'asc' }],
    });
    return sites as unknown as SiteRecord[];
  }

  async get(id: number): Promise<SiteRecord> {
    const site = await this.prisma.site.findUnique({ where: { id } });
    if (!site) throw new NotFoundError('Site not found');
    return site as unknown as SiteRecord;
  }

  async create(input: CreateSiteInput, userId: number): Promise<SiteRecord> {
    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }
    if (input.latitude != null && (typeof input.latitude !== 'number' || isNaN(input.latitude))) {
      throw new ValidationError('Latitude must be a valid number');
    }
    if (input.longitude != null && (typeof input.longitude !== 'number' || isNaN(input.longitude))) {
      throw new ValidationError('Longitude must be a valid number');
    }

    if (input.isHomeSite) {
      await this.prisma.site.updateMany({
        where: { isHomeSite: true },
        data: { isHomeSite: false },
      });
    }

    const site = await this.prisma.site.create({
      data: {
        name: input.name.trim(),
        address: input.address || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        isHomeSite: input.isHomeSite ?? false,
      },
    });

    await this.auditCreate(userId, site.id, site);
    return site as unknown as SiteRecord;
  }

  async update(id: number, input: UpdateSiteInput, userId: number): Promise<SiteRecord> {
    const existing = await this.prisma.site.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Site not found');

    if (input.name != null && (typeof input.name !== 'string' || input.name.trim().length === 0)) {
      throw new ValidationError('Name cannot be empty');
    }
    if (input.latitude != null && typeof input.latitude !== 'number') {
      throw new ValidationError('Latitude must be a valid number');
    }
    if (input.longitude != null && typeof input.longitude !== 'number') {
      throw new ValidationError('Longitude must be a valid number');
    }

    if (input.isHomeSite) {
      await this.prisma.site.updateMany({
        where: { isHomeSite: true, id: { not: id } },
        data: { isHomeSite: false },
      });
    }

    const updated = await this.prisma.site.update({
      where: { id },
      data: {
        ...(input.name != null && { name: input.name.trim() }),
        ...(input.address !== undefined && { address: input.address || null }),
        ...(input.latitude !== undefined && { latitude: input.latitude ?? null }),
        ...(input.longitude !== undefined && { longitude: input.longitude ?? null }),
        ...(input.isHomeSite !== undefined && { isHomeSite: input.isHomeSite }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    const auditEntries = this.buildAuditEntries(userId, id, existing, updated);
    if (auditEntries.length > 0) {
      await this.writeAudit(auditEntries);
    }

    return updated as unknown as SiteRecord;
  }

  async deactivate(id: number, userId: number): Promise<SiteRecord> {
    const existing = await this.prisma.site.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Site not found');
    if (!existing.isActive) throw new ValidationError('Site is already deactivated');

    const updated = await this.prisma.site.update({
      where: { id },
      data: { isActive: false },
    });

    await this.writeAudit(this.createAuditEntry(userId, id, 'isActive', 'true', 'false'));
    return updated as unknown as SiteRecord;
  }

  async findNearest(latitude: number, longitude: number): Promise<NearestSiteResult> {
    if (typeof latitude !== 'number' || isNaN(latitude)) {
      throw new ValidationError('Latitude must be a valid number');
    }
    if (typeof longitude !== 'number' || isNaN(longitude)) {
      throw new ValidationError('Longitude must be a valid number');
    }

    const sites = await this.prisma.site.findMany({
      where: {
        isActive: true,
        latitude: { not: null },
        longitude: { not: null },
      },
    });

    if (sites.length === 0) {
      throw new NotFoundError('No sites with coordinates found');
    }

    let nearest = sites[0];
    let minDistance = haversineDistance(latitude, longitude, nearest.latitude!, nearest.longitude!);

    for (let i = 1; i < sites.length; i++) {
      const dist = haversineDistance(latitude, longitude, sites[i].latitude!, sites[i].longitude!);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = sites[i];
      }
    }

    return {
      site: {
        id: nearest.id,
        name: nearest.name,
        address: nearest.address,
        latitude: nearest.latitude,
        longitude: nearest.longitude,
      },
      distanceKm: Math.round(minDistance * 100) / 100,
    };
  }
}
