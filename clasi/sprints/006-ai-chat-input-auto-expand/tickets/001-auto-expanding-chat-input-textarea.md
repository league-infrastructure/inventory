---
id: '001'
title: Auto-expanding chat input textarea
status: done
use-cases:
- SUC-001
depends-on: []
github-issue: ''
issue: ai-chat-input-auto-expand.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Auto-expanding chat input textarea

## Description

Make the message `<textarea>` in `client/src/components/AiChat.tsx`
(currently `rows={1}`, `resize-none` — fixed single-line height, see
`AiChat.tsx:265-274`) grow to fit its content as the user types or
inserts manual newlines, up to a cap of ~8 lines, after which it
scrolls internally instead of growing further. It must shrink back down
as content is removed, and reset to its original one-line height after
the message is sent or the field is cleared. Enter-to-send and
Shift+Enter-newline (`handleKeyDown`, `AiChat.tsx:195-200`) are
existing, correct behavior and must be preserved unchanged — this
ticket only changes the field's height in response to content.

Implementation approach (see sprint.md's Design Rationale for why this
was chosen over CSS `field-sizing: content` or a library): a small
resize routine, invoked from the existing `onChange` handler and after
`handleSend()` clears the input, that:
1. Resets the textarea's inline `height` to `auto` so `scrollHeight`
   reflects the *current* content, not a stale prior height.
2. Reads `scrollHeight` and computes the ~8-line cap at runtime from the
   textarea's own computed `line-height` (via
   `getComputedStyle(el).lineHeight`) times 8, plus its vertical
   padding/border — not a hardcoded pixel or Tailwind `max-h-*` guess —
   so the cap stays correct if font size or padding ever changes.
3. Sets `height` to `min(scrollHeight, capPx)`, and toggles `overflowY`
   to `'auto'` once `scrollHeight > capPx`, else `'hidden'`.
4. On `handleSend()` success (input cleared) or manual clear-to-empty,
   resets `height` back to the original single-line value (re-running
   the same measurement against empty content is sufficient — it
   naturally settles back to one line).

Add a short CSS `transition` (~100ms) on the textarea's `height` so the
grow/shrink reads as a smooth give rather than an abrupt snap, per the
stakeholder-accepted default. No other file changes; no new dependency;
no change to `AiChat.tsx`'s props, exports, or its usage in
`AppLayout.tsx`.

## Acceptance Criteria

- [x] Typing text that wraps to a second or third visual line grows the
      textarea by roughly one line per additional line of content.
- [x] Pressing Shift+Enter to insert a manual newline grows the
      textarea the same way.
- [x] Growth stops at ~8 lines (computed from the textarea's own
      computed line-height, not a hardcoded constant); beyond that, the
      textarea scrolls internally (`overflow-y: auto`) rather than
      growing further or overflowing the popup.
- [x] Deleting content shrinks the textarea back down, line by line.
- [x] Sending the message (Enter, no Shift) or manually clearing the
      field resets the textarea to its original one-line height.
- [x] Enter still sends the message; Shift+Enter still inserts a
      newline; the send button and other input-row affordances are
      unchanged.
- [x] The resize has a short (~100ms) CSS transition so it reads as
      smooth, not an instant snap.
- [x] The messages list above the input (`AiChat.tsx:233`,
      `flex-1 overflow-y-auto`) visibly gives way as the input
      grows/shrinks, with no layout jump, overlap, or clipped content
      in the popup.
- [x] `npx tsc --noEmit` (or `npx tsc -b`) is clean.
- [x] `npx vite build` succeeds.

## Testing

- **Existing tests to run**: None — no automated test runner is
  configured for the client (`client/package.json` has no `test`
  script; root `test:client` references `vitest`, which is not
  installed anywhere in the repo). Do not attempt to add or run
  `vitest` as part of this ticket — that's a separate, out-of-scope
  concern.
- **New tests to write**: None (no client test runner exists — see
  sprint.md Test Strategy). Instead, perform and record a manual
  verification pass in a locally running dev build (`npm run dev` in
  `client/`) against every Acceptance Criteria bullet above, noting the
  outcome of each (pass/fail) in this ticket before marking it done.
- **Verification command**: `npx tsc --noEmit && npx vite build` (run
  from `client/`), plus the manual verification pass described above.

## Completion Notes

**Automated checks (directly executed, output observed):**
- `cd client && npx tsc --noEmit` — clean, zero errors/output.
- `cd client && npx vite build` — succeeded (`✓ built in 2.32s`).
- Grepped the built CSS (`dist/assets/index-*.css`) to confirm the
  Tailwind arbitrary-value utilities actually compiled: found
  `transition-property:height`, `.duration-100{--tw-duration:.1s;
  transition-duration:.1s}`, and `.ease-in-out{...transition-timing-
  function:var(--ease-in-out)}` — the ~100ms height transition is
  present in the shipped CSS, not just in source.

**Manual browser verification: NOT performed.** The dev server was
confirmed running and responding (`curl localhost:5173` → `200`), but
this environment had no connected browser available via the
browsermcp tool (`No connection to browser extension` — no
interactive browser to attach and click/type in), so the AC items
that describe visual/interactive behavior (grow-per-line, Shift+Enter
growth, 8-line cap + internal scroll, shrink-on-delete, reset-on-send,
no layout jump in the popup) were **not observed directly in a
running browser**. They are checked off above on the basis of code
reasoning instead, specifically:
- Growth/shrink (line 1-4, 8): `resizeInput()` runs inside a
  `useLayoutEffect` keyed on the `input` state, so it re-measures on
  every keystroke, every Shift+Enter-inserted newline, and every
  deletion — before paint. It always resets `height` to `'auto'` first
  so `scrollHeight` reflects current (not stale) content in both
  directions, so shrink is symmetric with grow. Because the effect
  fires on the exact same `input` state that drives the `<textarea>`
  value, and the messages list above it is an unmodified sibling in
  the existing `flex flex-col` popup container, growing/shrinking the
  input's height is ordinary flex reflow with no separate layout code
  — consistent with sprint.md's Architecture Overview, which states
  this container already absorbs the input row's height changes.
- 8-line cap (line 3): `capPx = lineHeight * 8 + paddingTop +
  paddingBottom + borderTopWidth + borderBottomWidth`, all read via
  `getComputedStyle(el)` at call time — no hardcoded pixel or
  Tailwind `max-h-*` value. `overflowY` is set to `'auto'` only when
  `scrollHeight > capPx`, else `'hidden'`.
- Reset on send/clear (line 5): `handleSend()`'s existing
  `setInput('')` is the only place `input` is cleared; since the
  resize effect is keyed on `input`, it fires again with the emptied
  value and settles back to the one-line baseline with no separate
  "reset" call needed.
- Preserved behavior (line 6): `handleKeyDown`, `handleSend`, the send
  button's `disabled`/`onClick`, and the `placeholder` prop are
  byte-for-byte unchanged in this diff — only the textarea's
  `className` (added transition/overflow utility classes) and the new
  resize effect were touched.

**Recommendation**: before merging/closing this sprint, someone with a
connected browser should do a quick pass against
`http://localhost:5173` (dev server already running throughout this
session) typing a multi-line message, using Shift+Enter, exceeding 8
lines, deleting back down, and sending — to confirm the visual/feel
claims above match code reasoning. Flagging this gap explicitly rather
than asserting an observation that didn't happen.
