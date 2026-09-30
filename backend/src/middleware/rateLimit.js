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
    const url = String(req.originalUrl || req.url || '').split('?')[0];
    return (
      req.method === 'GET' &&
      (
        url === '/api/places/bounds' ||
        url === '/api/map-layers'
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


export const claimRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Bạn đã gửi quá nhiều yêu cầu xác minh. Hãy thử lại sau.' }
});

export const rewardRedeemRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Bạn đang thử đổi hoặc xác nhận voucher quá nhanh. Hãy chờ một lúc.' }
});

export const partnerScanRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Có quá nhiều lần kiểm tra voucher. Hãy chờ một lúc.' }
});
