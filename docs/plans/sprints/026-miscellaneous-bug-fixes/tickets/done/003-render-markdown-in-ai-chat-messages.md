---
id: "003"
title: "Render markdown in AI chat messages"
status: done
use-cases: []
depends-on: []
---

# Render markdown in AI chat messages

## Description

AI assistant responses contain markdown (headings, lists, bold, code blocks)
but were displayed as plain text with `whitespace-pre-wrap`.

## Fix

Added `react-markdown` dependency and render assistant messages through
`<ReactMarkdown>`. User messages remain plain text. Applied Tailwind
prose classes with compact spacing for the chat bubble context.

## Acceptance Criteria

- [x] Assistant messages render markdown (bold, lists, headings, code)
- [x] User messages remain plain text
- [x] TypeScript compiles cleanly
