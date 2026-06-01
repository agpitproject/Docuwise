const rateLimit = require('express-rate-limit');

// General API limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Analysis routes poll for status updates, so let their dedicated rules handle them.
  skip: (req) => req.path.startsWith('/analysis'),
});

// Auth routes — stricter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' },
});

// Analysis routes — per user, based on plan in middleware
const analysisLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, message: 'Too many analysis requests. Slow down.' },
});

// Comment creation routes
const commentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { success: false, message: 'Too many comment requests. Slow down.' },
});

// Collaboration read routes (events/summary/stream)
const collabLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { success: false, message: 'Too many collaboration requests. Slow down.' },
});

module.exports = { apiLimiter, authLimiter, analysisLimiter, commentLimiter, collabLimiter };
