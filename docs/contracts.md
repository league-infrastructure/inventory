# Data Contracts Reference

This document describes the canonical JSON wire format for all domain
entities. These types are defined in `server/src/contracts/` and used
by the service layer, route handlers, and future MCP tools.

## Site

```typescript
interface SiteRecord {
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

interface CreateSiteInput {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isHomeSite?: boolean;
}

interface NearestSiteResult {
  site: { id, name, address, latitude, longitude };
  distanceKm: number;
}
```

## Computer

```typescript
interface ComputerRecord {
  id: number;
  serialNumber: string | null;
  serviceTag: string | null;
  model: string | null;
  defaultUsername: string | null;
  defaultPassword: string | null;
  disposition: string; // ACTIVE | NEEDS_REPAIR | DECOMMISSIONED | MISSING
  dateReceived: string | null;
  lastInventoried: string | null;
  notes: string | null;
  qrCode: string | null;
  siteId: number | null;
  kitId: number | null;
  createdAt: string;
  updatedAt: string;
  hostName: { id, name, computerId } | null;
  site: { id, name } | null;
  kit: { id, name } | null;
}
```

## Host Name

```typescript
interface HostNameRecord {
  id: number;
  name: string;
  computerId: number | null;
  computer: { id, model, serialNumber } | null;
}
```

## Kit

```typescript
interface KitRecord {
  id: number;
  name: string;
  description: string | null;
  status: string; // ACTIVE | RETIRED
  qrCode: string | null;
  siteId: number;
  createdAt: string;
  updatedAt: string;
  site: { id, name };
}

interface KitDetailRecord extends KitRecord {
  packs: PackRecord[];
  computers: { id, serialNumber, model, hostName }[];
}
```

## Pack

```typescript
interface PackRecord {
  id: number;
  name: string;
  description: string | null;
  qrCode: string | null;
  kitId: number;
  items: ItemRecord[];
}
```

## Item

```typescript
interface ItemRecord {
  id: number;
  name: string;
  type: string; // COUNTED | CONSUMABLE
  expectedQuantity: number | null;
  packId: number;
}
```

## Checkout

```typescript
interface CheckoutRecord {
  id: number;
  kitId: number;
  userId: number;
  destinationSiteId: number;
  returnSiteId: number | null;
  checkedOutAt: string;
  checkedInAt: string | null;
  kit: { id, name, qrCode? };
  user: { id, displayName };
  destinationSite: { id, name };
  returnSite: { id, name } | null;
}
```

## User

```typescript
interface UserRecord {
  id: number;
  email: string;
  displayName: string;
  avatar: string | null;
  role: string; // INSTRUCTOR | QUARTERMASTER
}
```

## Service Error Types

Services throw typed errors that the error handler maps to HTTP status:

| Error | Status Code | Usage |
|-------|-------------|-------|
| `NotFoundError` | 404 | Entity not found |
| `ValidationError` | 400 | Invalid input, business rule violation |
| `ConflictError` | 409 | Duplicate resource (e.g., hostname) |
