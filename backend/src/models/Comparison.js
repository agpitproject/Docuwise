const mongoose = require('mongoose');

const comparisonSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    documentA: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    documentB: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    mode: {
      type: String,
      enum: ['full', 'summary', 'sentiment', 'structure'],
      default: 'full',
    },
    results: {
      executiveSummary: { type: String, default: '' },
      summaryDiff: { type: String, default: '' },
      riskSummary: { type: String, default: '' },
      riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
      documentTypes: {
        documentA: {
          value: { type: String, default: 'general' },
          label: { type: String, default: 'General' },
        },
        documentB: {
          value: { type: String, default: 'general' },
          label: { type: String, default: 'General' },
        },
        match: { type: Boolean, default: true },
        warning: { type: String, default: '' },
      },
      keyChanges: [{
        category: { type: String, default: '' },
        label: { type: String, default: '' },
        status: { type: String, enum: ['added', 'removed', 'modified'], default: 'modified' },
        severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
        summary: { type: String, default: '' },
        left: { type: String, default: '' },
        right: { type: String, default: '' },
      }],
      criticalAlerts: [{
        category: { type: String, default: '' },
        severity: { type: String, enum: ['low', 'medium', 'high'], default: 'high' },
        summary: { type: String, default: '' },
      }],
      sideBySideDiff: [{
        category: { type: String, default: '' },
        label: { type: String, default: '' },
        status: { type: String, enum: ['added', 'removed', 'modified'], default: 'modified' },
        left: { type: String, default: '' },
        right: { type: String, default: '' },
        summary: { type: String, default: '' },
      }],
      sentimentComparison: {
        docA: {
          overall: { type: String, enum: ['positive', 'negative', 'neutral'], default: null },
          positive: { type: Number, default: 0 },
          negative: { type: Number, default: 0 },
          neutral: { type: Number, default: 0 },
        },
        docB: {
          overall: { type: String, enum: ['positive', 'negative', 'neutral'], default: null },
          positive: { type: Number, default: 0 },
          negative: { type: Number, default: 0 },
          neutral: { type: Number, default: 0 },
        },
      },
      categoriesA: [{ type: String }],
      categoriesB: [{ type: String }],
      readabilityA: { type: Number, default: null },
      readabilityB: { type: Number, default: null },
      similarityScore: { type: Number, min: 0, max: 100, default: 0 },
      lengthDiff: {
        wordsA: { type: Number, default: 0 },
        wordsB: { type: Number, default: 0 },
        difference: { type: Number, default: 0 },
        percentDiff: { type: Number, default: 0 },
      },
    },
    processingTimeMs: { type: Number, default: null },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Comparison', comparisonSchema);
