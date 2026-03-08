---
status: pending
---

# Geocode Site Addresses

Automatically geocode site addresses to latitude/longitude when a site
is created or its address is updated. The Site model already has
`latitude` and `longitude` fields — they just need to be populated.

## Requirements

- When a site address is saved (create or update), geocode it to
  lat/lng and store the coordinates
- Use a free geocoding service (this is very low frequency — a handful
  of sites, updated rarely)
- Candidates:
  - **Nominatim (OpenStreetMap)** — free, no API key needed, 1 req/sec
    rate limit. Perfect for this use case.
  - **US Census Geocoder** — free, no key, US addresses only
- Nominatim is the best fit: no key, no cost, adequate rate limits
- Geocode server-side in the SiteService on create/update
- If geocoding fails, save the site without coordinates (don't block)
- Consider a simple fetch to the Nominatim API — no extra dependency
  needed
