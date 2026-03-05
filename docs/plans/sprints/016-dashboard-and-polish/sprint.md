---
id: '016'
title: Dashboard and Polish
status: planning
branch: sprint/016-dashboard-and-polish
use-cases: []
---

# Sprint 016: Dashboard and Polish

## Goals

Build the role-specific dashboards, refine the mobile UX across the
application, deploy to production, and migrate data from the existing
Google Sheets spreadsheet.

## Problem

The application has all its features but no landing page that summarizes
the user's most relevant information. The mobile experience needs polish
for field use. The system needs to be deployed and loaded with real data.

## Solution

- Instructor dashboard: my checked-out Kits, recent activity, open issues
  I reported.
- Quartermaster dashboard: everything on the instructor dashboard plus
  all checked-out Kits, all open issues (with count), Kits needing
  inventory (sorted by last check date), recent audit activity feed.
- Mobile UX pass: review all flows on phone-sized screens, fix layout
  issues, optimize touch targets, ensure QR scan → action flows are
  smooth.
- Production deployment: Docker Swarm stack at inv.jointheleague.org,
  SOPS secrets, Caddy TLS.
- Data migration: import existing Google Sheets data using the import
  system from sprint 010.

## Success Criteria

- Instructor sees their dashboard after login with relevant, current data.
- Quartermaster sees the full dashboard with system-wide status.
- All flows work smoothly on mobile (iOS Safari, Android Chrome).
- Application is live at inv.jointheleague.org with TLS.
- Existing inventory data is imported and verified.

## Scope

### In Scope

- Instructor dashboard
- Quartermaster dashboard
- Mobile UX refinement across all pages
- Production Docker Swarm deployment
- SOPS/age secrets configuration for production
- Caddy configuration for inv.jointheleague.org
- Data migration from Google Sheets via import

### Out of Scope

- New features beyond dashboards
- Performance optimization (unless specific issues surface)
- Monitoring and alerting infrastructure

## Test Strategy

- Frontend tests: dashboard rendering with mock data, responsive layout.
- E2E tests: full user journeys on mobile viewport sizes.
- Deployment verification: smoke tests against production.
- Data migration: verify imported data against source spreadsheet.

## Architecture Notes

- Dashboards are composed of widgets that query existing API endpoints.
  No new data models are needed.
- The mobile UX pass is a cross-cutting concern — touch every page but
  prioritize the QR-scan-triggered flows (checkout, check-in, inventory
  check).
- Production deployment follows the template's Docker Swarm pattern
  documented in docs/deployment.md.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
