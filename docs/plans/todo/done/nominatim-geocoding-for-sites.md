---
status: done
sprint: '025'
tickets:
- '012'
---

# Set up Nominatim geocoding for sites

## Description

Use the free Nominatim (OpenStreetMap) geocoder to geocode site addresses
into latitude/longitude coordinates.

### Changes needed

1. **Site list UI**: Show latitude and longitude columns in the admin
   sites panel. If a site has no coordinates but has an address, show a
   small "Geocode" button next to it.

2. **Geocode button**: When clicked, call a server endpoint that uses
   Nominatim to look up the site's address and store the resulting
   lat/lng on the site record.

3. **Server endpoint**: `POST /api/admin/sites/:id/geocode` — reads the
   site's address, calls `https://nominatim.openstreetmap.org/search`,
   parses the result, and updates the site's latitude/longitude fields.

### Notes

- The SiteService already has Nominatim geocoding support
  (`geocodeAddress` method) — it auto-geocodes on create/update when an
  address is provided without explicit coordinates.
- This TODO adds a manual trigger button for sites that were created
  before geocoding was implemented or where auto-geocoding failed.
- Nominatim requires a User-Agent header and has rate limits (1 req/sec).
  The existing implementation already handles this.
