---
id: '001'
title: Service error types and error handler update
status: done
use-cases:
  - SUC-001
depends-on: []
---

# Service error types and error handler update

## Description

Create typed error classes for the service layer and update the Express
error handler middleware to map them to HTTP status codes. This is the
foundation that all service modules depend on — services throw these
errors, and the error handler converts them to appropriate HTTP
responses.

### Files created/modified

- `server/src/services/errors.ts` — new file with error class hierarchy
- `server/src/middleware/errorHandler.ts` — updated to catch `ServiceError`

### Implementation details

Error class hierarchy:

- `ServiceError` (base) — carries a `statusCode` property
- `NotFoundError` extends `ServiceError` — status 404
- `ValidationError` extends `ServiceError` — status 400
- `ConflictError` extends `ServiceError` — status 409

The error handler checks `err instanceof ServiceError` before the
generic 500 fallback and returns `{ error: err.message }` with the
appropriate status code.

## Acceptance Criteria

- [x] `ServiceError` base class with `statusCode` property
- [x] `NotFoundError` (404), `ValidationError` (400), `ConflictError` (409) subclasses
- [x] Error handler catches `ServiceError` and maps to HTTP status codes
- [x] Existing 500 fallback still works for non-service errors

## Testing

- **Existing tests to run**: `npm run test:server` — existing API tests should still pass
- **Verification**: Error handler correctly returns 404/400/409 for service errors
