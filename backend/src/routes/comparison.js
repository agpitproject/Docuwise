const express = require('express');
const router = express.Router();

const {
  createComparison,
  getComparison,
  listComparisons,
  deleteComparison,
} = require('../controllers/comparisonController');
const { protect } = require('../middleware/auth');
const { analysisLimiter } = require('../middleware/rateLimit');

router.use(protect);

// POST /api/comparisons
router.post('/', analysisLimiter, createComparison);

// GET /api/comparisons
router.get('/', listComparisons);

// GET /api/comparisons/:id
router.get('/:id', getComparison);

// DELETE /api/comparisons/:id
router.delete('/:id', deleteComparison);

module.exports = router;
