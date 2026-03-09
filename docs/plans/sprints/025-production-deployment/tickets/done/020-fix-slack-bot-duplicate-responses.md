---
id: "020"
title: "Fix Slack bot duplicate responses"
status: done
use-cases: []
depends-on: []
---

# Fix Slack bot duplicate responses

## Description

Bot sends duplicate responses because Slack retries event delivery. Added
event deduplication using `event_id` tracking in memory.

## Acceptance Criteria

- [x] Event deduplication via in-memory Map of recent event IDs
- [x] Duplicates within 2-minute window silently dropped
- [x] Map auto-cleans old entries
