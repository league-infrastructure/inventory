---
id: '003'
title: Quartermaster access list and role assignment
status: done
use-cases: []
depends-on:
- '001'
- '002'
---

# Quartermaster access list and role assignment

## Description

Implement the Quartermaster access list: a set of email patterns (literal
strings or regular expressions) stored in the database. When a Google OAuth
user logs in, their email is matched against all patterns. If any pattern
matches, the user's role is set to QUARTERMASTER; otherwise INSTRUCTOR.

Add an admin dashboard panel for managing these patterns.

## Acceptance Criteria

- [ ] QuartermasterPattern table stores patterns with an `isRegex` flag
- [ ] On login, user's email is matched against all active patterns
- [ ] Literal patterns match exactly (case-insensitive)
- [ ] Regex patterns match using JavaScript RegExp (case-insensitive)
- [ ] If any pattern matches, user role is set to QUARTERMASTER in the User table
- [ ] If no pattern matches, user role is set to (or remains) INSTRUCTOR
- [ ] Role is re-evaluated on every login (not cached permanently)
- [ ] Admin dashboard has a "Quartermaster Access" panel at `/admin/quartermasters`
- [ ] Admin can add a new pattern (with literal/regex toggle)
- [ ] Admin can delete a pattern
- [ ] Admin can see the list of current patterns
- [ ] Invalid regex patterns are rejected with an error message
- [ ] Changes to patterns take effect on next user login (no immediate session update needed)

## Testing

- **Existing tests to run**: `cd server && npm test`
- **New tests to write**: Pattern matching logic (literal match, regex match, no match, case insensitivity), CRUD endpoints for patterns, role assignment on login
- **Verification command**: `cd server && npm test`
