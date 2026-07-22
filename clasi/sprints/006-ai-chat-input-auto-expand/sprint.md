---
id: '006'
title: AI Chat Input Auto-Expand
status: planning-docs
branch: sprint/006-ai-chat-input-auto-expand
worktree: false
use-cases:
- SUC-001
issues:
- ai-chat-input-auto-expand.md
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Sprint 006: AI Chat Input Auto-Expand

## Goals

Make the AI chat popup's message input auto-expand as the user types or
inserts manual newlines, up to a cap of about 8 lines (then scroll
internally), shrink back down as content is removed, and reset to
one-line height after send/clear — while preserving the existing
Enter-to-send / Shift+Enter-newline convention and causing no jarring
layout jump in the popup.

## Problem

`client/src/components/AiChat.tsx`'s message input is a `<textarea>`
pinned to `rows={1}` with Tailwind's `resize-none`
(`client/src/components/AiChat.tsx:265-274`) — a fixed single-line box
regardless of content. A user composing a longer message, or one who
uses Shift+Enter to add a manual line break, can't see more than one
line of what they've typed without scrolling inside a one-line field.
Shift+Enter already inserts a newline today — `handleKeyDown`
(`AiChat.tsx:195-200`) only intercepts plain `Enter` (calling
`handleSend()`) and lets `Enter` with `shiftKey` fall through to the
textarea's default behavior — so the newline-insertion half of the
requirement is existing, preserved behavior; only the *visual growth*
in response to that content is missing. A repo-wide search found no
existing auto-resize pattern (no `scrollHeight` usage, no
`react-textarea-autosize` or similar dependency, no `useAutoResize`
hook) anywhere in `client/src` — this sprint introduces that behavior
for the first time, it does not restore something that regressed.

## Solution

Add scrollHeight-driven auto-resize to the existing textarea in
`AiChat.tsx`, capped at ~8 lines with internal `overflow-y` scroll
beyond the cap, and wire it to reset to one-line height whenever the
input becomes empty (after `handleSend()` clears it, or the user
deletes/clears it manually). No new component and no new dependency —
implemented as a small resize routine inside `AiChat.tsx`, invoked from
the existing `onChange` handler and after `handleSend()`. Enter-to-send
and Shift+Enter-newline are functionally unchanged; only the field's
height responds to content now. The messages list above the input
already renders as `flex-1 overflow-y-auto` inside the popup's
`flex flex-col` container (`AiChat.tsx:217`, `:233`), so it already
absorbs height changes in its input-row sibling automatically — no
new layout code is needed there — but a short CSS `transition` on the
textarea's height is added so the resize reads as a smooth give, not a
visible snap.

## Success Criteria

- Typing text that wraps to a second or third visual line grows the
  textarea by roughly one line per additional line of content.
- Pressing Shift+Enter to insert a manual newline grows the textarea
  the same way.
- Growth stops at ~8 lines; beyond that, the textarea scrolls
  internally rather than continuing to grow or pushing the popup's
  outer bounds.
- Deleting content shrinks the textarea back down, line by line; after
  the message is sent (or the field is cleared manually), it returns to
  its original one-line height.
- Enter still sends the message; Shift+Enter still inserts a newline;
  the send button and other input-row affordances are unchanged.
- The messages list visibly gives way as the input grows/shrinks, with
  no jump, overlap, or clipped content in the popup.
- `npx tsc --noEmit` (or the project's `tsc -b`) and `npx vite build`
  both succeed; manual verification against the bullets above is
  recorded in the ticket (no automated test runner exists for the
  client — see Test Strategy).

## Scope

### In Scope

- `client/src/components/AiChat.tsx`: auto-resize logic on the message
  textarea (grow-with-content, ~8-line cap with internal scroll beyond
  it, shrink-on-empty/clear), plus a CSS transition for smooth resize.

### Out of Scope

- Send/receive/streaming logic, message rendering, or popup open/close
  behavior in `AiChat.tsx` — unchanged.
- Server-side AI chat behavior (`server/src/services/ai-chat.service.ts`,
  chat routes) — unrelated to this client-only presentational change.
- Other textareas in the app (`KitForm.tsx`, `ComputerForm.tsx`,
  `NotesSection.tsx`) — these keep their existing manual
  drag-to-resize (`resize-y`) behavior; this issue is scoped to the AI
  chat popup only.

## Test Strategy

No automated test runner exists for the client: `client/package.json`
defines only `dev`, `build`, `lint`, `preview` — no `test` script.
Root `package.json`'s `test:client` script invokes `vitest`, but
`vitest` is not installed anywhere in the repo (absent from both
`client/package.json` and root dependencies, no config file, no binary
in `client/node_modules/.bin`) — running it today would fail, and
installing/wiring up a test runner is out of scope for this sprint.

Quality bar for this ticket: `npx tsc --noEmit` clean and
`npx vite build` succeeds (both already available via the existing
`build` script, `tsc -b && vite build`), plus a manual verification
pass against this sprint's Success Criteria, recorded as a checklist in
the ticket.

## Architecture

**Compact** — a single existing component
(`client/src/components/AiChat.tsx`) gains auto-resize behavior on its
message textarea; no new module or component, no new cross-module
dependency, no dependency-direction change, no data-model change.

### Architecture Overview

**What Changed**: `AiChat.tsx`'s message textarea moves from a static
`rows={1}` / `resize-none` box to one whose height is computed at
runtime from its content. On every keystroke (`onChange`) and whenever
`handleSend()` clears the input, a small resize routine resets the
element's height to `auto`, reads `scrollHeight`, and sets `height` to
`min(scrollHeight, maxHeightPx)` — where `maxHeightPx` corresponds to
~8 lines at the field's current font size/line-height/padding — toggling
`overflowY` between `hidden` and `auto` at that cap. The change is
entirely contained inside `AiChat.tsx`: no new file, no new export, no
change to the component's props or its relationship to `AppLayout.tsx`
(which renders `<AiChat />` with no props today).

**Why**: This is a UX refinement to an existing input, not a new
capability — no new data flows, no new state shared outside the
component.

**Impact on Existing Components**: None outside `AiChat.tsx`. The
messages list (`AiChat.tsx:233`, `flex-1 overflow-y-auto`) sits in the
same `flex flex-col` popup container as the input row and already
absorbs the input row's height changes via normal flex layout — it
needs no code change, only benefits from an added CSS transition on the
textarea so the resulting shrink/grow reads as smooth rather than an
abrupt snap. No other component reads or depends on the textarea's
internal sizing.

**Migration Concerns**: None — purely a client-side, presentational
change. No persisted data, no API contract, no auth/session behavior is
touched; ships as an ordinary client build with no sequencing
requirements.

### Design Rationale

**Decision**: Use JS `scrollHeight`-based auto-resize (measure content,
set height imperatively) rather than the CSS `field-sizing: content`
property.

**Context**: The textarea must grow with content up to a cap of ~8
lines then scroll internally, and shrink back on delete/clear, with no
layout jump elsewhere in the popup. Two realistic mechanisms exist: (a)
CSS `field-sizing: content` on a `max-height`-capped textarea, letting
the browser handle intrinsic sizing; or (b) a small `onChange`-driven
routine that measures `scrollHeight` and sets `height` in JS (the
technique every "autosize textarea" library uses internally).

**Alternatives considered**: `field-sizing: content` was considered as
the more CSS-native, dependency-free option. A third-party library
(e.g. `react-textarea-autosize`) was also considered.

**Why this choice**: The repo declares no `browserslist` or explicit
build target (`client/tsconfig.app.json` targets `ES2022`;
`client/vite.config.ts` has no `build.target` override, so Vite 7's
"widely-available baseline" default applies) — there is no documented
basis for assuming `field-sizing` support across whatever browsers this
internal tool's users run, since it is a very recently standardized
property. The JS `scrollHeight` approach is the long-established,
universally-supported technique for this exact problem and needs no new
dependency; the codebase has zero UI/component library dependencies
today (`client/src/components/ui/` is an empty directory, styling is
hand-rolled Tailwind throughout), so ~15-20 lines of inline resize logic
is more consistent with the existing style than adding
`react-textarea-autosize` for a single input.

**Consequences**: A small amount of imperative DOM measurement lives
inside an otherwise-declarative React component (not unusual for this
specific problem — every autosize library does the same thing under
the hood). The ~8-line cap and "reset to one line on send/clear" both
need explicit handling in the resize routine and in `handleSend()`
respectively; if a future sprint adds a component library, this local
routine could be revisited, but that is not a concern for this sprint.

## Use Cases

### SUC-001: Chat input grows and shrinks with message content
Parent: SUC-011-001 (Chat with AI about inventory — refines that use
case's message-composition step)

- **Actor**: Authenticated user (Instructor or Quartermaster) composing
  a message in the AI chat popup.
- **Preconditions**: The AI chat popup is open.
- **Main Flow**:
  1. User types a message in the chat input.
  2. As the typed text wraps to additional lines, or the user presses
     Shift+Enter to insert a manual newline, the input grows taller to
     show the additional line(s), up to ~8 lines.
  3. Beyond ~8 lines, the input stops growing and scrolls internally.
  4. User presses Enter (without Shift) to send the message.
  5. The input clears and returns to its original one-line height.
- **Postconditions**: The message is sent as before; the input is back
  at its baseline single-line height, ready for the next message.
- **Acceptance Criteria**:
  - [ ] Input grows roughly one line at a time as wrapped text or
        manual newlines are added, up to ~8 lines.
  - [ ] Beyond ~8 lines, the input scrolls internally instead of
        growing further.
  - [ ] Deleting content shrinks the input back down; sending or
        clearing the message resets it to one-line height.
  - [ ] Enter sends; Shift+Enter inserts a newline (unchanged).
  - [ ] The messages list above the input resizes smoothly as the
        input grows/shrinks, with no layout jump or clipped content.

## GitHub Issues

N/A — tracked only via the CLASI issue
`clasi/issues/ai-chat-input-auto-expand.md`; no GitHub issue is linked
to this sprint.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [x] Sprint planning document is complete (sprint.md, including its
      Architecture and Use Cases sections)
- [x] Architecture review passed (or skipped, for changes with no
      architectural impact)
- [x] Stakeholder has approved the sprint plan

## Tickets

| # | Title | Depends On |
|---|-------|------------|
| 001 | Auto-expanding chat input textarea | (none) |

Tickets execute serially in the order listed.
