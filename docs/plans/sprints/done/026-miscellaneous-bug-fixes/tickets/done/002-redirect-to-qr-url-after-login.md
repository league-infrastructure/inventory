---
id: "002"
title: "Redirect to QR URL after login"
status: done
use-cases: []
depends-on: []
---

# Redirect to QR URL after login

## Description

When scanning a QR code while not logged in, the main app's Sign in
button didn't include a `returnTo` parameter, so after Google OAuth
the user landed on the dashboard instead of the original page.

## Fix

Added `returnTo={location.pathname}` to the Sign in link in AppLayout.

## Acceptance Criteria

- [x] Main app Sign in button includes returnTo parameter
- [x] After login, user is redirected to the page they were on
