const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');

// Reuse one Google client across requests.
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


// Generate JWT
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/google
const googleAuth = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return sendError(res, 400, 'Google token missing');
  if (!process.env.GOOGLE_CLIENT_ID) return sendError(res, 500, 'Google auth is not configured');

  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  const email = payload?.email?.trim().toLowerCase();
  if (!email) return sendError(res, 400, 'Google account email is required');

  let user = await User.findOne({ email });

  if (!user) {
    const fallbackName = payload.name || 'Google User';
    const [firstName, ...rest] = fallbackName.trim().split(/\s+/);

    user = await User.create({
      firstName: payload.given_name || firstName || 'Google',
      lastName: payload.family_name || rest.join(' ') || 'User',
      email,
      password: uuidv4(),
    });
  }

  const jwtToken = signToken(user._id);
  sendSuccess(res, 200, 'Google login successful', { token: jwtToken, user: user.toPublicJSON() });
});

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendError(res, 400, 'Validation failed', errors.array());

  const { firstName, lastName, password } = req.body;
  const email = req.body.email.trim().toLowerCase();

  const existing = await User.findOne({ email });
  if (existing) return sendError(res, 409, 'Email already registered');

  const user = await User.create({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email,
    password,
  });
  const token = signToken(user._id);

  sendSuccess(res, 201, 'Account created', { token, user: user.toPublicJSON() });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendError(res, 400, 'Validation failed', errors.array());

  const { password } = req.body;
  const email = req.body.email.trim().toLowerCase();

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return sendError(res, 401, 'Invalid email or password');
  }

  const token = signToken(user._id);
  sendSuccess(res, 200, 'Login successful', { token, user: user.toPublicJSON() });
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  sendSuccess(res, 200, 'User profile', { user: user.toPublicJSON() });
});

// PATCH /api/auth/me
const updateMe = asyncHandler(async (req, res) => {
  const allowed = ['firstName', 'lastName', 'defaultLanguage', 'notifications', 'privacy'];
  const updates = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  sendSuccess(res, 200, 'Profile updated', { user: user.toPublicJSON() });
});

// POST /api/auth/generate-api-key
const generateApiKey = asyncHandler(async (req, res) => {
  const apiKey = `dw_live_${uuidv4().replace(/-/g, '')}`;
  const user = await User.findByIdAndUpdate(req.user._id, { apiKey }, { new: true });
  sendSuccess(res, 200, 'API key generated', {
    apiKey: user.apiKey,
    warning: 'API key authentication is not enabled yet. Use JWT authentication.',
  });
});

module.exports = { register, login, googleAuth, getMe, updateMe, generateApiKey };
