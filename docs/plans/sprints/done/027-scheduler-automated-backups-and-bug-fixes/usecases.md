---
status: draft
---

# Sprint 027 Use Cases

## SUC-001: Scheduler Tick Executes Due Jobs

- **Actor**: System (internal trigger or external caller)
- **Preconditions**: ScheduledJob records exist with `enabled = true`
- **Main Flow**:
  1. Tick route is invoked (via middleware piggyback or external HTTP call).
  2. System queries for jobs where `nextRunAt <= now` and `enabled = true`.
  3. For each due job, attempt `SELECT ... FOR UPDATE SKIP LOCKED`.
  4. If lock acquired, execute the job's handler function.
  5. On success: update `lastRunAt`, compute `nextRunAt`, clear `lastError`.
  6. On failure: log the error, write error message to `lastError` field.
  7. Return count of jobs executed.
- **Postconditions**: Due jobs have been executed; next run times updated.
- **Acceptance Criteria**:
  - [ ] Due jobs are executed on tick
  - [ ] Locked jobs are skipped (no double execution)
  - [ ] Job errors are captured in `lastError` and logged
  - [ ] Response returns count of jobs executed

## SUC-002: Request-Piggyback Scheduler Trigger

- **Actor**: System (on any incoming HTTP request)
- **Preconditions**: Server is running; tick interval is configured
- **Main Flow**:
  1. An HTTP request arrives at the Express server.
  2. Middleware checks in-memory `nextTickTime` timestamp.
  3. If `Date.now() >= nextTickTime`, reset timer and fire async internal
     request to `/api/scheduler/tick` (fire-and-forget).
  4. If not due, do nothing (single timestamp comparison).
  5. The original request proceeds without delay.
- **Postconditions**: Scheduler tick fires roughly every N minutes while
  the app receives traffic.
- **Acceptance Criteria**:
  - [ ] Tick fires automatically when interval expires
  - [ ] Original request is not blocked or delayed
  - [ ] Timer resets after each tick trigger

## SUC-003: Automated Backup Rotation

- **Actor**: Scheduler (daily-backup and weekly-backup jobs)
- **Preconditions**: BackupService is functional; S3 credentials configured
- **Main Flow**:
  1. Scheduler tick triggers the daily-backup job.
  2. System creates a backup with naming format
     `daily-<dow>-<YYYY-MM-DD>.dump` (e.g., `daily-1-2026-03-10.dump`).
  3. System deletes any existing daily backup with the same day-of-week
     number (retention: 6 daily backups).
  4. Backup is uploaded to S3 under `backups/` prefix.
  5. Weekly-backup job follows the same pattern with naming format
     `weekly-<YYYY-MM-DD>.dump`, retaining the last 4 weekly backups.
- **Postconditions**: At most 6 daily and 4 weekly backups exist in S3.
  Manual backups are untouched.
- **Acceptance Criteria**:
  - [ ] Daily backups created with correct naming convention
  - [ ] Old daily backups with same day-of-week are deleted
  - [ ] At most 6 daily backups retained
  - [ ] Weekly backups created with correct naming convention
  - [ ] At most 4 weekly backups retained
  - [ ] Manual backups (no daily-/weekly- prefix) are never deleted

## SUC-004: Slack AI Chat Immediate Receipt

- **Actor**: Slack user
- **Preconditions**: User sends a message via Slack DM, mention, or thread
- **Main Flow**:
  1. Slack event is received and acknowledged (HTTP 200).
  2. System immediately posts a receipt message: "Got your message — working
     on it now."
  3. System processes the message through AiChatService.
  4. System posts the full AI response as a follow-up message.
- **Postconditions**: User sees immediate feedback, then the full response.
- **Acceptance Criteria**:
  - [ ] Receipt message appears within seconds of sending
  - [ ] Full AI response follows as a separate message
  - [ ] Receipt is sent for all AI-processed messages (DMs, mentions, threads)
  - [ ] Slash commands that use AI also show receipt before processing

## SUC-005: MCP Kit Category Update Fix

- **Actor**: MCP client (Claude Code)
- **Preconditions**: Kit and Category records exist
- **Main Flow**:
  1. MCP client calls `update_kit` with a `categoryId` value.
  2. System correctly coerces the ID (string/number/null via `zIdParam()`).
  3. KitService persists the category change.
  4. Audit log records the category change.
- **Postconditions**: Kit's category is updated; change is audited.
- **Acceptance Criteria**:
  - [ ] `update_kit` with valid categoryId persists the change
  - [ ] `update_kit` with `null` categoryId clears the category
  - [ ] Category changes appear in the audit log
  - [ ] Custodian changes appear in the audit log (also missing)
  - [ ] MCP tool description clearly documents categoryId expectations
