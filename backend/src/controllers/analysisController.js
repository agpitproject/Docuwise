const Document = require('../models/Document');
const Analysis = require('../models/Analysis');
const User = require('../models/User');
const orchestrator = require('../services/analysisOrchestrator');
const fs = require('fs');
const {
  summariseDocument,
  analyseSentiment,
  categoriseDocument,
  extractKeywords,
  translateText,
  generateBatchInsights,
  generateAIGuide,
  readabilityScore,
  detectDocumentLanguage,
} = require('../services/openaiService');
const { extractEntities } = require('../services/huggingfaceService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const activityConnections = new Map();

const ACTIVITY_ALLOWED_STATUSES = new Set(['pending', 'processing', 'completed', 'failed']);
const ACTIVITY_ALLOWED_MODES = new Set(['all', 'summarization', 'sentiment', 'categorization']);

function parseCsvQuery(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildActivityFilter(query, userId) {
  const filter = { user: userId };
  const statuses = parseCsvQuery(query.status).filter((value) => ACTIVITY_ALLOWED_STATUSES.has(value));
  const modes = parseCsvQuery(query.mode).filter((value) => ACTIVITY_ALLOWED_MODES.has(value));

  if (statuses.length > 0) filter.status = { $in: statuses };
  if (modes.length > 0) filter.mode = { $in: modes };

  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
  const dateTo = query.dateTo ? new Date(query.dateTo) : null;
  if ((dateFrom && !Number.isNaN(dateFrom.getTime())) || (dateTo && !Number.isNaN(dateTo.getTime()))) {
    filter.createdAt = {};
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) filter.createdAt.$gte = dateFrom;
    if (dateTo && !Number.isNaN(dateTo.getTime())) filter.createdAt.$lte = dateTo;
  }

  return filter;
}

function toActivityItem(analysis) {
  return {
    id: analysis._id,
    analysisId: analysis._id,
    documentId: analysis.document?._id || null,
    documentName: analysis.document?.originalName || 'Document',
    mode: analysis.mode,
    status: analysis.status,
    language: analysis.language,
    message:
      analysis.status === 'processing'
        ? 'Analysis is running'
        : analysis.status === 'completed'
          ? 'Analysis finished'
          : analysis.status === 'failed'
            ? analysis.errorMessage || 'Analysis failed'
            : 'Analysis queued',
    processingTimeMs: analysis.processingTimeMs ?? null,
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
  };
}

function stableStateKey(item) {
  return `${item.id}:${item.status}:${item.updatedAt}:${item.message}:${item.processingTimeMs ?? ''}`;
}

function writeActivityEvent(res, type, item) {
  res.write(`data: ${JSON.stringify({ type, item })}\n\n`);
}

// POST /api/analysis/run
const runAnalysis = asyncHandler(async (req, res) => {
  const { documentId, mode = 'all', language = 'en' } = req.body;

  if (!documentId) return sendError(res, 400, 'documentId is required');

  await User.findById(req.user._id);

  const doc = await Document.findOne({ _id: documentId, user: req.user._id });
  if (!doc) return sendError(res, 404, 'Document not found');
  if (!doc.extractedText) {
    return sendError(
      res,
      400,
      'Document has no extractable text. Handwritten or scanned documents are not supported yet unless they already contain OCR/selectable text.'
    );
  }

  // Create pending analysis record
  const analysis = await Analysis.create({
    user: req.user._id,
    document: documentId,
    mode,
    language,
    status: 'processing',
  });

  // Update doc status
  await Document.findByIdAndUpdate(documentId, { status: 'processing' });

  // Run AI orchestration (async — responds immediately with analysisId)
  orchestrator.run(analysis._id, doc.extractedText, mode, language, {
    documentName: doc.originalName,
    fileType: doc.fileType,
    wordCount: doc.wordCount,
  }).then(async () => {
    const freshUser = await User.findByIdAndUpdate(req.user._id, { $inc: { monthlyUsage: 1 } }, { new: true });
    await Document.findByIdAndUpdate(documentId, { status: 'done' });

    if (freshUser?.privacy?.autoDeleteFiles && doc.filePath) {
      try {
        if (fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath);
      } catch (error) {
        console.warn('Auto-delete failed:', error.message);
      }
    }
  }).catch(async (err) => {
    await Analysis.findByIdAndUpdate(analysis._id, { status: 'failed', errorMessage: err.message });
    await Document.findByIdAndUpdate(documentId, { status: 'error' });
  });

  sendSuccess(res, 202, 'Analysis started', { analysisId: analysis._id, status: 'processing' });
});

// GET /api/analysis/:id
const getAnalysis = asyncHandler(async (req, res) => {
  let analysis = await Analysis.findOne({ _id: req.params.id, user: req.user._id })
    .populate('document', 'originalName fileType wordCount fileSize extractedText createdAt');

  if (!analysis) return sendError(res, 404, 'Analysis not found');
  analysis = await ensureAnalysisData(analysis);
  sendSuccess(res, 200, 'Analysis retrieved', { analysis });
});

// GET /api/analysis — list user's analyses
const listAnalyses = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const filter = { user: req.user._id };

  if (status) {
    const statuses = String(status)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (statuses.length > 0) {
      filter.status = { $in: statuses };
    }
  }

  const analyses = await Analysis.find(filter)
    .populate('document', 'originalName fileType')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Analysis.countDocuments(filter);
  sendSuccess(res, 200, 'Analyses listed', { analyses, total });
});

// POST /api/analysis/:id/qa — Document Q&A
const askQuestion = asyncHandler(async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) return sendError(res, 400, 'Question is required');

  const analysis = await Analysis.findOne({ _id: req.params.id, user: req.user._id })
    .populate('document', 'extractedText');

  if (!analysis) return sendError(res, 404, 'Analysis not found');

  const { answerQuestion } = require('../services/openaiService');
  const qaResult = await answerQuestion(analysis.document.extractedText, question);
  const answer = typeof qaResult === 'string' ? qaResult : qaResult.answer;

  // Save to Q&A history
  analysis.qaHistory.push({ question, answer });
  await analysis.save();

  sendSuccess(res, 200, 'Answer generated', {
    question,
    answer,
    sources: Array.isArray(qaResult?.sources) ? qaResult.sources : [],
    followUpQuestions: Array.isArray(qaResult?.followUpQuestions) ? qaResult.followUpQuestions : [],
    confidence: ['high', 'medium', 'low'].includes(qaResult?.confidence) ? qaResult.confidence : 'low',
    provider: ['gemini', 'openai', 'fallback'].includes(qaResult?.provider) ? qaResult.provider : 'fallback',
  });
});

// GET /api/analysis/:id/ai-guide
const getAIGuide = asyncHandler(async (req, res) => {
  const analysis = await Analysis.findOne({ _id: req.params.id, user: req.user._id })
    .populate('document', 'extractedText');

  if (!analysis) return sendError(res, 404, 'Analysis not found');

  const guide = await generateAIGuide(analysis.document?.extractedText || '', analysis.summary || '');
  sendSuccess(res, 200, 'AI guide generated', guide);
});

// POST /api/analysis/batch — batch multiple docs
const batchAnalyse = asyncHandler(async (req, res) => {
  const { documentIds, mode = 'all', language = 'en' } = req.body;
  if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
    return sendError(res, 400, 'documentIds array is required');
  }

  const user = await User.findById(req.user._id);
  if (user.plan === 'free') {
    return sendError(res, 403, 'Batch processing is available on Pro and Enterprise plans');
  }

  const jobs = await Promise.all(
    documentIds.map(async (docId) => {
      const doc = await Document.findOne({ _id: docId, user: req.user._id });
      if (!doc) return { docId, error: 'Not found' };

      const analysis = await Analysis.create({
        user: req.user._id,
        document: docId,
        mode,
        language,
        status: 'processing',
      });

      orchestrator.run(analysis._id, doc.extractedText, mode, language, {
        documentName: doc.originalName,
        fileType: doc.fileType,
        wordCount: doc.wordCount,
      }).catch(console.error);
      return { docId, analysisId: analysis._id };
    })
  );

  sendSuccess(res, 202, 'Batch analysis started', { jobs });
});

// POST /api/analysis/batch/insights
const batchInsights = asyncHandler(async (req, res) => {
  const { files, analysisType = 'summarization' } = req.body;

  if (!Array.isArray(files) || files.length === 0) {
    return sendError(res, 400, 'files array is required');
  }

  const normalizedFiles = files.map((file, index) => ({
    name: String(file?.name || file?.originalName || `File ${index + 1}`),
    summary: String(file?.summary || ''),
    translation: String(file?.translation || ''),
    sentiment: file?.sentiment || null,
    keywords: Array.isArray(file?.keywords) ? file.keywords : [],
    entities: Array.isArray(file?.entities) ? file.entities : [],
    documentType: String(file?.documentType || ''),
    riskLevel: String(file?.riskLevel || ''),
    fileType: String(file?.fileType || ''),
    language: String(file?.language || ''),
    wordCount: Number(file?.wordCount || 0) || 0,
    readability: file?.readability || null,
  }));

  const insights = await generateBatchInsights(normalizedFiles, analysisType);

  sendSuccess(res, 200, 'Batch insights generated', {
    insights,
    totals: {
      total: normalizedFiles.length,
      analysisType,
    },
  });
});

// GET /api/analysis/activity
const getActivity = asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const filter = buildActivityFilter(req.query, req.user._id);
  const offset = (page - 1) * limit;

  const [result] = await Analysis.aggregate([
    { $match: filter },
    {
      $addFields: {
        statusPriority: {
          $cond: [{ $in: ['$status', ['processing', 'pending']] }, 0, 1],
        },
      },
    },
    { $sort: { statusPriority: 1, updatedAt: -1 } },
    {
      $facet: {
        items: [
          { $skip: offset },
          { $limit: limit },
          {
            $lookup: {
              from: 'documents',
              localField: 'document',
              foreignField: '_id',
              as: 'documentInfo',
            },
          },
          { $unwind: { path: '$documentInfo', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              documentId: '$documentInfo._id',
              documentName: '$documentInfo.originalName',
              mode: 1,
              status: 1,
              language: 1,
              errorMessage: 1,
              processingTimeMs: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const total = result?.total?.[0]?.count || 0;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const items = (result?.items || []).map((analysis) =>
    toActivityItem({
      ...analysis,
      document: {
        _id: analysis.documentId || null,
        originalName: analysis.documentName || 'Document',
      },
    })
  );
  const hasMore = page < totalPages;

  sendSuccess(res, 200, 'Activity retrieved', { items, total, page, totalPages, hasMore });
});

// GET /api/analysis/activity/stream
const activityStream = asyncHandler(async (req, res) => {
  const userId = String(req.user._id);
  const existingConnection = activityConnections.get(userId);

  if (existingConnection?.res) {
    existingConnection.res.end();
    if (existingConnection.interval) clearInterval(existingConnection.interval);
    activityConnections.delete(userId);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const initialProcessing = await Analysis.find({
    user: req.user._id,
    status: { $in: ['processing', 'pending'] },
  })
    .populate('document', 'originalName')
    .sort({ updatedAt: -1 });

  const initialItems = initialProcessing.map((analysis) => toActivityItem(analysis));
  writeActivityEvent(res, 'activity_snapshot', initialItems);

  const baselineItems = await Analysis.find({ user: req.user._id })
    .populate('document', 'originalName')
    .sort({ updatedAt: -1 })
    .limit(200);

  const knownStates = new Map(
    baselineItems.map((analysis) => {
      const item = toActivityItem(analysis);
      return [String(item.id), stableStateKey(item)];
    })
  );
  const interval = setInterval(async () => {
    try {
      const latest = await Analysis.find({ user: req.user._id })
        .populate('document', 'originalName')
        .sort({ updatedAt: -1 })
        .limit(200);

      for (const analysis of latest) {
        const item = toActivityItem(analysis);
        const key = stableStateKey(item);
        const id = String(item.id);
        if (knownStates.get(id) !== key) {
          knownStates.set(id, key);
          writeActivityEvent(res, 'activity_update', item);
        }
      }
    } catch (error) {
      writeActivityEvent(res, 'activity_update', {
        status: 'failed',
        message: 'Unable to refresh activity stream',
      });
    }
  }, 5000);

  activityConnections.set(userId, { res, interval });

  req.on('close', () => {
    const active = activityConnections.get(userId);
    if (active?.interval) clearInterval(active.interval);
    if (active?.res === res) activityConnections.delete(userId);
    res.end();
  });
});

// GET /api/analysis/activity/stats
const activityStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const startOfTodayUtc = new Date();
  startOfTodayUtc.setUTCHours(0, 0, 0, 0);

  const [totalAnalyses, todayStatusCounts, avgAggregate, modeCounts, statusCounts] = await Promise.all([
    Analysis.countDocuments({ user: userId }),
    Analysis.aggregate([
      { $match: { user: userId, createdAt: { $gte: startOfTodayUtc }, status: { $in: ['completed', 'failed'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Analysis.aggregate([
      { $match: { user: userId, processingTimeMs: { $ne: null } } },
      { $group: { _id: null, avgProcessingMs: { $avg: '$processingTimeMs' } } },
    ]),
    Analysis.aggregate([{ $match: { user: userId } }, { $group: { _id: '$mode', count: { $sum: 1 } } }]),
    Analysis.aggregate([{ $match: { user: userId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const completedToday = todayStatusCounts.find((entry) => entry._id === 'completed')?.count || 0;
  const failedToday = todayStatusCounts.find((entry) => entry._id === 'failed')?.count || 0;

  const byMode = { all: 0, summarization: 0, sentiment: 0, categorization: 0 };
  for (const entry of modeCounts) {
    if (Object.prototype.hasOwnProperty.call(byMode, entry._id)) byMode[entry._id] = entry.count;
  }

  const byStatus = { completed: 0, failed: 0, processing: 0, pending: 0 };
  for (const entry of statusCounts) {
    if (Object.prototype.hasOwnProperty.call(byStatus, entry._id)) byStatus[entry._id] = entry.count;
  }

  const avgProcessingMs = avgAggregate[0]?.avgProcessingMs ? Math.round(avgAggregate[0].avgProcessingMs) : 0;

  sendSuccess(res, 200, 'Activity stats retrieved', {
    totalAnalyses,
    completedToday,
    failedToday,
    avgProcessingMs,
    byMode,
    byStatus,
  });
});

// POST /api/analysis/:id/selection
const actOnSelection = asyncHandler(async (req, res) => {
  const { text, action = 'translate', language = 'en' } = req.body;
  const trimmed = String(text || '').trim();

  if (!trimmed) return sendError(res, 400, 'Selected text is required');

  const analysis = await Analysis.findOne({ _id: req.params.id, user: req.user._id });
  if (!analysis) return sendError(res, 404, 'Analysis not found');

  if (action === 'search') {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    return sendSuccess(res, 200, 'Search link created', { searchUrl });
  }

  const translation = await translateText(trimmed, language || analysis.language || 'en');
  sendSuccess(res, 200, 'Selection translated', { translation });
});

module.exports = {
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
};

async function ensureAnalysisData(analysis) {
  const text = analysis.document?.extractedText;
  if (analysis.status !== 'completed' || !text) return analysis;

  const updates = {};
  const sourceLanguage = analysis.sourceLanguage || detectDocumentLanguage(text);
  const outputLanguage = analysis.language || (sourceLanguage === 'unknown' ? 'en' : sourceLanguage);

  if (!analysis.sourceLanguage) updates.sourceLanguage = sourceLanguage;

  if ((!analysis.summary || summaryLooksPoor(analysis.summary, text)) && (analysis.mode === 'summarization' || analysis.mode === 'all')) {
    updates.summary = await summariseDocument(text, outputLanguage, sourceLanguage);
  }

  if (
    (!analysis.sentiment?.overall || totalsZero(analysis.sentiment) || missingSentimentHighlights(analysis.sentiment)) &&
    (analysis.mode === 'sentiment' || analysis.mode === 'all')
  ) {
    updates.sentiment = await analyseSentiment(text, sourceLanguage);
  }

  if ((!analysis.categories || analysis.categories.length === 0) && (analysis.mode === 'categorization' || analysis.mode === 'all')) {
    updates.categories = await categoriseDocument(text, outputLanguage, sourceLanguage);
  }

  if ((!analysis.keywords || analysis.keywords.length === 0) && analysis.mode === 'all') {
    updates.keywords = await extractKeywords(text, outputLanguage, sourceLanguage);
  }

  if ((!analysis.entities || analysis.entities.length === 0) && analysis.mode === 'all') {
    updates.entities = await extractEntities(text);
  }

  if ((!analysis.readability?.wordCount || analysis.readability?.fleschKincaid === null) && analysis.mode === 'all') {
    updates.readability = {
      fleschKincaid: readabilityScore(text),
      wordCount: text.trim().split(/\s+/).filter(Boolean).length,
    };
  }

  if (!analysis.translation && outputLanguage && outputLanguage !== sourceLanguage) {
    updates.translation = await translateText(text.slice(0, 2500), outputLanguage);
  }

  if (Object.keys(updates).length === 0) return analysis;

  analysis = await Analysis.findByIdAndUpdate(analysis._id, updates, { new: true }).populate(
    'document',
    'originalName fileType wordCount fileSize extractedText createdAt'
  );
  return analysis;
}

function totalsZero(sentiment) {
  if (!sentiment) return true;
  return Number(sentiment.positive || 0) + Number(sentiment.negative || 0) + Number(sentiment.neutral || 0) === 0;
}

function missingSentimentHighlights(sentiment) {
  const highlights = sentiment?.highlights;
  if (!highlights) return true;
  return ['positive', 'negative', 'neutral'].every((key) => !Array.isArray(highlights[key]) || highlights[key].length === 0);
}

function summaryLooksPoor(summary, text) {
  const normalizedSummary = String(summary || '').replace(/\s+/g, ' ').trim();
  const normalizedText = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalizedSummary || !normalizedText) return false;

  const copiedTooMuch = normalizedSummary.length > 900 && normalizedSummary.length > normalizedText.length * 0.45;
  const nearExactCopy = normalizedText.length > 0 && normalizedText.includes(normalizedSummary) && normalizedSummary.length > 600;

  return copiedTooMuch || nearExactCopy;
}
