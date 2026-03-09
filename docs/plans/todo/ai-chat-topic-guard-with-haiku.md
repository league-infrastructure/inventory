---
status: pending
---

# AI chat topic guard with Haiku pre-filter

## Description

Add a frontend processing layer to the AI chat feature that screens
every incoming message before forwarding it to the main reasoning model.

### How it should work

1. When a user sends a message in the chat, collect the last few
   messages of context plus the new message.
2. Send them to a cheap, fast model (e.g., Claude Haiku) with a prompt
   like: "Is the following a reasonable request for inventory
   management? Answer yes or no."
3. If Haiku says yes, forward the message to the reasoning model
   (e.g., Sonnet) that handles the actual work.
4. If Haiku says no, respond to the user with a polite message
   explaining that this chat is for inventory management tasks only.

### Why

We don't want users using our chat sessions for non-inventory work.
The Haiku pre-filter keeps costs down by only sending legitimate
inventory requests to the more expensive reasoning model.

### Notes

- The guard should include the last few messages for context, not just
  the single new message, so it can understand follow-up questions.
- Keep the Haiku prompt simple and focused — it just needs to decide
  if the topic is inventory-related.
- Consider edge cases: greetings, clarification questions, and
  meta-questions about the system should probably be allowed through.
