---
status: in-progress
sprint: '006'
tickets:
- 006-001
---

# AI chat popup input should auto-expand up to ~8 lines

## Description

The message input in the AI chat popup is fixed-height. As the user
types longer messages or inserts manual newlines, the input should grow
to fit its content, up to a maximum of about 8 lines, after which it
scrolls internally. When the content shrinks (or the message is sent and
the field clears), the input shrinks back down.

## Requirements

1. Auto-grow with content: typing that wraps, and explicit newlines,
   both expand the input one line at a time.
2. Cap at ~8 lines tall; beyond that the textarea scrolls internally
   rather than growing further.
3. Shrinks back as content is removed; resets to single-line height
   after send/clear.
4. Multi-line entry works with the standard chat convention: Enter
   sends, Shift+Enter inserts a newline. Preserve the existing send
   button and any other current affordances.
5. No layout jump in the surrounding popup: the messages area should
   give way smoothly as the input grows.
