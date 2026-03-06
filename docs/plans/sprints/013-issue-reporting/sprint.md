---
id: '013'
title: Issue Reporting
status: in-progress
branch: sprint/013-issue-reporting
use-cases:
- SUC-013-001
- SUC-013-002
- SUC-013-003
---

# Sprint 013: Issue Reporting

## Goals

Implement the issue reporting and resolution workflow: flag missing items,
flag consumables needing replenishment, and resolve issues.

## Problem

When instructors find missing items or depleted consumables, there is no
structured way to report this or track resolution.

## Solution

- Flag a missing item or consumable from an issue reporting UI
- Issue queue: all users see open issues, filterable by type and status
- Resolve an issue: mark an issue resolved with optional notes
- All actions recorded in audit log

## Tickets

- 001: Issue Service and Contract
- 002: Issue Routes
- 003: Issue Queue Frontend
