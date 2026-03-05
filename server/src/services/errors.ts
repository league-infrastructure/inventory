/**
 * Service layer error types.
 *
 * Services throw these errors; route handlers catch them
 * and map to HTTP status codes via the error handler middleware.
 */

export class ServiceError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends ServiceError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'ConflictError';
  }
}
