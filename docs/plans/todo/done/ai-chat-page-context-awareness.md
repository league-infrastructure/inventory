---
status: done
sprint: '031'
tickets:
- '001'
---

# AI chat assistant should receive page context

When the AI chat assistant pops up, it should receive rich context about
where the user currently is in the application:

- Which page they're on (e.g., kit detail, computer detail, pack list)
- Which specific entity they're viewing (kit number/name, computer
  hostname, pack name, etc.)
- Any relevant state (e.g., open issues on this kit, current custodian,
  inventory check status)

This context should be passed to the AI chat backend so the assistant can
reason about the user's question in the context of what they're looking at,
rather than requiring the user to specify "kit 42" or "the laptop with
serial XYZ" explicitly.
