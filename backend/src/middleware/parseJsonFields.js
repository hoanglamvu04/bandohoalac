import { AppError } from '../utils/AppError.js';

export function parseJsonFields(...fields) {
  return function parseJsonFieldsMiddleware(req, _res, next) {
    for (const field of fields) {
      const value = req.body[field];
      if (typeof value === 'string' && value.length) {
        try {
          req.body[field] = JSON.parse(value);
        } catch {
          return next(new AppError(`Invalid JSON in field "${field}".`, 400));
        }
      }
    }
    return next();
  };
}
