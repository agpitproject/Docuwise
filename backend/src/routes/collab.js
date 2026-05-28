const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { collabLimiter } = require('../middleware/rateLimit');
const {
  getCollabEvents,
  getCollabSummary,
  getCollabStream,
} = require('../controllers/collabController');

router.use(protect);
router.use(collabLimiter);

router.get('/:documentId/events', getCollabEvents);
router.get('/:documentId/summary', getCollabSummary);
router.get('/:documentId/stream', getCollabStream);

module.exports = router;
