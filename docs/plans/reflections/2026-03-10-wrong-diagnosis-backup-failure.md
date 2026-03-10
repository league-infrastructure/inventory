---
date: 2026-03-10
sprint: 027
category: ignored-instruction
---

## What Happened

When the stakeholder reported backup failures in development (500 error
from the admin backup button), I assumed the scheduler tick middleware was
the source and proposed disabling it in non-production. The stakeholder
corrected me: the error was from manually clicking the backup button in
the Import/Export admin page, not from the scheduler.

I then proposed another bad fix (changing the scheduler tick to
production-only) without investigating the actual failure.

## What Should Have Happened

I should have:
1. Read the error carefully — a 500 from the admin backup route, not
   from the scheduler tick.
2. Investigated the actual failure path: admin backup button → POST
   /api/admin/backups → BackupService.createBackup() → docker compose
   exec fallback → what exactly fails?
3. Fixed the root cause at the correct layer.

## Root Cause

Ignored instruction. AGENTS.md says: "Don't fix source code to unblock
builds" and more broadly, fix problems at the correct layer rather than
routing around them. I applied a workaround (disable the feature) instead
of diagnosing the actual error. I also didn't read the error message
carefully enough to understand what code path was actually failing.

## Proposed Fix

When a user reports an error, always investigate before proposing a fix.
Trace the error to its source. Don't disable features as a first resort.
