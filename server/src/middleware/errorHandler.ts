import { Request, Response, NextFunction } from 'express';
import { ServiceError } from '../services/errors';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ServiceError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
}
