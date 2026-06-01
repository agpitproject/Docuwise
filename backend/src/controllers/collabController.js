const OpenAI = require('openai');
const Document = require('../models/Document');
const Comment = require('../models/Comment');
const CollabEvent = require('../models/CollabEvent');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const SUMMARY_CACHE_TTL_MS = 10 * 60 * 1000;
const summaryCache = new Map();

const hasOpenAIKey =
  !!process.env.OPENAI_API_KEY &&
  process.env.OPENAI_API_KEY !== 'sk-...' &&
  process.env.OPENAI_API_KEY.startsWith('sk-');
const openai = hasOpenAIKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const FALLBACK_INSIGHTS = [
  'Review the document summary with all collaborators',
  'Assign sections by role',
  'Schedule a review session',
];

async function getAccessibleDocument(documentId, user) {
  const document = await Document.findById(documentId);
  if (!document) return { error: { status: 404, message: 'Document not found' } };

  const isOwner = String(document.user) === String(user._id);
  const collaborator = document.collaborators.find(
    (entry) => String(entry.email).toLowerCase() === String(user.email).toLowerCase()
  );

  if (!isOwner && !collaborator) {
    return { error: { status: 403, message: 'You do not have access to this document' } };
  }

  return { document };
}

async function getAiInsights(document, collaboratorCount) {
  if (!openai || !String(document.extractedText || '').trim()) return FALLBACK_INSIGHTS;

  try {
    const roles = (document.collaborators || []).map((entry) => entry.role || 'editor');
    const prompt = `Given this document and ${collaboratorCount} collaborators with roles ${roles.join(', ') || 'none'}, suggest 3 collaboration actions or review focuses. Return JSON array of strings.`;
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a collaboration assistant. Return only valid JSON.' },
        { role: 'user', content: `${prompt}\n\nDOCUMENT:\n${String(document.extractedText).slice(0, 8000)}` },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const raw = String(response.choices?.[0]?.message?.content || '').trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 3);
    }
    return FALLBACK_INSIGHTS;
  } catch (_) {
    return FALLBACK_INSIGHTS;
  }
}

function setSummaryCache(documentId, data) {
  if (summaryCache.size >= 100) {
    const oldestKey = summaryCache.keys().next().value;
    if (oldestKey) summaryCache.delete(oldestKey);
  }
  summaryCache.set(String(documentId), { data, fetchedAt: Date.now() });
}

// GET /api/collab/:documentId/events
const getCollabEvents = asyncHandler(async (req, res) => {
  const access = await getAccessibleDocument(req.params.documentId, req.user);
  if (access.error) return sendError(res, access.error.status, access.error.message);

  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100);

  const filter = { document: req.params.documentId };
  const [events, total] = await Promise.all([
    CollabEvent.find(filter)
      .populate('actor', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    CollabEvent.countDocuments(filter),
  ]);

  return sendSuccess(res, 200, 'Collaboration events retrieved', {
    events,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  });
});

// GET /api/collab/:documentId/summary
const getCollabSummary = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const access = await getAccessibleDocument(documentId, req.user);
  if (access.error) return sendError(res, access.error.status, access.error.message);
  const document = access.document;

  const cached = summaryCache.get(String(documentId));
  if (cached && Date.now() - cached.fetchedAt < SUMMARY_CACHE_TTL_MS) {
    return sendSuccess(res, 200, 'Collaboration summary retrieved', cached.data);
  }

  const [totalComments, unresolvedComments, totalEvents, recentActivity] = await Promise.all([
    Comment.countDocuments({ document: documentId }),
    Comment.countDocuments({ document: documentId, resolved: false }),
    CollabEvent.countDocuments({ document: documentId }),
    CollabEvent.find({ document: documentId }).populate('actor', 'firstName lastName').sort({ createdAt: -1 }).limit(5),
  ]);

  const collaboratorCount = Array.isArray(document.collaborators) ? document.collaborators.length : 0;
  let aiInsights = FALLBACK_INSIGHTS;
  try {
    aiInsights = await getAiInsights(document, collaboratorCount);
  } catch (_) {
    aiInsights = FALLBACK_INSIGHTS;
  }

  const data = {
    totalComments,
    unresolvedComments,
    collaboratorCount,
    totalEvents,
    recentActivity,
    aiInsights,
  };

  setSummaryCache(documentId, data);
  return sendSuccess(res, 200, 'Collaboration summary retrieved', data);
});

// GET /api/collab/:documentId/stream
const getCollabStream = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const access = await getAccessibleDocument(documentId, req.user);
  if (access.error) return sendError(res, access.error.status, access.error.message);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const latestEvent = await CollabEvent.findOne({ document: documentId }).sort({ createdAt: -1 });
  let lastEventAt = latestEvent ? new Date(latestEvent.createdAt) : new Date(0);
  let lastCommentCount = await Comment.countDocuments({ document: documentId });

  const interval = setInterval(async () => {
    try {
      const newEvents = await CollabEvent.find({ document: documentId, createdAt: { $gt: lastEventAt } })
        .populate('actor', 'firstName lastName')
        .sort({ createdAt: 1 });

      if (newEvents.length > 0) {
        lastEventAt = new Date(newEvents[newEvents.length - 1].createdAt);
        newEvents.forEach((event) => {
          res.write(`data: ${JSON.stringify({ type: 'collab_event', item: event })}\n\n`);
        });
      }

      const commentCount = await Comment.countDocuments({ document: documentId });
      if (commentCount !== lastCommentCount) {
        lastCommentCount = commentCount;
        res.write(`data: ${JSON.stringify({ type: 'comment_update', count: commentCount })}\n\n`);
      }
    } catch (_) {
      // ignore poll errors to keep stream alive
    }
  }, 4000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

module.exports = { getCollabEvents, getCollabSummary, getCollabStream };
