---
id: '002'
title: Nearest site endpoint and GPS helper
status: done
use-cases: []
depends-on: []
---

# Nearest site endpoint and GPS helper

## Description

Add nearest site endpoint using Haversine distance calculation.

## Acceptance Criteria

- [x] POST /api/sites/nearest accepts latitude/longitude
- [x] Haversine formula calculates distance in km
- [x] Returns nearest active site with distance
- [x] Validates coordinate inputs
- [x] TypeScript compiles clean
