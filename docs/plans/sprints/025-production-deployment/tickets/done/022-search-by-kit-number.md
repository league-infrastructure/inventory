---
id: "022"
title: "Search by kit number"
status: done
use-cases: []
depends-on: []
---

# Search by kit number

## Description

When a user searches for a number, it should match kit numbers. The
SearchService currently only searches by name/description/serial/model.

## Acceptance Criteria

- [x] SearchService returns kit matches when query is a number
- [x] Web UI search bar finds Kit #16 when searching "16"
