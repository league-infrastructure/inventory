---
status: pending
---

# Slack AI Chat: Send Immediate Receipt Before Processing

When a large message is sent to the AI chat through Slack, the system should
immediately send back an acknowledgment like "Hey, I got your message. I'll
get started on the work." Then it processes the request and responds with the
result when finished.

Currently the system receives the message, does all the work, and only
responds when it's done. This makes it look like the system is locked up or
didn't receive the message, especially for longer-running tasks.

## Desired Behavior

1. Receive Slack message.
2. Immediately reply with a receipt/acknowledgment.
3. Process the request asynchronously.
4. Send the full response when processing completes.
