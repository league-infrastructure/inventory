---
id: "004"
title: "Configure Google OAuth for production and verify end-to-end"
status: dropped
use-cases:
  - SUC-025-002
  - SUC-025-003
depends-on:
  - "003"
---

# Configure Google OAuth for production and verify end-to-end

## Description

Register the production callback URL in the Google Cloud Console OAuth
app configuration, then verify the full app works end to end:

1. Add `https://inventory.jointheleague.org/api/auth/google/callback` as an
   authorized redirect URI in Google Cloud Console
2. Add `https://inventory.jointheleague.org` as an authorized JavaScript origin
3. Test Google OAuth login flow in browser
4. Verify QR codes generate with production domain
5. Verify image uploads to DO Spaces work
6. Test QR code scanning from a phone
7. Verify rolling restart: `docker service update --force inventory_server`

## Acceptance Criteria

- [ ] Google OAuth login works at https://inventory.jointheleague.org
- [ ] User can browse kits and view images after login
- [ ] QR codes contain `https://inventory.jointheleague.org/qr/...` URLs
- [ ] Scanning a QR code on phone opens the mobile page
- [ ] Image uploads work (photos appear in kit detail)
- [ ] Rolling restart completes without downtime

## Testing

- **Verification**: Manual browser testing of OAuth flow
- **Verification**: Scan QR code from phone, verify mobile page loads
- **Verification**: Upload an image, verify it appears
