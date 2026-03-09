---
id: "004"
title: "AI chat navigates to items on request"
status: done
use-cases: []
depends-on: []
---

# AI chat navigates to items on request

## Description

When users say "show me Kit 16" or "take me to" an item, the AI should
include clickable links that navigate to the item's page without a full
page reload.

## Fix

Two changes:

1. **System prompt** (`ai-chat-system.txt`): Instruct the AI to include
   markdown links (e.g., `[Kit 16](/kits/16)`) when referencing items.

2. **Client** (`AiChat.tsx`): Custom markdown link renderer that
   intercepts internal links (starting with `/`) and uses React Router's
   `navigate()` for client-side navigation. External links open in a
   new tab.

## Acceptance Criteria

- [x] AI includes links when referencing inventory items
- [x] Clicking a link in chat navigates to the item page
- [x] Navigation is client-side (no full page reload)
- [x] TypeScript compiles cleanly
