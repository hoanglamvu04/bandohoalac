import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  const isOperational = err.isOperational === true;

  if (!isOperational) {
    console.error(err);
  }

  const body = {
    error: isOperational ? err.message : 'Internal server error.'
  };

  if (err.details) body.details = err.details;
  if (env.nodeEnv !== 'production' && !isOperational) body.stack = err.stack;

  res.status(statusCode).json(body);
}
