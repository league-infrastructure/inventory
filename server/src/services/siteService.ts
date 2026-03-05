import { prisma } from './prisma';
import { writeAuditLog, diffForAudit } from './auditLog';
import { NotFoundError, ValidationError } from './errors';
import { SiteRecord, CreateSiteInput, UpdateSiteInput, NearestSiteResult } from '../contracts';

const SITE_FIELDS = ['name', 'address', 'latitude', 'longitude', 'isHomeSite', 'isActive'];

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function listSites(): Promise<SiteRecord[]> {
  const sites = await prisma.site.findMany({
    where: { isActive: true },
    orderBy: [{ isHomeSite: 'desc' }, { name: 'asc' }],
  });
  return sites as unknown as SiteRecord[];
}

export async function getSite(id: number): Promise<SiteRecord> {
  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) throw new NotFoundError('Site not found');
  return site as unknown as SiteRecord;
}

export async function createSite(input: CreateSiteInput, userId: number): Promise<SiteRecord> {
  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new ValidationError('Name is required');
  }
  if (input.latitude != null && (typeof input.latitude !== 'number' || isNaN(input.latitude))) {
    throw new ValidationError('Latitude must be a valid number');
  }
  if (input.longitude != null && (typeof input.longitude !== 'number' || isNaN(input.longitude))) {
    throw new ValidationError('Longitude must be a valid number');
  }

  const site = await prisma.site.create({
    data: {
      name: input.name.trim(),
      address: input.address || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      isHomeSite: input.isHomeSite ?? false,
    },
  });

  await writeAuditLog(
    SITE_FIELDS.map((field) => ({
      userId,
      objectType: 'Site',
      objectId: site.id,
      field,
      oldValue: null,
      newValue: (site as any)[field] != null ? String((site as any)[field]) : null,
    })).filter((e) => e.newValue != null),
  );

  return site as unknown as SiteRecord;
}

export async function updateSite(id: number, input: UpdateSiteInput, userId: number): Promise<SiteRecord> {
  const existing = await prisma.site.findUnique({ where: { id } });
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

  const updated = await prisma.site.update({
    where: { id },
    data: {
      ...(input.name != null && { name: input.name.trim() }),
      ...(input.address !== undefined && { address: input.address || null }),
      ...(input.latitude !== undefined && { latitude: input.latitude ?? null }),
      ...(input.longitude !== undefined && { longitude: input.longitude ?? null }),
      ...(input.isHomeSite !== undefined && { isHomeSite: input.isHomeSite }),
    },
  });

  const auditEntries = diffForAudit(userId, 'Site', id, existing, updated, SITE_FIELDS);
  if (auditEntries.length > 0) {
    await writeAuditLog(auditEntries);
  }

  return updated as unknown as SiteRecord;
}

export async function deactivateSite(id: number, userId: number): Promise<SiteRecord> {
  const existing = await prisma.site.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Site not found');
  if (!existing.isActive) throw new ValidationError('Site is already deactivated');

  const updated = await prisma.site.update({
    where: { id },
    data: { isActive: false },
  });

  await writeAuditLog({
    userId,
    objectType: 'Site',
    objectId: id,
    field: 'isActive',
    oldValue: 'true',
    newValue: 'false',
  });

  return updated as unknown as SiteRecord;
}

export async function findNearestSite(latitude: number, longitude: number): Promise<NearestSiteResult> {
  if (typeof latitude !== 'number' || isNaN(latitude)) {
    throw new ValidationError('Latitude must be a valid number');
  }
  if (typeof longitude !== 'number' || isNaN(longitude)) {
    throw new ValidationError('Longitude must be a valid number');
  }

  const sites = await prisma.site.findMany({
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
