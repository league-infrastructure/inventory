---
id: "019"
title: "Slack slash commands for Inventory Bot"
status: done
use-cases: []
depends-on: []
---

# Slack slash commands for Inventory Bot

## Description

Add slash commands for common inventory operations directly from Slack.

## Acceptance Criteria

- [x] `/inventory`, `/haswhat`, `/whereis`, `/checkout`, `/checkin`, `/transfer`, `/report`, `/sites`, `/kits`, `/inventory-help` commands implemented
- [x] Manifest updated with all command definitions
- [x] Lookup commands query services directly; action commands route through AI chat
- [x] All responses use `in_channel` response type
