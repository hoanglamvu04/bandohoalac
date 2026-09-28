import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Please try again later.' }
});

export const contributionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many contributions submitted. Please try again later.' }
});

export const generalApiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 180,
  standardHeaders: true,
  legacyHeaders: false,
  skip(req) {
    // Interactive map reads naturally fire more often while users pan/zoom.
    // They have a separate limiter below so they do not consume the budget
    // for login/profile/admin APIs.
    return (
      req.method === 'GET' &&
      (
        req.path === '/places/bounds' ||
        req.path === '/map-layers'
      )
    );
  }
});

export const mapReadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 900,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Map data is being requested too quickly. Please wait a moment.'
  }
});
