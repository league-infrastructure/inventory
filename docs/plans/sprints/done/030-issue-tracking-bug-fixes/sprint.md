---
id: '030'
title: Issue Tracking Bug Fixes
status: done
branch: sprint/030-issue-tracking-bug-fixes
use-cases: []
---

# Sprint 030: Issue Tracking Bug Fixes

## Goals

Fix all bugs preventing the issue tracking feature from working in
production. Add Slack conversation history so the AI bot maintains
context across messages.

## Problem

The issue model was expanded in sprint 028 to support kits and computers
(making packId/itemId optional), but several UI components and the AI
chat service were not updated to handle the new nullable relationships.

Additionally, Slack AI chat treats every message as independent — the
bot has no memory of previous messages from the same user.

Specific problems:
1. **Dashboard crash** — `Landing.tsx` OpenIssuesWidget uses a stale
   local `IssueRecord` interface (`packName`, `description`) that doesn't
   match the API contract (`pack: { id, name } | null`). When an issue
   has no pack (kit/computer-only), accessing `.name` on null crashes.
2. **No create-issue buttons on admin pages** — Issue creation only
   exists on QR mobile pages. The main Kit, Pack, and Computer detail
   pages in the admin UI have no way to create issues.
3. **AI chat has no issue tools** — `create_issue`, `list_issues`, and
   `resolve_issue` exist in MCP tools but were never added to the AI
   chat service's tool definitions.
4. **Issues list page may also crash** — `IssueList.tsx` accesses
   `issue.item.name` and `issue.pack.name` without null checks, which
   will crash on kit/computer-only issues.
5. **Slack AI has no conversation history** — The Slack route always
   passes `[]` for conversation history. Each message is independent,
   so the bot can't follow multi-turn conversations.

## Solution

- Fix all null-safety issues in the dashboard and issues list pages
- Add create-issue buttons to Kit, Pack, and Computer admin detail pages
- Wire issue tools into the AI chat service
- Add a `SlackConversation` Prisma model to persist Slack message pairs
- Load the last 5 conversation rounds when handling a new Slack message

## Success Criteria

- Dashboard loads without crashing when issues exist
- Issues list page displays all issue types correctly
- Users can create issues from Kit, Pack, and Computer admin detail pages
- AI chat (web + Slack) can list, create, and resolve issues
- Slack bot remembers context from recent messages

## Scope

### In Scope

- Fix Landing.tsx OpenIssuesWidget null crash
- Fix IssueList.tsx null safety
- Add create-issue UI to admin Kit/Pack/Computer detail pages
- Add issue tools to AI chat service
- Slack conversation history (Prisma model + last 5 rounds)

### Out of Scope

- New issue types or workflow changes
- Issue notifications or assignments
- Web chat server-side history (client already manages it)

## Test Strategy

Run `npm run test:server` for backend. Visual verification for UI fixes.

## Architecture Notes

One schema addition: `SlackConversation` model for persisting Slack
message history. No other architectural changes.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [x] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [x] Architecture review passed
- [x] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
