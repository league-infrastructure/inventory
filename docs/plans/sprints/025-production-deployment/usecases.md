---
status: draft
---

# Sprint 025 Use Cases

## SUC-025-001: Deploy App to Production Swarm

**Actor:** Developer (deployer)

**Preconditions:**
- swarm1 Docker context is configured and reachable
- Caddy reverse proxy is running with *.jtlapp.net wildcard
- Age key is available for SOPS decryption

**Flow:**
1. Developer runs the deploy process
2. Docker builds the production image (server + client)
3. Swarm secrets are created from encrypted prod secrets
4. Stack is deployed to swarm1
5. Prisma migrations run against the production database
6. App is accessible at https://inventory.jtlapp.net

**Postconditions:**
- Health endpoint returns 200
- App serves the React frontend
- API routes respond correctly

---

## SUC-025-002: Production OAuth Login

**Actor:** User (quartermaster, instructor)

**Preconditions:**
- App is deployed at inventory.jtlapp.net
- Google OAuth app has production callback URL registered

**Flow:**
1. User navigates to https://inventory.jtlapp.net
2. User clicks "Sign in with Google"
3. Google OAuth redirects to production callback URL
4. User is authenticated and sees the dashboard

**Postconditions:**
- Session is established
- User can access protected routes

---

## SUC-025-003: Production QR Code Scanning

**Actor:** Instructor with phone

**Preconditions:**
- App is deployed with QR_DOMAIN set to production URL
- Labels have been printed with QR codes

**Flow:**
1. Instructor scans QR label on a kit
2. Phone browser opens https://inventory.jtlapp.net/qr/k/:id
3. Instructor signs in (if not already)
4. Instructor sees kit details and can check in/out

**Postconditions:**
- QR codes resolve to the production domain
- Mobile pages work on phone browsers
