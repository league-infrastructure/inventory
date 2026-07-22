---
id: '001'
title: Auto-expanding chat input textarea
status: open
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

- [ ] Typing text that wraps to a second or third visual line grows the
      textarea by roughly one line per additional line of content.
- [ ] Pressing Shift+Enter to insert a manual newline grows the
      textarea the same way.
- [ ] Growth stops at ~8 lines (computed from the textarea's own
      computed line-height, not a hardcoded constant); beyond that, the
      textarea scrolls internally (`overflow-y: auto`) rather than
      growing further or overflowing the popup.
- [ ] Deleting content shrinks the textarea back down, line by line.
- [ ] Sending the message (Enter, no Shift) or manually clearing the
      field resets the textarea to its original one-line height.
- [ ] Enter still sends the message; Shift+Enter still inserts a
      newline; the send button and other input-row affordances are
      unchanged.
- [ ] The resize has a short (~100ms) CSS transition so it reads as
      smooth, not an instant snap.
- [ ] The messages list above the input (`AiChat.tsx:233`,
      `flex-1 overflow-y-auto`) visibly gives way as the input
      grows/shrinks, with no layout jump, overlap, or clipped content
      in the popup.
- [ ] `npx tsc --noEmit` (or `npx tsc -b`) is clean.
- [ ] `npx vite build` succeeds.

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
