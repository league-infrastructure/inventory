---
status: pending
---

# Audit Log: Distinguish Slack Channel Actions from UI and MCP

The audit log currently shows actions performed via MCP tools but doesn't
distinguish them from UI actions or Slack commands. Actions originating
from the Slack channel should be clearly marked with their source.

- Tag each audit log entry with its source: `ui`, `mcp`, `slack`
- Display the source in the audit log view so it's clear where each
  action originated
- For Slack actions, include the Slack user who triggered the command
