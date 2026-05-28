const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { register, login, googleAuth, getMe, updateMe, generateApiKey } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

// POST /api/auth/register
router.post(
  '/register',
  authLimiter,
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  register
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

// POST /api/auth/google
router.post('/google', authLimiter, googleAuth);

// GET  /api/auth/me
router.get('/me', protect, getMe);

// PATCH /api/auth/me
router.patch('/me', protect, updateMe);

// POST /api/auth/api-key
router.post('/api-key', protect, generateApiKey);

module.exports = router;
