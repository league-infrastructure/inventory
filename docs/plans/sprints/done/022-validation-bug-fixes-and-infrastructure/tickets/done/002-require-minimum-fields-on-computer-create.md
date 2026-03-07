---
id: "002"
title: "Require minimum fields on computer create"
status: done
use-cases: []
depends-on: []
---

# Require minimum fields on computer create

## Acceptance Criteria

- [x] ComputerService.create() rejects input with no serialNumber, serviceTag, or model
- [x] ValidationError message is clear
