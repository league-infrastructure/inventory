/**
 * Haversine distance between two lat/lng points in meters.
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface SiteWithCoords {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Find the nearest site to the given coordinates.
 * Returns null if no sites have coordinates.
 */
export function findNearestSite(
  lat: number,
  lon: number,
  sites: SiteWithCoords[],
): { site: SiteWithCoords; distance: number } | null {
  let best: { site: SiteWithCoords; distance: number } | null = null;
  for (const site of sites) {
    if (site.latitude == null || site.longitude == null) continue;
    const d = haversineDistance(lat, lon, site.latitude, site.longitude);
    if (!best || d < best.distance) {
      best = { site, distance: d };
    }
  }
  return best;
}

/** Threshold in meters for auto-suggesting a site on check-in. */
export const NEARBY_THRESHOLD_M = 500;
