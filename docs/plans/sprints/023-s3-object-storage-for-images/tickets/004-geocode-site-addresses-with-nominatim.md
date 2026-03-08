---
id: "004"
title: "Geocode site addresses with Nominatim"
status: done
use-cases: []
depends-on: []
---

# Geocode site addresses with Nominatim

## Description

When a site is created or its address is updated, geocode the address
to lat/lng using the free Nominatim (OpenStreetMap) API. The Site model
already has `latitude` and `longitude` fields. No API key needed.

## Acceptance Criteria

- [x] SiteService calls Nominatim on create/update when address changes
- [x] Latitude and longitude are stored on the Site record
- [x] Geocoding failure does not block site save
- [x] No new dependencies (use native fetch)
- [x] Server compiles and tests pass

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: None (Nominatim is external; manual verification)
- **Verification command**: `cd server && npx tsc --noEmit`
