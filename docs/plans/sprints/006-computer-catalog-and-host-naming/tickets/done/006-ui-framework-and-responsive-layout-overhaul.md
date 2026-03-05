---
id: "006"
title: "UI framework and responsive layout overhaul"
status: done
use-cases:
- SUC-001
- SUC-002
- SUC-003
- SUC-004
- SUC-005
depends-on:
- "004"
- "005"
---

# UI framework and responsive layout overhaul

## Description

Replace the current inline-styles-everywhere approach with Tailwind CSS
and shadcn/ui. Create a shared `AppLayout` component with responsive
navigation (sidebar on desktop, hamburger menu on mobile). Restyle all
17 page components to use the new framework. Remove the light-blue
background and adopt a clean, modern look (dark sidebar/header, white
content area).

## Scope

1. **Install Tailwind CSS v4 + shadcn/ui** — PostCSS, Tailwind config,
   CN utility, shadcn component primitives
2. **AppLayout component** — Responsive shell with:
   - Dark sidebar (desktop) / hamburger drawer (mobile)
   - Top header bar with user avatar, role badge, logout
   - Navigation: Home, Kits, Computers, Host Names, Admin (role-gated)
   - Content area with consistent padding
3. **Restyle all pages** — Convert inline `styles` objects to Tailwind
   classes. Use shadcn/ui components (Button, Input, Select, Table,
   Badge, Card, Dialog) where appropriate.
4. **Landing page** — Simplify to just auth redirect; authenticated
   users go straight to dashboard or kits list
5. **Mobile responsive** — All pages usable on phone screens (tables
   scroll horizontally, forms stack vertically)

## Acceptance Criteria

- [x] Tailwind CSS installed and configured in client/
- [x] Utility libs (clsx, tailwind-merge, lucide-react) installed instead of full shadcn/ui
- [x] AppLayout component with responsive sidebar/hamburger nav
- [x] All pages wrapped in AppLayout (except QrLanding which stays standalone)
- [x] No more inline `styles` objects in page components
- [x] Dark sidebar/header, white content area (no baby-blue background)
- [x] Mobile-friendly: hamburger menu, stacked forms, scrollable tables
- [x] User info and logout in header/sidebar
- [x] Role-gated nav items (Computers, Sites only for Quartermaster)
- [x] All existing functionality preserved (no broken routes or missing features)

## Testing

- **Existing tests to run**: `npm run test:server` and `cd client && npx tsc --noEmit`
- **New tests to write**: None (visual changes only; client test framework not installed)
- **Verification command**: `cd client && npx tsc --noEmit`
