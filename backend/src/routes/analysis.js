const express = require('express');
const router = express.Router();

const {
  runAnalysis,
  getAnalysis,
  listAnalyses,
  askQuestion,
  getAIGuide,
  batchAnalyse,
  batchInsights,
  getActivity,
  activityStream,
  activityStats,
  actOnSelection,
} = require('../controllers/analysisController');
const { protect } = require('../middleware/auth');
const { analysisLimiter } = require('../middleware/rateLimit');

router.use(protect);

// POST /api/analysis/run
router.post('/run', analysisLimiter, runAnalysis);

// POST /api/analysis/batch
router.post('/batch', analysisLimiter, batchAnalyse);

// POST /api/analysis/batch/insights
router.post('/batch/insights', analysisLimiter, batchInsights);

// GET /api/analysis/activity
router.get('/activity', getActivity);
router.get('/activity/stream', activityStream);
router.get('/activity/stats', activityStats);

// GET  /api/analysis
router.get('/', listAnalyses);

// POST /api/analysis/:id/selection
router.post('/:id/selection', actOnSelection);

// GET /api/analysis/:id/ai-guide
router.get('/:id/ai-guide', getAIGuide);

// GET  /api/analysis/:id
router.get('/:id', getAnalysis);

// POST /api/analysis/:id/qa
router.post('/:id/qa', askQuestion);

module.exports = router;
