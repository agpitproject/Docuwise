const express = require('express');
const router = express.Router();

const {
  addComment,
  getComments,
  editComment,
  resolveComment,
  deleteComment,
  addReaction,
} = require('../controllers/commentController');
const { protect } = require('../middleware/auth');
const { commentLimiter } = require('../middleware/rateLimit');

router.use(protect);

router.post('/', commentLimiter, addComment);
router.get('/', getComments);
router.patch('/:id', editComment);
router.patch('/:id/resolve', resolveComment);
router.delete('/:id', deleteComment);
router.post('/:id/reaction', commentLimiter, addReaction);

module.exports = router;
