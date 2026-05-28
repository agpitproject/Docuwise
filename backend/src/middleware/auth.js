const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendError } = require('../utils/apiResponse');

const protect = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return sendError(res, 401, 'Not authorised - no token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return sendError(res, 401, 'User no longer exists');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Token expired - please log in again');
    }
    return sendError(res, 401, 'Invalid token');
  }
};

// Optional auth - attaches user if token present, doesn't block
const optionalAuth = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    }
  } catch (_) {
    // silently ignore
  }
  next();
};

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  if (isSseRequest(req) && typeof req.query?.token === 'string') {
    return req.query.token;
  }

  return null;
}

function isSseRequest(req) {
  const acceptsEventStream = String(req.headers.accept || '').includes('text/event-stream');
  const streamPath = String(req.path || '').endsWith('/stream');
  return req.method === 'GET' && streamPath && acceptsEventStream;
}

module.exports = { protect, optionalAuth };
