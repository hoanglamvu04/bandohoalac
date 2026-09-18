import { AppError } from '../utils/AppError.js';

export function validateBody(schema) {
  return function validateBodyMiddleware(req, _res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new AppError('Invalid request body.', 400, result.error.flatten()));
    }
    req.body = result.data;
    return next();
  };
}

export function validateQuery(schema) {
  return function validateQueryMiddleware(req, _res, next) {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new AppError('Invalid query parameters.', 400, result.error.flatten()));
    }
    req.query = result.data;
    return next();
  };
}
