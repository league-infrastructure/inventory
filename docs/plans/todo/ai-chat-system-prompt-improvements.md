---
status: pending
---

# Improve AI chat system prompt with external file and user context

## Description

The AI chat system prompt is currently hardcoded as a template string
in `server/src/services/ai-chat.service.ts`. It should be moved to an
external file and enriched with dynamic user context.

### Changes needed

1. **Move system prompt to a file**: Create a prompt template file
   (e.g., `server/src/prompts/ai-chat-system.md` or `.txt`) that
   contains the system instructions. Load it at startup using
   `fs.readFileSync`. TypeScript evaluates top-level code at import
   time, so this works the same as Python module-level execution.

2. **Add user context to the prompt**: Before each chat call, inject
   dynamic context into the system prompt:
   - **User identity**: name, role, custodian ID
   - **User location**: if the mobile app has provided geolocation
     coordinates, include them (e.g., "The user is near Site X")
   - **Recent audit log**: include the last few transfer/activity
     entries so the model has context about what the user has been
     doing recently

3. **Template interpolation**: Use simple placeholder substitution
   (e.g., `{{userName}}`, `{{recentActivity}}`) in the prompt file,
   replaced at runtime with actual values.

### Why

- Prompt text in source code is hard to read, review, and iterate on.
  External files make prompts a first-class artifact.
- User context makes the AI more helpful — it can greet by name,
  understand the user's role/permissions, suggest nearby sites, and
  reference recent activity without the user having to explain.

### Notes

- The system prompt is currently at `ai-chat.service.ts:78-90`.
- The `chat()` method already receives the `User` object and
  `ServiceRegistry`, so all the context data is accessible.
- Related TODO: `ai-chat-topic-guard-with-haiku.md` (Haiku pre-filter).
