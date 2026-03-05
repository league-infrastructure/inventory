export interface SiteRecord {
  id: number;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isHomeSite: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSiteInput {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isHomeSite?: boolean;
}

export interface UpdateSiteInput {
  name?: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isHomeSite?: boolean;
}

export interface NearestSiteResult {
  site: Pick<SiteRecord, 'id' | 'name' | 'address' | 'latitude' | 'longitude'>;
  distanceKm: number;
}
