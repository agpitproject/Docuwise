const Comparison = require('../models/Comparison');
const Document = require('../models/Document');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { compareDocuments, analyseSentiment, readabilityScore } = require('../services/openaiService');

// POST /api/comparisons
const createComparison = asyncHandler(async (req, res) => {
  const { documentAId, documentBId, mode = 'full' } = req.body;

  if (!documentAId || !documentBId) {
    return sendError(res, 400, 'documentAId and documentBId are required');
  }

  if (String(documentAId) === String(documentBId)) {
    return sendError(res, 400, 'Please select two different documents');
  }

  const [docA, docB] = await Promise.all([
    Document.findOne({ _id: documentAId, user: req.user._id }),
    Document.findOne({ _id: documentBId, user: req.user._id }),
  ]);

  if (!docA || !docB) {
    return sendError(res, 404, 'One or both documents were not found');
  }

  if (!String(docA.extractedText || '').trim() || !String(docB.extractedText || '').trim()) {
    return sendError(res, 400, 'Both documents must have extracted text before comparison');
  }

  const comparison = await Comparison.create({
    user: req.user._id,
    documentA: docA._id,
    documentB: docB._id,
    mode,
    status: 'processing',
  });

  sendSuccess(res, 202, 'Comparison started', {
    comparisonId: comparison._id,
    status: 'processing',
  });

  const comparisonId = comparison._id;
  const runComparison = async () => {
    const start = Date.now();
    const updates = { status: 'completed', results: {} };
    const textA = docA.extractedText;
    const textB = docB.extractedText;

    await Promise.allSettled([
      compareDocuments(textA, textB, docA.originalName, docB.originalName)
        .then((result) => { updates.results = { ...updates.results, ...result }; }),
      analyseSentiment(textA).then((sentiment) => {
        updates.results = {
          ...updates.results,
          sentimentComparison: { ...updates.results?.sentimentComparison, docA: sentiment },
        };
      }),
      analyseSentiment(textB).then((sentiment) => {
        updates.results = {
          ...updates.results,
          sentimentComparison: { ...updates.results?.sentimentComparison, docB: sentiment },
        };
      }),
    ]);

    const wordsA = textA.trim().split(/\s+/).filter(Boolean).length;
    const wordsB = textB.trim().split(/\s+/).filter(Boolean).length;
    updates.results.lengthDiff = {
      wordsA,
      wordsB,
      difference: Math.abs(wordsA - wordsB),
      percentDiff: Math.round((Math.abs(wordsA - wordsB) / Math.max(wordsA, wordsB, 1)) * 100),
    };
    updates.results.readabilityA = readabilityScore(textA);
    updates.results.readabilityB = readabilityScore(textB);

    delete updates.results._kwA;
    delete updates.results._kwB;
    updates.processingTimeMs = Date.now() - start;

    await Comparison.findByIdAndUpdate(comparisonId, updates);
  };

  runComparison().catch(async (error) => {
    await Comparison.findByIdAndUpdate(comparisonId, {
      status: 'failed',
      errorMessage: error.message,
    });
  });
});

// GET /api/comparisons/:id
const getComparison = asyncHandler(async (req, res) => {
  const comparison = await Comparison.findOne({ _id: req.params.id, user: req.user._id })
    .populate('documentA', 'originalName fileType wordCount')
    .populate('documentB', 'originalName fileType wordCount');

  if (!comparison) return sendError(res, 404, 'Comparison not found');
  return sendSuccess(res, 200, 'Comparison retrieved', { comparison });
});

// GET /api/comparisons
const listComparisons = asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);

  const filter = { user: req.user._id };
  const [comparisons, total] = await Promise.all([
    Comparison.find(filter)
      .populate('documentA', 'originalName')
      .populate('documentB', 'originalName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Comparison.countDocuments(filter),
  ]);

  return sendSuccess(res, 200, 'Comparisons listed', { comparisons, total, page, totalPages: Math.ceil(total / limit) || 1 });
});

// DELETE /api/comparisons/:id
const deleteComparison = asyncHandler(async (req, res) => {
  const comparison = await Comparison.findOne({ _id: req.params.id, user: req.user._id });
  if (!comparison) return sendError(res, 404, 'Comparison not found');

  await Comparison.deleteOne({ _id: comparison._id });
  return sendSuccess(res, 200, 'Comparison deleted');
});

module.exports = { createComparison, getComparison, listComparisons, deleteComparison };
