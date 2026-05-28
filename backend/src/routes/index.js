const express = require('express');
const router = express.Router();

const { apiLimiter } = require('../middleware/rateLimit');

router.use(apiLimiter);

router.use('/auth',      require('./auth'));
router.use('/documents', require('./documents'));
router.use('/analysis',  require('./analysis'));
router.use('/comparisons', require('./comparison'));
router.use('/comments', require('./comments'));
router.use('/collab', require('./collab'));

module.exports = router;
