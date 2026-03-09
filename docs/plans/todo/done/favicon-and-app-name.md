---
status: done
sprint: '025'
tickets:
- '021'
---

# Set up favicon and fix app name

The app is still showing "client-tmp" as the app name (likely in the
browser tab title) and has no favicon. Need to brand it properly.

## Favicon

Use the League flag logo: `https://images.jointheleague.org/logos/flag.png`

- Download and place in `client/public/favicon.png` (or convert to .ico)
- Update `client/index.html` to reference the favicon:
  ```html
  <link rel="icon" type="image/png" href="/favicon.png">
  ```

## App name

- Update the `<title>` in `client/index.html` from "client-tmp" to
  "Inventory" (or "League Inventory")
- Check `client/vite.config.ts` or `client/package.json` for any
  references to "client-tmp" that should be updated
