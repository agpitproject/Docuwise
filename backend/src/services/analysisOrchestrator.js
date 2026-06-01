const Analysis = require('../models/Analysis');
const {
  summariseDocument,
  analyseSentiment,
  categoriseDocument,
  extractKeywords,
  translateText,
  readabilityScore,
  detectDocumentLanguage,
} = require('./openaiService');
const { extractEntities } = require('./huggingfaceService');

/**
 * Run all AI analysis steps and save results to the Analysis document.
 * Called asynchronously after responding 202 to the client.
 */
const run = async (analysisId, text, mode, language, context = {}) => {
  const startTime = Date.now();

  try {
    const sourceLanguage = detectDocumentLanguage(text);
    const outputLanguage =
      language && language !== 'auto' && (language !== 'en' || sourceLanguage === 'en')
        ? language
        : sourceLanguage === 'unknown'
          ? 'en'
          : sourceLanguage;
    const updates = { status: 'completed', language: outputLanguage, sourceLanguage };

    // Run tasks in parallel where possible
    const tasks = [];

    if (mode === 'summarization' || mode === 'all') {
      tasks.push(
        summariseDocument(text, outputLanguage, sourceLanguage, context).then(summary => { updates.summary = summary; })
      );
    }

    if (mode === 'sentiment' || mode === 'all') {
      tasks.push(
        analyseSentiment(text, sourceLanguage).then(sentiment => { updates.sentiment = sentiment; })
      );
    }

    if (mode === 'categorization' || mode === 'all') {
      tasks.push(
        categoriseDocument(text, outputLanguage, sourceLanguage).then(categories => { updates.categories = categories; })
      );
    }

    if (mode === 'all') {
      tasks.push(
        extractKeywords(text, outputLanguage, sourceLanguage).then(keywords => { updates.keywords = keywords; }),
        extractEntities(text).then(entities => { updates.entities = entities; })
      );

      // Readability is synchronous, no async needed
      const fk = readabilityScore(text);
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      updates.readability = { fleschKincaid: fk, wordCount };
    }

    if (outputLanguage && outputLanguage !== sourceLanguage) {
      tasks.push(
        translateText(text.slice(0, 2500), outputLanguage).then(translation => { updates.translation = translation; })
      );
    }

    await Promise.allSettled(tasks);

    updates.processingTimeMs = Date.now() - startTime;

    await Analysis.findByIdAndUpdate(analysisId, updates);
    console.log(`✅ Analysis ${analysisId} completed in ${updates.processingTimeMs}ms`);
  } catch (err) {
    console.error(`❌ Analysis ${analysisId} failed:`, err.message);
    await Analysis.findByIdAndUpdate(analysisId, {
      status: 'failed',
      errorMessage: err.message,
    });
    throw err;
  }
};

module.exports = { run };
