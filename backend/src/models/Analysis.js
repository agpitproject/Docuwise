const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    mode: {
      type: String,
      enum: ['categorization', 'summarization', 'sentiment', 'all'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    language: { type: String, default: 'en' },
    sourceLanguage: { type: String, default: 'unknown' },

    // Results
    summary:    { type: String, default: null },
    translation: { type: String, default: null },
    categories: [{ type: String }],
    keywords:   [{ type: String }],
    sentiment: {
      overall:  { type: String, enum: ['positive', 'negative', 'neutral'], default: null },
      positive: { type: Number, default: 0 },
      negative: { type: Number, default: 0 },
      neutral:  { type: Number, default: 0 },
      highlights: {
        positive: [{ type: String }],
        negative: [{ type: String }],
        neutral:  [{ type: String }],
      },
    },
    entities: [
      {
        type:  { type: String }, // PERSON, ORG, DATE, LOC, METRIC
        value: { type: String },
      },
    ],
    readability: {
      fleschKincaid: { type: Number, default: null },
      wordCount:     { type: Number, default: null },
    },

    // Q&A conversation history
    qaHistory: [
      {
        question:  String,
        answer:    String,
        timestamp: { type: Date, default: Date.now },
      },
    ],

    processingTimeMs: { type: Number, default: null },
    errorMessage:     { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Analysis', analysisSchema);
