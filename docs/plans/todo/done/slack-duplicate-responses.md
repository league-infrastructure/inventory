---
status: done
sprint: '025'
tickets:
- '020'
---

# Slack bot sends duplicate responses

When asking the inventory bot a question via DM, it responds twice with
slightly different wording. For example, asking "who has kit 16" produces
two separate messages at the same timestamp.

## Likely cause

Slack retries event delivery if the bot takes too long to process. Even
though we respond with `200 OK` immediately, Slack may send duplicate
events or the event handler may be triggered twice. Possible causes:

1. **Slack retry on slow response** — Slack retries events after ~3
   seconds if it hasn't received an acknowledgment. Our server responds
   with 200 immediately, but if the connection is slow (TLS handshake
   through Caddy), the retry may fire before the ack arrives.

2. **Duplicate event delivery** — Slack sometimes delivers the same event
   twice. The fix is to deduplicate by `event_id` or `event.client_msg_id`.

## Fix

Add event deduplication: track recently-seen event IDs in memory and skip
duplicates.

```typescript
const recentEvents = new Map<string, number>(); // eventId → timestamp

// In the event handler, after verification:
const eventId = req.body?.event_id || req.body?.event?.client_msg_id;
if (eventId && recentEvents.has(eventId)) return;
if (eventId) {
  recentEvents.set(eventId, Date.now());
  // Clean up old entries every 100 events
  if (recentEvents.size > 100) {
    const cutoff = Date.now() - 60000;
    for (const [id, ts] of recentEvents) {
      if (ts < cutoff) recentEvents.delete(id);
    }
  }
}
```
