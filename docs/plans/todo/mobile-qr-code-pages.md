---
status: pending
---

# Mobile-Optimized QR Code Pages

## Problem

When scanning QR codes on a mobile phone (e.g. `/k/413`), the existing
desktop-oriented pages render blank or broken on small screens. The
current pages are designed for desktop management workflows, not the
quick check-in/check-out actions that QR scanning implies.

## Requirements

### Separate mobile page routes

Create a new set of pages under `/qr/` optimized for mobile:

- `/qr/k/:id` — Kit quick-action page
- `/qr/p/:id` — Pack quick-action page
- `/qr/c/:id` — Computer quick-action page

The QR codes on printed labels should link to these `/qr/` paths instead
of the current `/k/`, `/p/`, `/c/` paths.

### Post-login redirect preservation

When an unauthenticated user scans a QR code:

1. Store the original URL (e.g. `/qr/k/413`) in the session before
   redirecting to Google OAuth login.
2. After successful login, redirect back to the stored URL — not the
   home page.

This is currently broken: login always redirects to `/`.

### Actions (in priority order)

1. **Check in / Check out** — most common action
   - Check out: default to self-checkout, option for another user.
   - Check in: default to current site (use geolocation to match).
   - Confirm with one tap.

2. **Transfer** — move to a different site or custodian.

3. **Report an issue** — flag a problem with a kit, pack, or computer.

4. **Add a photo** — snap a photo from the phone camera and attach it.

5. ~~AI chat~~ — only QM would use this; omit from mobile QR pages.

### Mobile-first design

- Large touch targets, minimal text input.
- Show item name, number, current status prominently.
- Single-purpose: check in/out is the primary action.
- Optional "View full details" link to the desktop page for management.
- Voice dictation to the AI chat could handle anything more complex.

### Three object types

Each of the three QR page types (kit, pack, computer) follows the same
pattern:

1. Display item identity (name, number, photo if available).
2. Show current status (checked out to whom, at which site).
3. Primary action buttons: "Check Out to Me" / "Check In Here".
4. Secondary: assign to someone else, transfer to a different site.

## Technical Notes

- Update `LabelService` QR code generation to use `/qr/` prefix.
- The existing short-URL redirects (`/k/:id`, `/p/:id`, `/c/:id`) should
  continue working for desktop users.
- Session `returnTo` field needed for OAuth redirect flow.
- Consider a responsive breakpoint approach vs. completely separate pages.
  Stakeholder preference: separate pages under `/qr/`.
