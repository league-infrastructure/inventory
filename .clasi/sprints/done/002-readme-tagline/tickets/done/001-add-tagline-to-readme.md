---
id: '001'
title: Add tagline to README
status: done
use-cases: []
depends-on: []
github-issue: ''
issue: update-readme-tagline.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Add tagline to README

## Description

Add a one-sentence tagline directly beneath the application name in README.md
to give readers an immediate, plain-language description of what the project
does. This addresses the `update-readme-tagline.md` issue.

## Acceptance Criteria

- [x] A one-sentence tagline appears under the application name in README.md
- [x] No other content in README.md is changed or removed
- [x] No source code files are modified

## Implementation Plan

### Approach

Open README.md, locate the top-level application name heading, and insert a
single tagline sentence on the line immediately following it. No other lines
are touched.

### Files to Modify

- `README.md` — add tagline line after the application name heading

### Files to Create

None.

### Testing Plan

- Visually inspect the rendered README diff to confirm only the tagline line
  was added and all existing content is intact.
- No automated tests are needed; this is a documentation-only change.

### Documentation Updates

The change itself is the documentation update — no secondary docs required.
