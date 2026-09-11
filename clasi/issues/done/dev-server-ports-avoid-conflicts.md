---
status: done
tickets:
- NONE
---

# Move the dev server and dev client off ports 3000 and 5173

## Problem

`npm run dev` starts the API on `3000` and Vite on `5173`. Those are the
default ports for nearly every other Node project on the stakeholder's
machine (33 sibling configs use 5173, 10 use 3000), so starting this project
constantly collides with whatever else is running. Only the **dev** setup
should change; production (`docker-compose.yml`, `Dockerfile.server`,
Caddy upstream on 3000) stays as is.

## Proposed ports

- API server: **9310**
- Vite client: **9311**

Both are free on the stakeholder's machine as of 2026-09-11 and unused by
sibling projects.

## Every place the dev ports are wired

- `config/dev/public.env` — add `PORT=9310`, `VITE_API_URL=http://localhost:9310`,
  and change the three `*_CALLBACK_URL` values from `localhost:5173` to
  `localhost:9311`. Regenerate `.env` via `dotconfig load dev`.
- `secrets/dev.env.example` — same callback URL change.
- `package.json` `dev:local:client` — `wait-on http://localhost:9310/api/health`
  and pass `--port 9311` to Vite (or read the port in `vite.config.ts`).
- `client/vite.config.ts` — set `server.port` from `VITE_PORT` (default 9311),
  keep `apiTarget` default `http://localhost:9310`, fix the comments.
- `server/src/index.ts:15` and `server/src/middleware/schedulerTick.ts:11` —
  default `PORT` may stay 3000 (production relies on it) as long as
  `PORT` is set in the dev env; or change the default and set `PORT` in
  `docker-compose.yml` (it already sets `PORT: "3000"`).
- `server/src/services/qr.service.ts:17` and `label.service.ts:37` —
  fallback `http://localhost:5173` for QR/label base URLs; set
  `APP_BASE_URL=http://localhost:9311` in dev env instead of editing code.
- `playwright.config.ts:22` — `baseURL` to `http://localhost:9311`.
- `.mcp.json` — `http://localhost:9310/api/mcp`.
- `.devcontainer/devcontainer.json` — `forwardPorts` and `PORT`.
- `docs/` and `AGENTS.md`/`README.md` mentions of the dev URLs.

## Required manual step (not code)

The Google OAuth client used for dev has
`http://localhost:5173/api/auth/google/callback` registered as an authorized
redirect URI. After the change, add
`http://localhost:9311/api/auth/google/callback` in the Google Cloud
console for that client, or dev Google login will fail with
`redirect_uri_mismatch`.

## Acceptance

- `npm run dev` brings up the API on 9310 and the client on 9311 with no
  reference to 3000/5173 in the dev path.
- Google login in dev works after the console redirect URI is added.
- Production compose/Dockerfile untouched.
