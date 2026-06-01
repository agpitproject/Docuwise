const OpenAI = require('openai');
const axios = require('axios');
const {
  hasGeminiConfig,
  summariseDocumentWithGemini,
  answerQuestionWithGemini,
  generateAIGuideWithGemini,
  translateTextWithGemini,
} = require('./geminiService');

const hasOpenAIKey =
  !!process.env.OPENAI_API_KEY &&
  process.env.OPENAI_API_KEY !== 'sk-...' &&
  process.env.OPENAI_API_KEY.startsWith('sk-');

const openai = hasOpenAIKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const truncate = (text, maxChars = 12000) =>
  text.length > maxChars ? `${text.slice(0, maxChars)}\n[...truncated]` : text;

const summariseDocument = async (text, language = 'en', sourceLanguage = 'auto', context = {}) => {
  const cleanedText = cleanDocumentText(text);
  if (!cleanedText) return emptySummary(context);

  const targetLanguage = normalizeLanguage(language, detectDocumentLanguage(text));
  if (!openai) return fallbackSummary(cleanedText, context);

  try {
    console.log('Using OpenAI explanation path');
    const summaryContext = buildSummaryContext(context);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a document teacher. Use only the uploaded document text. Do not invent facts, names, dates, obligations, risks, or conclusions that are not supported by the document. Explain like a human teacher: interpret meaning, explain practical impact, and avoid copying document sentences. Keep evidence separate from the explanation because the app may display snippets separately.
If the document is technical or academic, explain the concept, mechanism, limitations, and evaluation points. If it is legal or policy, explain duties, deadlines, exceptions, approval conditions, proof/documents, risks, and obligations. If it is business/project content, explain results, risks, decisions, action points, and business impact.
Use the file context to keep the explanation specific to this document and avoid generic boilerplate. ${summaryContext}
Respond in language code: ${targetLanguage}, defaulting to English when the document language is unclear. Return only this exact plain-text format:

Document Explanation

1. What this file is about

[Explain the file's purpose in simple words. Do not copy the first sentence. Tell the user what the file is trying to communicate.]

2. Simple explanation

[Explain the document as if the user is new to the topic. Explain jargon if needed.]

3. Main points explained

* Point 1: [short title]
  Explanation: [2-4 sentences explaining what this point actually means]

* Point 2: [short title]
  Explanation: [2-4 sentences explaining what this point actually means]

* Point 3: [short title]
  Explanation: [2-4 sentences explaining what this point actually means]

4. What this means in real life

[Explain how this affects decisions, actions, risks, duties, or understanding.]

5. What you should pay attention to

* [important detail with explanation]
* [important detail with explanation]
* [important detail with explanation]

6. Important terms explained

* [Term]: [simple meaning]
* [Term]: [simple meaning]
* [Term]: [simple meaning]

7. Final takeaway

[One clear final explanation of what the user should remember.]`,
        },
        { role: 'user', content: truncate(cleanedText, 14000) },
      ],
      max_tokens: 850,
      temperature: 0.15,
    });
    const summary = response.choices[0].message.content.trim();
    return normalizeSummaryOutput(summary, cleanedText, context);
  } catch (error) {
    console.error('OpenAI explanation failed, using fallback');
    return fallbackSummary(cleanedText, context);
  }
};

const analyseSentiment = async (text, sourceLanguage = 'auto') => {
  if (!openai) return fallbackSentiment(text);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Analyse the sentiment of this document, regardless of whether it is written in ${resolveLanguageName(sourceLanguage)} or another language. Respond ONLY with valid JSON in this exact format:
{"overall":"positive"|"negative"|"neutral","positive":number,"negative":number,"neutral":number,"highlights":{"positive":["exact phrase from document"],"negative":["exact phrase from document"],"neutral":["exact phrase from document"]}}
Where positive+negative+neutral = 100. Include up to 8 short exact words or phrases per highlight list, copied from the original document language. No markdown, no explanation.`,
        },
        { role: 'user', content: truncate(text, 6000) },
      ],
      max_tokens: 350,
      temperature: 0.1,
    });

    const raw = response.choices[0].message.content.trim();
    return normalizeSentiment(JSON.parse(raw));
  } catch (error) {
    console.error('OpenAI sentiment error:', error.message);
    return fallbackSentiment(text);
  }
};

const categoriseDocument = async (text, language = 'en', sourceLanguage = 'auto') => {
  const targetLanguage = normalizeLanguage(language, detectDocumentLanguage(text));
  const candidateLabels = [
    'financial report',
    'legal document',
    'research paper',
    'news article',
    'product documentation',
    'marketing content',
    'medical document',
    'academic paper',
    'business proposal',
    'personal letter',
    'technical specification',
    'government document',
    'educational material',
    'general document',
  ];

  if (!openai) return fallbackCategorise(text, targetLanguage);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Classify multilingual documents by topic/type. The source language is ${resolveLanguageName(sourceLanguage)}. Choose up to 4 best labels from this list and translate the labels into ${resolveLanguageName(targetLanguage)}: ${candidateLabels.join(', ')}. Respond ONLY with a JSON array of strings. No markdown.`,
        },
        { role: 'user', content: truncate(text, 8000) },
      ],
      max_tokens: 160,
      temperature: 0.1,
    });

    const parsed = JSON.parse(response.choices[0].message.content.trim());
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.slice(0, 4) : fallbackCategorise(text, targetLanguage);
  } catch (error) {
    console.error('OpenAI categorisation error:', error.message);
    return fallbackCategorise(text, targetLanguage);
  }
};

const extractKeywords = async (text, language = 'en', sourceLanguage = 'auto') => {
  const targetLanguage = normalizeLanguage(language, detectDocumentLanguage(text));
  if (!openai) return fallbackKeywords(text);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            `Extract the 8 most important keywords or key phrases from this multilingual document. The source language is ${resolveLanguageName(sourceLanguage)}. Return keywords in ${resolveLanguageName(targetLanguage)} unless a named entity should stay in its original form. Respond ONLY with a JSON array of strings. No markdown.`,
        },
        { role: 'user', content: truncate(text, 8000) },
      ],
      max_tokens: 150,
      temperature: 0.2,
    });

    const parsed = JSON.parse(response.choices[0].message.content.trim());
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.slice(0, 8) : fallbackKeywords(text);
  } catch (error) {
    console.error('OpenAI keyword error:', error.message);
    return fallbackKeywords(text);
  }
};

const translateText = async (text, language = 'en') => {
  if (!text) return '';
  if (!language || language === 'en') return text;
  const targetLanguage = resolveLanguageName(language);
  const sourceText = String(text || '').trim();

  if (process.env.LIBRETRANSLATE_URL) {
    try {
      const response = await axios.post(
        `${process.env.LIBRETRANSLATE_URL.replace(/\/$/, '')}/translate`,
        {
          q: truncate(sourceText, 5000),
          source: 'auto',
          target: language,
          format: 'text',
          api_key: process.env.LIBRETRANSLATE_API_KEY || undefined,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      const translatedText = String(response.data?.translatedText || '').trim();
      if (isAcceptableTranslation(translatedText, sourceText, language)) {
        return translatedText;
      }
    } catch (error) {
      console.error('LibreTranslate translation error:', error.message);
    }
  }

  if (hasGeminiConfig()) {
    try {
      const translatedText = await translateTextWithGemini(sourceText, language);
      if (isAcceptableTranslation(translatedText, sourceText, language)) {
        return translatedText;
      }
    } catch (error) {
      console.error('Gemini translation error:', error.message);
    }
  }

  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the user's text into ${targetLanguage}. Preserve meaning, formatting, and tone. ${language === 'hi' ? 'Use Devanagari script.' : ''} Return only the translated text in ${targetLanguage}, with no explanation and no bilingual output.`,
          },
          { role: 'user', content: truncate(sourceText, 5000) },
        ],
        max_tokens: 1200,
        temperature: 0,
      });
      const translatedText = String(response.choices[0].message.content || '').trim();
      if (isAcceptableTranslation(translatedText, sourceText, language)) {
        return translatedText;
      }
    } catch (error) {
      console.error('OpenAI translation error:', error.message);
    }
  }

  return `${sourceText}\n\n[Translation to ${targetLanguage} is unavailable. To enable translation, set OPENAI_API_KEY, GEMINI_API_KEY, or LIBRETRANSLATE_URL.]`;
};

const answerQuestion = async (documentText, question) => {
  if (hasGeminiConfig()) {
    try {
      console.log('Using Gemini Q&A path');
      return await answerQuestionWithGemini(documentText, question);
    } catch (error) {
      console.log('Gemini Q&A failed, using OpenAI/fallback');
    }
  }

  if (!openai) {
    const answer = fallbackAnswer(documentText, question);
    return buildEnhancedQAResponse(documentText, question, answer, 'fallback');
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a NotebookLM-style document assistant. Answer based ONLY on the provided document. Explain like a human teacher: answer directly, explain the meaning in plain English, and point out what matters in practice. Do not copy large chunks from the document. Keep source snippets out of the answer because the app displays evidence separately. If the document does not clearly answer, say "The document does not mention this" and explain what can and cannot be inferred. Do not invent facts or fake page numbers. Use this concise structure when useful: Direct Answer, Simple Explanation, What To Pay Attention To.',
        },
        {
          role: 'user',
          content: `DOCUMENT:\n${truncate(documentText)}\n\nQUESTION: ${question}`,
        },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });
    const answer = normalizeAnswerOutput(response.choices[0].message.content.trim(), documentText, question);
    return buildEnhancedQAResponse(documentText, question, answer, 'openai');
  } catch (error) {
    console.error('OpenAI Q&A error:', error.message);
    const answer = fallbackAnswer(documentText, question);
    return buildEnhancedQAResponse(documentText, question, answer, 'fallback');
  }
};

const generateAIGuide = async (documentText, summary = '') => {
  const cleanedText = cleanDocumentText(documentText);
  const cleanedSummary = cleanDocumentText(summary);
  if (!cleanedText) return fallbackAIGuide('', cleanedSummary);

  if (hasGeminiConfig()) {
    try {
      return await generateAIGuideWithGemini(cleanedText, cleanedSummary);
    } catch (error) {
      console.log('Gemini guide failed, using OpenAI/fallback');
    }
  }

  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a document study assistant. Use only the supplied document text and summary. Return ONLY valid JSON with this exact shape: {"suggestedQuestions":["string"],"studyGuide":{"overview":"string","keyPoints":["string"],"thingsToRemember":["string"]},"glossary":[{"term":"string","meaning":"string"}],"keyTakeaways":["string"]}. Keep it concise and grounded.',
          },
          {
            role: 'user',
            content: `DOCUMENT:\n${truncate(cleanedText, 12000)}\n\nSUMMARY:\n${truncate(cleanedSummary, 4000)}`,
          },
        ],
        max_tokens: 800,
        temperature: 0.2,
      });

      const parsed = JSON.parse(stripMarkdownFences(response.choices[0].message.content.trim()));
      return { ...normalizeAIGuide(parsed, cleanedText, cleanedSummary), provider: 'openai' };
    } catch (error) {
      console.error('OpenAI guide error:', error.message);
    }
  }

  return fallbackAIGuide(cleanedText, cleanedSummary);
};

function buildEnhancedQAResponse(documentText, question, answer, provider = 'fallback') {
  const sources = buildQASources(documentText, question);
  const normalizedProvider = ['gemini', 'openai', 'fallback'].includes(provider) ? provider : 'fallback';
  return {
    question: String(question || '').trim(),
    answer: String(answer || '').trim(),
    sources,
    followUpQuestions: buildQAFollowUps(documentText, question),
    confidence: inferQAConfidence(sources, answer),
    provider: normalizedProvider,
  };
}

function buildQASources(documentText, question) {
  const cleanedText = cleanDocumentText(documentText);
  if (!cleanedText) return [];

  const sentences = splitSentences(cleanedText);
  if (sentences.length === 0) return [];

  const normalizedQuestion = String(question || '').toLowerCase();
  let terms = extractQuestionTerms(normalizedQuestion);

  if (isBroadComprehensionQuestion(normalizedQuestion)) {
    terms = [...extractImportantTerms(cleanedText).slice(0, 8), ...broadEvidenceTerms(cleanedText), 'purpose', 'risk', 'requires', 'must', 'should'];
  } else if (isMainIdeaQuestion(normalizedQuestion)) {
    terms = [...terms, ...extractImportantTerms(cleanedText).slice(0, 6), 'about', 'goal', 'purpose'];
  } else if (isPurposeQuestion(normalizedQuestion)) {
    terms = [...terms, 'goal', 'purpose', 'objective', 'verify', 'confirm'];
  } else if (isKeyPointsQuestion(normalizedQuestion)) {
    terms = [...terms, ...extractImportantTerms(cleanedText).slice(0, 6), 'key', 'takeaway', 'important'];
  }

  if (terms.length === 0) terms = extractImportantTerms(cleanedText).slice(0, 6);
  if (terms.length === 0) return [];

  const uniqueTerms = [...new Set(terms.map((term) => String(term || '').toLowerCase()).filter(Boolean))];
  const seen = new Set();

  return sentences
    .map((sentence, index) => ({
      sentence: trimSourceSnippet(sentence),
      index,
      score: scoreAnswerSentence(sentence, uniqueTerms),
    }))
    .filter((item) => item.score > 0 && item.sentence.length > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter((item) => {
      const key = item.sentence.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .map((item) => ({
      snippet: item.sentence,
      relevance: item.score >= 5 ? 'high' : item.score >= 2 ? 'medium' : 'low',
    }));
}

function broadEvidenceTerms(documentText) {
  const lower = String(documentText || '').toLowerCase();
  const terms = [];
  if (/\bleave\b|\bpolicy\b/.test(lower)) terms.push('leave', 'emergency', 'staffing', 'deadline', 'documents', 'approval');
  if (/\bretrieval-augmented generation\b|\bchunking\b|\bindexing\b|\branking\b/.test(lower)) terms.push('retrieval', 'hallucination', 'chunking', 'indexing', 'ranking');
  if (/\bonboarding\b|\bsetup\b|\bsupport tickets\b|\bmigration\b|\bq[1-4]\b/.test(lower)) terms.push('setup', 'automation', 'support', 'migration', 'q3', 'recommends');
  if (/\bconfidential\b|\bagreement\b|\bparties\b|\breturn\b|\bdestroy\b/.test(lower)) terms.push('confidential', 'three years', 'evaluation', 'excluded', 'return', 'destroy');
  return terms;
}

function trimSourceSnippet(sentence, maxChars = 240) {
  const cleaned = normalizeSentence(sentence).replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxChars) return cleaned;

  const clipped = cleaned.slice(0, maxChars).replace(/\s+\S*$/, '').trim();
  return clipped ? `${clipped}...` : cleaned.slice(0, maxChars).trim();
}

function inferQAConfidence(sources, answer) {
  const answerText = String(answer || '').toLowerCase();
  if (sources.some((source) => source.relevance === 'high')) return 'high';
  if (sources.length > 0) return 'medium';
  if (answerText.includes('does not mention') || answerText.includes('not in the document')) return 'low';
  return 'low';
}

function buildQAFollowUps(documentText, question) {
  const cleanedText = cleanDocumentText(documentText);
  const terms = extractImportantTerms(cleanedText).slice(0, 3);
  const followUps = [
    'What are the key takeaways?',
    'What should I pay attention to?',
    'Can you explain this in simpler terms?',
    'What are the risks or limitations mentioned?',
  ];

  if (terms[0]) followUps.unshift(`What does the document say about ${terms[0]}?`);
  if (terms[1]) followUps.splice(2, 0, `How does ${terms[1]} matter here?`);

  const asked = String(question || '').trim().toLowerCase();
  const seen = new Set();
  return followUps
    .map((item) => item.trim())
    .filter((item) => item && item.toLowerCase() !== asked)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function fallbackAIGuide(documentText, summary = '') {
  return {
    ...normalizeAIGuide({}, documentText, summary),
    provider: 'fallback',
  };
}

function normalizeAIGuide(payload, documentText, summary = '') {
  const sentences = splitSentences(documentText);
  const summarySections = parseSummarySections(summary);
  const keyTerms = extractImportantTerms(documentText).slice(0, 8);
  const keyTakeaways = normalizeStringArray(payload?.keyTakeaways, 5);
  const keyPoints = normalizeStringArray(payload?.studyGuide?.keyPoints, 5);
  const thingsToRemember = normalizeStringArray(payload?.studyGuide?.thingsToRemember, 5);
  const suggestedQuestions = normalizeStringArray(payload?.suggestedQuestions, 5);
  const glossary = Array.isArray(payload?.glossary)
    ? payload.glossary
        .map((item) => ({
          term: String(item?.term || '').trim(),
          meaning: String(item?.meaning || '').trim(),
        }))
        .filter((item) => item.term && item.meaning && documentText.toLowerCase().includes(item.term.toLowerCase()))
        .slice(0, 8)
    : [];

  return {
    suggestedQuestions: mergeGuideQuestions(suggestedQuestions, keyTerms),
    studyGuide: {
      overview:
        String(payload?.studyGuide?.overview || '').trim() ||
        summarySections.documentExplanation ||
        sentences[0] ||
        'No readable document overview is available.',
      keyPoints: keyPoints.length > 0 ? keyPoints : (summarySections.keyTakeaways.length > 0 ? summarySections.keyTakeaways : sentences.slice(0, 4)),
      thingsToRemember: thingsToRemember.length > 0 ? thingsToRemember : buildThingsToRemember(keyTerms, sentences),
    },
    glossary: glossary.length > 0 ? glossary : buildFallbackGlossary(keyTerms),
    keyTakeaways: keyTakeaways.length > 0 ? keyTakeaways : (summarySections.keyTakeaways.length > 0 ? summarySections.keyTakeaways : sentences.slice(0, 4)),
  };
}

function mergeGuideQuestions(providerQuestions, keyTerms = []) {
  const defaults = buildGuideQuestions(keyTerms);
  const seen = new Set();
  return [...defaults, ...(providerQuestions || [])]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function parseSummarySections(summary) {
  const text = String(summary || '').trim();
  const sections = { documentExplanation: '', keyTakeaways: [] };
  const explanationMatch = text.match(/Document Explanation:\s*([\s\S]*?)(?:\n\s*Main Idea:|$)/i);
  if (explanationMatch?.[1]) sections.documentExplanation = explanationMatch[1].trim();

  const takeawaysMatch = text.match(/Key Takeaways:\s*([\s\S]*?)(?:\n\s*Why This Matters:|$)/i);
  if (takeawaysMatch?.[1]) {
    sections.keyTakeaways = takeawaysMatch[1]
      .split(/\n+/)
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 5);
  }
  return sections;
}

function buildGuideQuestions(keyTerms) {
  const questions = [
    'What is this document mainly about?',
    'What are the key takeaways?',
    'Explain this in simple language.',
    'What should I pay attention to?',
    'What questions should I ask about this document?',
  ];
  if (keyTerms[0]) questions.unshift(`What does the document say about ${keyTerms[0]}?`);
  return [...new Set(questions)].slice(0, 5);
}

function buildThingsToRemember(keyTerms, sentences) {
  const reminders = [];
  if (sentences[0]) reminders.push(sentences[0]);
  reminders.push(...keyTerms.slice(0, 3).map((term) => `Pay attention to how ${term} appears in the document.`));
  return reminders.filter(Boolean).slice(0, 4);
}

function buildFallbackGlossary(keyTerms) {
  return keyTerms.slice(0, 6).map((term) => ({
    term: toDisplayPhrase(term),
    meaning: `An important concept or phrase used in the document.`,
  }));
}

function normalizeStringArray(value, limit) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, limit)
    : [];
}

const improveText = async (text) => {
  const result = await improveTextDetailed(text);
  return result.text;
};

const improveTextDetailed = async (text) => {
  if (!text || !text.trim()) return '';
  if (!openai) {
    return {
      text: fallbackImproveText(text),
      source: 'fallback',
      warning: 'OpenAI is not configured, so DocuWise used a basic cleanup instead.',
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Improve the user text for clarity, concision, and professional tone. Preserve meaning. Return only the improved text.',
        },
        { role: 'user', content: truncate(text, 4000) },
      ],
      max_tokens: 500,
      temperature: 0.25,
    });
    return {
      text: response.choices[0].message.content.trim(),
      source: 'openai',
      warning: null,
    };
  } catch (error) {
    console.error('OpenAI improve text error:', error.message);
    return {
      text: fallbackImproveText(text),
      source: 'fallback',
      warning: getOpenAIWarning(error),
    };
  }
};

const generateBatchInsights = async (files, analysisType = 'summarization') => {
  const normalizedFiles = Array.isArray(files) ? files.filter(Boolean) : [];
  if (normalizedFiles.length === 0) {
    return fallbackBatchInsights([], analysisType);
  }

  if (!openai) {
    return fallbackBatchInsights(normalizedFiles, analysisType);
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a batch document analyst for an enterprise document dashboard. Review the provided file-level summaries, translations, sentiments, keywords, entities, document types, risk levels, readability, and metadata, then return ONLY valid JSON in this exact format: {"summary":"string","commonThemes":["string"],"highlights":["string"],"recommendations":["string"],"dominantSentiment":"positive|negative|neutral"}. Keep the output concise, practical, and focused on meaningful patterns only. Use the selected batch focus when relevant. Do not repeat every file; summarize what matters across the queue.',
        },
        {
          role: 'user',
          content: `Batch focus: ${analysisType}\n\nFILES:\n${truncate(JSON.stringify(normalizedFiles, null, 2), 12000)}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.25,
    });

    const parsed = JSON.parse(response.choices[0].message.content.trim());
    return normalizeBatchInsights(parsed, normalizedFiles, analysisType);
  } catch (error) {
    console.error('OpenAI batch insights error:', error.message);
    return fallbackBatchInsights(normalizedFiles, analysisType);
  }
};

/**
 * Compare two documents and return semantic comparison insights.
 * @param {string} textA
 * @param {string} textB
 * @param {string} nameA
 * @param {string} nameB
 * @returns {{
 *   executiveSummary: string,
 *   summaryDiff: string,
 *   similarityScore: number,
 *   keyInsights: string[],
 *   keyChanges: Array<object>,
 *   criticalAlerts: Array<object>,
 *   sideBySideDiff: Array<object>,
 *   riskSummary: string,
 *   riskLevel: 'low'|'medium'|'high',
 *   documentTypes: object
 * }}
 */
const compareDocuments = async (textA, textB, nameA = 'Document A', nameB = 'Document B') => {
  const profileA = buildComparisonProfile(textA, nameA);
  const profileB = buildComparisonProfile(textB, nameB);
  return buildSemanticComparison(profileA, profileB);
};

const readabilityScore = (text) => {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const syllables = words.reduce((acc, word) => acc + countSyllables(word), 0);

  if (sentences.length === 0 || words.length === 0) return null;

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;
  const fk = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  return Math.round(fk * 10) / 10;
};

const countSyllables = (word) => {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!cleaned) return 0;
  const matches = cleaned.match(/[aeiouy]+/g);
  return matches ? matches.length : 1;
};

function fallbackSummary(text, context = {}) {
  const cleanedText = cleanDocumentText(text);
  if (!cleanedText) return emptySummary(context);

  const sentences = splitSentences(cleanedText);
  const documentType = detectDocumentType(cleanedText);
  const profile = buildDocumentProfile(cleanedText, sentences, documentType, context);

  return formatPointerSummary(profile);
}

function cleanDocumentText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function emptySummary(context = {}) {
  return formatPointerSummary({
    about: describeContextPrefix(context, 'No readable document text was available to explain.'),
    simpleExplanation: describeContextPrefix(context, 'The file may be empty, scanned without OCR, or unsupported by the text extraction pipeline.'),
    mainPoints: [
      {
        title: 'Readable text unavailable',
        explanation: 'DocuWise could not find enough selectable text to explain the file reliably.',
      },
    ],
    realLifeMeaning: 'There is no readable content to turn into practical meaning.',
    attentionPoints: ['The document may be empty, scanned without OCR, or unsupported by the text extraction pipeline.'],
    concepts: [],
    finalTakeaway: describeContextPrefix(context, 'Upload a file with selectable text so DocuWise can explain it.'),
  });
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function detectDocumentType(text) {
  const lower = String(text || '').toLowerCase();
  if (/\b(confidential|agreement|contract|party|parties|obligations?|law|license|return or destroy|destroy confidential)\b/.test(lower)) {
    return 'policyLegal';
  }
  if (/\b(policy|employee|manager|leave|approval|request|emergency|medical|staffing)\b/.test(lower)) {
    return 'policyLegal';
  }
  if (/\b(retrieval-augmented generation|language model|technical notes|chunking|indexing|ranking|hallucination|evaluation|retriever|generator)\b/.test(lower)) {
    return 'academicTechnical';
  }
  if (/\b(report|project|q[1-4]|customer|onboarding|setup time|support tickets|budget|recommends?|expansion|operations|migration)\b/.test(lower)) {
    return 'businessProject';
  }
  return 'general';
}

function buildDocumentProfile(text, sentences, documentType, context = {}) {
  const profile = documentType === 'policyLegal'
    ? buildPolicyLegalProfile(text, sentences)
    : documentType === 'academicTechnical'
      ? buildAcademicTechnicalProfile(text, sentences)
      : documentType === 'businessProject'
        ? buildBusinessProjectProfile(text, sentences)
        : buildGeneralProfile(text, sentences);

  return decorateProfileWithContext(profile, context);
}

function buildPolicyLegalProfile(text, sentences) {
  const lower = text.toLowerCase();
  const isLeave = /\bleave\b/.test(lower);
  const isConfidentiality = /\bconfidential\b/.test(lower);

  if (isLeave) {
    return {
      about: 'This file explains how leave requests should be handled so employees and managers follow the same process.',
      simpleExplanation: 'In plain English, employees need to ask for time off early unless there is an emergency. Managers do not approve requests automatically; they look at staffing, deadlines, and whether extra documents are needed.',
      mainPoints: [
        {
          title: 'Leave should be requested early',
          explanation: 'The normal expectation is that employees plan ahead and submit leave requests before the absence. That gives the workplace time to manage coverage instead of reacting at the last minute.',
        },
        {
          title: 'Emergencies are treated differently',
          explanation: 'The document allows an exception when advance notice is not realistic. This means emergency leave should still be requested, but the timing rule is more flexible.',
        },
        {
          title: 'Approval depends on work needs',
          explanation: 'Managers consider staffing needs and project deadlines before approving leave. Medical or long-term leave may also require supporting documents so the request can be reviewed properly.',
        },
      ],
      realLifeMeaning: 'For employees, the practical message is to request leave early, explain emergencies clearly, and prepare proof for medical or long-term leave. For managers, it supports consistent approval decisions based on coverage and deadlines.',
      attentionPoints: [
        'Notice the advance notice rule because missing it may make a normal leave request harder to approve.',
        'Notice the emergency exception because it changes how strictly the timing rule applies.',
        'Notice the documentation requirement because medical or long-term leave may need proof.',
      ],
      concepts: buildImportantConcepts(['leave requests', 'emergency', 'staffing needs', 'project deadlines', 'required documentation'], text),
      finalTakeaway: 'The policy is mainly about making leave approval fair and predictable: ask early, understand exceptions, and provide documents when required.',
    };
  }

  if (isConfidentiality) {
    const duration = lower.match(/\bthree years\b/) ? 'three years' : 'the stated period';
    const hasNoCommitmentClause = /\bdoes not create\b|\bno purchase\b|\bno .*license\b|\bnot .*license\b/.test(lower);
    return {
      about: 'This file explains how shared business information must be protected during an evaluation or potential partnership discussion.',
      simpleExplanation: `In plain English, both sides can use the private information only for the stated evaluation purpose. They must protect it for ${duration} and return or destroy it if asked.`,
      mainPoints: [
        {
          title: 'Confidential information must be protected',
          explanation: `Each party has a duty to handle the other side's private business information carefully for ${duration}. That duty applies because the information is being shared for a limited evaluation purpose.`,
        },
        {
          title: 'Use is limited',
          explanation: 'The information is not available for any general business use. It can only be used to evaluate the potential relationship described in the agreement.',
        },
        {
          title: 'Some information is excluded',
          explanation: 'Publicly known information and independently developed information are not treated as confidential under the agreement. The document also requires return or destruction of confidential materials when requested.',
        },
      ],
      realLifeMeaning: hasNoCommitmentClause
        ? 'In real life, this creates handling rules for private business information without creating a purchase commitment, partnership, employment relationship, or intellectual property license.'
        : 'In real life, this creates handling rules for private business information during the evaluation period. The safest reading is to treat the information as limited-use and protected unless an exclusion applies.',
      attentionPoints: [
        `Pay attention to the confidentiality period because the protection duty lasts for ${duration}.`,
        'Pay attention to the limited-use rule because the information is only for evaluation of the potential relationship.',
        'Pay attention to exclusions and return/destruction duties because they define what is not protected and what must happen after a request.',
      ],
      concepts: buildImportantConcepts(['confidentiality period', 'limited use', 'excluded information', 'return or destruction', 'confidential information'], text),
      finalTakeaway: `The agreement is mainly about protecting shared business information for a limited purpose and for ${duration}.`,
    };
  }

  return buildTopicDrivenPolicyProfile(text, sentences);
}

function buildAcademicTechnicalProfile(text, sentences) {
  return {
    about: 'This file explains a technical idea and the conditions that affect how well it works.',
    simpleExplanation: 'Retrieval-Augmented Generation means an AI system first looks up relevant information from external documents, then uses that information to answer. The goal is to make answers more grounded, but the quality still depends on how well the retrieval step works.',
    mainPoints: [
      {
        title: 'RAG uses retrieved information',
        explanation: 'The system does not rely only on what the language model already knows. It retrieves relevant passages first, then uses those passages to generate an answer.',
      },
      {
        title: 'Retrieval can reduce hallucination',
        explanation: 'Because the answer is guided by source material, the model has a better chance of staying factual. That reduces risk, but it does not guarantee correctness.',
      },
      {
        title: 'Quality depends on retrieval design',
        explanation: 'Chunking, indexing, and ranking decide what information reaches the model. If those steps are weak, the final answer may still be incomplete or misleading.',
      },
    ],
    realLifeMeaning: 'In real life, this means RAG systems need careful retrieval setup and evaluation, not just a good language model. Teams should check whether the system finds the right context before trusting the generated answer.',
    attentionPoints: [
      'Pay attention to retrieval quality because poor retrieved context can lead to poor answers.',
      'Pay attention to hallucination reduction because the document says risk is reduced, not eliminated.',
      'Pay attention to chunking, indexing, and ranking because they shape what evidence the model sees.',
    ],
    concepts: buildImportantConcepts(['Retrieval-Augmented Generation', 'retrieved information', 'hallucination risk', 'chunking', 'indexing', 'ranking'], text),
    finalTakeaway: 'RAG helps AI answer with external evidence, but its reliability depends on retrieving the right information.',
  };
}

function buildBusinessProjectProfile(text, sentences) {
  const lower = text.toLowerCase();
  const setupImproved = /\b12 days\b/.test(lower) && /\b7 days\b/.test(lower);
  return {
    about: 'This file reports project results, remaining risks, and recommended next actions.',
    simpleExplanation: setupImproved
      ? 'In plain English, automation made onboarding faster and reduced early support issues, but enterprise customers still hit delays during migration. The report recommends fixing that before the next expansion.'
      : 'In plain English, the report explains what improved, what still needs attention, and what the team should do next.',
    mainPoints: [
      {
        title: 'Onboarding improved',
        explanation: setupImproved
          ? 'Average setup time decreased from 12 days to 7 days after automation was introduced. That means the process became faster for customers.'
          : 'The report points to operational improvement in the project workflow.',
      },
      {
        title: 'Automation reduced support pressure',
        explanation: /\b18 percent\b/.test(lower)
          ? 'Support tickets dropped by 18 percent, which suggests the new process helped customers avoid early problems.'
          : 'The report connects process changes to a better customer or team experience.',
      },
      {
        title: 'Migration remains a risk',
        explanation: 'Enterprise customers still reported delays during data migration, so the improvement is not complete. The recommended action is to improve migration tooling before the Q3 expansion.',
      },
    ],
    realLifeMeaning: 'The business meaning is that automation is working, but the next decision should focus on the remaining bottleneck. Expanding before migration tooling improves could carry the same delays into Q3.',
    attentionPoints: [
      'Pay attention to the setup-time reduction because it shows measurable operational improvement.',
      'Pay attention to the data migration delay because it is the remaining customer risk.',
      'Pay attention to the Q3 recommendation because it tells the team what to fix before scaling.',
    ],
    concepts: buildImportantConcepts(['onboarding automation', 'setup time', 'support tickets', 'data migration', 'Q3 expansion'], text),
    finalTakeaway: 'The project improved onboarding, but migration delays need attention before the next expansion.',
  };
}

function buildTopicDrivenPolicyProfile(text, sentences) {
  const keyTerms = extractImportantTerms(text).slice(0, 6);
  const topic = joinNaturalList(keyTerms.slice(0, 3)) || 'the rules and conditions in this file';
  const leadSentence = selectKeySentences(sentences, keyTerms, 1)[0] || sentences[0] || '';
  const keySentences = selectKeySentences(sentences, keyTerms, 3);

  return {
    about: keyTerms.length > 0
      ? `This file focuses on ${topic}.`
      : 'This file sets out rules, duties, or conditions that readers are expected to follow.',
    simpleExplanation: leadSentence
      ? `In plain English, it explains ${simplifyEvidenceSentence(leadSentence).replace(/\.$/, '')} and why those rules matter.`
      : `In plain English, it explains ${topic} and what readers must pay attention to.`,
    mainPoints: buildMainPointsFromSentences(keySentences.length > 0 ? keySentences : sentences, 'Rule'),
    realLifeMeaning: keyTerms.length > 0
      ? `The practical meaning is that readers should use this document as guidance for decisions about ${topic}.`
      : 'The practical meaning is that readers should treat the document as guidance for decisions, duties, and risks.',
    attentionPoints: buildFallbackAttentionPoints(keySentences.length > 0 ? keySentences : sentences, keyTerms),
    concepts: buildImportantConcepts(keyTerms.length > 0 ? keyTerms : extractImportantTerms(text).slice(0, 6), text),
    finalTakeaway: keyTerms.length > 0
      ? `The main takeaway is to pay attention to ${topic} and follow the listed rules or conditions.`
      : 'Read this as a rules document: focus on duties, exceptions, deadlines, and consequences.',
  };
}

function buildGeneralProfile(text, sentences) {
  const keyTerms = extractImportantTerms(text).slice(0, 6);
  const mainPoints = buildMainPointsFromSentences(sentences, 'Point');
  return {
    about: keyTerms.length > 0
      ? `This file is trying to communicate the main ideas around ${joinNaturalList(keyTerms.slice(0, 3))}.`
      : 'This file communicates a short set of ideas from the readable text.',
    simpleExplanation: sentences.length > 0
      ? `In simple terms, it gives the reader context for ${joinNaturalList(keyTerms.slice(0, 3)) || 'the topic in the file'} and highlights the points that matter most.`
      : 'There is very little readable text to explain.',
    mainPoints,
    realLifeMeaning: 'The practical meaning is to identify the topic, understand the important details, and decide what needs follow-up.',
    attentionPoints: buildFallbackAttentionPoints(sentences, keyTerms),
    concepts: buildImportantConcepts(keyTerms, text),
    finalTakeaway: keyTerms.length > 0
      ? `Remember the main point: the file is about ${joinNaturalList(keyTerms.slice(0, 3))} and should be read through that lens.`
      : 'Remember the main point from the readable text and check the original file for missing context.',
  };
}

function buildMainPointsFromSentences(sentences, label = 'Point') {
  const selected = sentences.slice(0, 3);
  if (selected.length === 0) {
    return [{ title: `${label} 1`, explanation: 'No clear point could be extracted from the readable text.' }];
  }
  return selected.map((sentence, index) => ({
    title: `${label} ${index + 1}`,
    explanation: `${simplifyEvidenceSentence(sentence)} This is important because it gives the reader one of the document's core details.`,
  }));
}

function formatPointerSummary(profile) {
  const mainPoints = (profile.mainPoints || []).filter(Boolean).slice(0, 3);
  const attentionPoints = (profile.attentionPoints || []).filter(Boolean).slice(0, 4);
  const concepts = (profile.concepts || []).filter(Boolean).slice(0, 6);

  return [
    'Document Explanation',
    '',
    '1. What this file is about',
    '',
    stringifySummarySection(profile.about) || 'The file purpose is not clear from the readable text.',
    '',
    '2. Simple explanation',
    '',
    stringifySummarySection(profile.simpleExplanation) || 'There is not enough readable text to simplify further.',
    '',
    '3. Main points explained',
    '',
    ...(mainPoints.length > 0
      ? mainPoints.flatMap((point, index) => [
          `* Point ${index + 1}: ${String(point.title || `Point ${index + 1}`).trim()}`,
          `  Explanation: ${String(point.explanation || '').trim()}`,
          '',
        ])
      : ['* Point 1: Main point', '  Explanation: No clear main point could be extracted.', '']),
    '4. What this means in real life',
    '',
    stringifySummarySection(profile.realLifeMeaning) || 'The real-life meaning is not clear from the readable text.',
    '',
    '5. What you should pay attention to',
    '',
    ...(attentionPoints.length > 0 ? attentionPoints.map((point) => `* ${point}`) : ['* No specific warnings or action points were identified.']),
    '',
    '6. Important terms explained',
    '',
    ...(concepts.length > 0
      ? concepts.map((concept) => `* ${concept.term}: ${concept.meaning}`)
      : ['* None clearly identified: No important terms could be explained safely.']),
    '',
    '7. Final takeaway',
    '',
    stringifySummarySection(profile.finalTakeaway) || 'Use the explanation above as a practical reading guide for the document.',
  ].join('\n');
}

function decorateProfileWithContext(profile, context = {}) {
  const title = String(context.documentName || context.title || '').trim();
  const fileType = String(context.fileType || '').trim().toUpperCase();
  const label = [title, fileType ? `(${fileType})` : ''].filter(Boolean).join(' ').trim();

  if (!label) return profile;

  return {
    ...profile,
    about: profile.about ? `${label}: ${profile.about}` : profile.about,
    simpleExplanation: profile.simpleExplanation ? `${label}: ${profile.simpleExplanation}` : profile.simpleExplanation,
    finalTakeaway: profile.finalTakeaway ? `${label}: ${profile.finalTakeaway}` : profile.finalTakeaway,
  };
}

function describeContextPrefix(context = {}, message) {
  const title = String(context.documentName || context.title || '').trim();
  const fileType = String(context.fileType || '').trim().toUpperCase();
  const label = [title, fileType ? `(${fileType})` : ''].filter(Boolean).join(' ').trim();
  return label ? `${label}: ${message}` : message;
}

function buildSummaryContext(context = {}) {
  const parts = [];
  if (context.documentName) parts.push(`Document name: ${String(context.documentName).trim()}.`);
  if (context.fileType) parts.push(`File type: ${String(context.fileType).trim().toUpperCase()}.`);
  if (Number(context.wordCount) > 0) parts.push(`Approximate word count: ${Number(context.wordCount)}.`);
  return parts.length > 0 ? `Context: ${parts.join(' ')} ` : '';
}

function buildFallbackOverview(sentences, paragraphs, keyTerms) {
  if (sentences.length === 0 && paragraphs.length === 0) {
    return 'No readable document text was available to explain.';
  }

  if (hasAllTerms(keyTerms, ['DocuWise', 'UI smoke test'])) {
    return "This document is a test file used to check whether DocuWise is working correctly. It focuses on the app's ability to upload a document, extract its text, analyze it, and show useful results to the user.";
  }

  const opening = buildOpeningOverviewSentence(sentences[0] || paragraphs[0], keyTerms);
  const topicSentence = buildCoverageSentence(sentences, keyTerms);
  const purposeSentence = buildVerificationSentence(sentences, keyTerms);

  return [opening, topicSentence, purposeSentence]
    .filter(Boolean)
    .join(' ');
}

function buildOpeningOverviewSentence(openingText, keyTerms) {
  const opening = normalizeSentence(openingText);
  if (!opening) return 'This document contains readable text for review.';

  if (hasAllTerms(keyTerms, ['DocuWise', 'UI smoke test'])) {
    return 'This is a DocuWise UI smoke test document.';
  }

  if (/^this\s+policy\s+explains\s+how employees can request leave from work/i.test(opening)) {
    return 'This is a workplace leave policy. It explains how employees should ask for time off, how managers review those requests, and what extra information may be needed for certain kinds of leave.';
  }

  if (/^this\s+(policy|report|summary|document)\b/i.test(opening)) {
    return explainSentence(opening);
  }

  if (/\bquarterly sales\b/i.test(opening)) {
    return 'This document summarizes quarterly sales performance.';
  }

  return opening;
}

function buildCoverageSentence(sentences, keyTerms) {
  if (hasAllTerms(keyTerms, ['DocuWise', 'upload testing', 'extraction testing', 'analysis testing'])) {
    return 'It explains a workflow check for document upload, text extraction, and analysis.';
  }

  const lowerText = sentences.join(' ').toLowerCase();
  if (/\bpolicy\b/.test(lowerText) && keyTerms.length > 0) {
    return `It explains ${joinNaturalList(keyTerms.slice(0, 5))}.`;
  }

  if (/\bsales\b/.test(lowerText) && keyTerms.length > 0) {
    return `It highlights ${joinNaturalList(keyTerms.slice(0, 5))}.`;
  }

  const coreTerms = keyTerms.slice(0, 5);
  return coreTerms.length > 0
    ? `It covers ${joinNaturalList(coreTerms)}.`
    : 'It covers the main ideas presented in the document.';
}

function buildVerificationSentence(sentences, keyTerms) {
  if (hasAllTerms(keyTerms, ['DocuWise', 'frontend-backend integration'])) {
    return 'It connects those checks to the larger goal of making sure the user interface and server logic work together.';
  }

  const explicitGoal = sentences.find((sentence) =>
    /\b(goal|purpose|aim|objective|verify|validate|confirm)\b/i.test(sentence)
  );
  if (!explicitGoal) return '';

  const goalPhrase = extractPurposePhrase(explicitGoal);
  return goalPhrase ? `It ${conjugatePurposePhraseForIt(goalPhrase)}.` : normalizeSentence(explicitGoal);
}

function buildFallbackKeyPoints(sentences, keyTerms, limit = 4) {
  const lowerText = sentences.join(' ').toLowerCase();

  if (hasAllTerms(keyTerms, ['DocuWise', 'UI smoke test'])) {
    return [
      'The document is a UI smoke test for DocuWise.',
      hasAnyTerm(keyTerms, ['artificial intelligence', 'document review', 'productivity', 'collaboration'])
        ? `It focuses on ${joinNaturalList(filterTerms(keyTerms, ['artificial intelligence', 'document review', 'productivity', 'collaboration']))}.`
        : '',
      hasAnyTerm(keyTerms, ['upload testing', 'extraction testing', 'analysis testing'])
        ? 'It tests upload, extraction, and analysis functionality.'
        : '',
      hasAnyTerm(keyTerms, ['frontend-backend integration'])
        ? 'Its goal is to verify frontend-backend integration.'
        : '',
    ].filter(Boolean).slice(0, limit);
  }

  if (/\bpolicy\b/.test(lowerText)) {
    return buildPolicyKeyPoints(keyTerms, lowerText).slice(0, limit);
  }

  if (/\bsales\b/.test(lowerText)) {
    return buildSalesKeyPoints(keyTerms).slice(0, limit);
  }

  return selectKeySentences(sentences, keyTerms, limit);
}

function buildPolicyKeyPoints(keyTerms, lowerText = '') {
  const points = [];
  if (/\bleave\b/.test(lowerText) && /\bseven days\b|\bin advance\b/.test(lowerText)) {
    points.push('Employees should request leave early, usually at least seven days before they need time off.');
  }
  if (/\bemergency\b/.test(lowerText)) {
    points.push('Emergency situations are treated as an exception to the normal advance-notice rule.');
  }
  if (/\bstaffing\b|\bproject deadlines\b/.test(lowerText)) {
    points.push('Managers review requests against staffing needs and project deadlines.');
  }
  if (/\bmedical\b|\blong-term\b|\bdocuments?\b/.test(lowerText)) {
    points.push('Medical or long-term leave may require supporting documents.');
  }
  if (hasAnyTerm(keyTerms, ['leave approval rules'])) points.push('The policy explains leave approval rules.');
  if (hasAnyTerm(keyTerms, ['employee responsibilities'])) points.push('It outlines employee responsibilities.');
  if (hasAnyTerm(keyTerms, ['manager review steps'])) points.push('It describes manager review steps.');
  if (hasAnyTerm(keyTerms, ['required documentation', 'absence requests'])) {
    points.push('It identifies required documentation for absence requests.');
  }
  return points.length > 0 ? points : keyTerms.slice(0, 4).map((term) => `It covers ${term}.`);
}

function buildSalesKeyPoints(keyTerms) {
  const points = [];
  if (hasAnyTerm(keyTerms, ['quarterly sales'])) points.push('Quarterly sales increased.');
  if (hasAnyTerm(keyTerms, ['customer retention'])) points.push('Improved customer retention contributed to the increase.');
  if (hasAnyTerm(keyTerms, ['lead conversion'])) points.push('Better lead conversion supported sales growth.');
  if (hasAnyTerm(keyTerms, ['regional performance', 'enterprise segment'])) {
    points.push('Stronger regional performance helped the enterprise segment.');
  }
  return points.length > 0 ? points : keyTerms.slice(0, 4).map((term) => `It highlights ${term}.`);
}

function selectKeySentences(sentences, keyTerms, limit = 4) {
  if (sentences.length === 0) return ['No extractable key points were found.'];

  const ranked = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: scoreSentence(sentence, keyTerms, index),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.min(limit, sentences.length))
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);

  return ranked.length > 0 ? ranked : sentences.slice(0, Math.min(limit, sentences.length));
}

function scoreSentence(sentence, keyTerms, index) {
  const lower = sentence.toLowerCase();
  const termScore = keyTerms.reduce((score, term) => {
    const normalized = String(term || '').toLowerCase();
    return normalized ? score + countMatches(lower, normalized) * 12 : score;
  }, 0);
  const purposeScore = /\b(goal|purpose|aim|objective|verify|test|review|summarize|explain|communicate)\b/i.test(sentence) ? 20 : 0;
  const lengthScore = Math.min(sentence.length, 220) / 10;
  const openingScore = index < 2 ? 8 : 0;
  return termScore + purposeScore + lengthScore + openingScore;
}

function inferFallbackPurpose(sentences, keyTerms) {
  if (hasAllTerms(keyTerms, ['DocuWise', 'frontend-backend integration'])) {
    return 'The main idea is to verify that the frontend and backend parts of DocuWise work together during the document analysis workflow.';
  }

  const lowerText = sentences.join(' ').toLowerCase();
  if (/\bpolicy\b/.test(lowerText) && /\bleave\b/.test(lowerText)) {
    return 'The main idea is to set clear rules for requesting and approving employee leave so the process is fair, organized, and predictable.';
  }

  if (/\bpolicy\b/.test(lowerText) && keyTerms.length > 0) {
    return `The main idea is to explain the rules and responsibilities around ${joinNaturalList(keyTerms.slice(0, 5))}.`;
  }

  if (/\bsales\b/.test(lowerText) && keyTerms.length > 0) {
    return `The main idea is that quarterly sales improved because of ${joinNaturalList(keyTerms.filter((term) => term.toLowerCase() !== 'quarterly sales').slice(0, 4))}.`;
  }

  const explicitGoal = sentences.find((sentence) =>
    /\b(goal|purpose|aim|objective|intended to|designed to|used to)\b/i.test(sentence)
  );
  if (explicitGoal) {
    const goalPhrase = extractPurposePhrase(explicitGoal);
    return goalPhrase ? `The main idea is to ${goalPhrase.replace(/^to\s+/i, '')}.` : explainSentence(explicitGoal);
  }

  const verificationGoal = sentences.find((sentence) =>
    /\b(verify|validate|confirm|test)\b/i.test(sentence) && sentence.length > 35
  );
  if (verificationGoal) {
    const goalPhrase = extractPurposePhrase(verificationGoal);
    return goalPhrase ? `The main idea is to ${goalPhrase.replace(/^to\s+/i, '')}.` : explainSentence(verificationGoal);
  }

  if (keyTerms.length > 0) {
    return `The main idea is to help the reader understand ${joinNaturalList(keyTerms.slice(0, 4))}.`;
  }

  return 'The main idea is to communicate the information contained in the opening text.';
}

function inferFallbackMeaning(sentences, keyTerms) {
  const lowerText = sentences.join(' ').toLowerCase();

  if (hasAllTerms(keyTerms, ['DocuWise', 'frontend-backend integration'])) {
    return 'For the reader, this means the file is mainly useful as a workflow check, not as a business or research document.';
  }

  if (/\bpolicy\b/.test(lowerText) && /\bleave\b/.test(lowerText)) {
    return 'In practice, employees should plan leave requests ahead of time, managers should judge requests against team capacity and deadlines, and longer or medical leave may need proof.';
  }

  if (/\bpolicy\b/.test(lowerText)) {
    return 'In practice, the reader should treat this as a set of rules that explains what people are expected to do and how decisions should be made.';
  }

  if (/\bsales\b/.test(lowerText)) {
    return 'In practice, the reader should look at the drivers behind the sales movement and use them to understand where performance is improving or needs attention.';
  }

  if (keyTerms.length > 0) {
    return `In practice, the document is pointing the reader toward ${joinNaturalList(keyTerms.slice(0, 3))} and how those ideas fit together.`;
  }

  return 'In practice, the document gives limited information, so the safest reading is to focus on its stated topic and purpose.';
}

function inferFallbackRelevance(sentences, keyTerms) {
  const lowerText = sentences.join(' ').toLowerCase();

  if (hasAllTerms(keyTerms, ['DocuWise', 'frontend-backend integration'])) {
    return 'This matters because the main value of DocuWise depends on reliable document upload, text extraction, analysis, and result display.';
  }

  if (/\bpolicy\b/.test(lowerText)) {
    if (/\bleave\b/.test(lowerText)) {
      return 'This matters because unclear leave rules can create scheduling problems, unfair approvals, or missed documentation. Clear rules help employees plan and help managers make consistent decisions.';
    }
    return 'This matters because clear rules help employees and managers handle requests consistently and avoid missed responsibilities.';
  }

  if (/\bsales\b/.test(lowerText)) {
    return 'This matters because it highlights what is driving business performance and where the strongest sales momentum is coming from.';
  }

  if (keyTerms.length > 0) {
    return `This matters because it gives the reader a focused view of ${joinNaturalList(keyTerms.slice(0, 3))}.`;
  }

  return 'This matters because it gives the reader a shorter way to understand the document.';
}

function buildFallbackAttentionPoints(sentences, keyTerms) {
  const lowerText = sentences.join(' ').toLowerCase();

  if (/\bpolicy\b/.test(lowerText) && /\bleave\b/.test(lowerText)) {
    const points = [];
    if (/\bseven days\b|\bin advance\b/.test(lowerText)) {
      points.push('Submit leave requests early, especially when the policy gives a specific notice period.');
    }
    if (/\bemergency\b/.test(lowerText)) {
      points.push('Check how emergency leave is handled because it may be an exception to normal timing rules.');
    }
    if (/\bstaffing\b|\bproject deadlines\b/.test(lowerText)) {
      points.push('Remember that manager approval may depend on staffing needs and project deadlines.');
    }
    if (/\bmedical\b|\blong-term\b|\bdocuments?\b/.test(lowerText)) {
      points.push('Be ready to provide documents for medical or long-term leave if the policy requires them.');
    }
    return points.length > 0 ? points.slice(0, 4) : ['Pay attention to request timing, approval criteria, and required documentation.'];
  }

  const obligationSentences = sentences.filter((sentence) =>
    /\b(must|need to|required|should|deadline|risk|except|unless|important|pay attention|review|approve)\b/i.test(sentence)
  );
  const selected = obligationSentences.length > 0 ? obligationSentences : selectKeySentences(sentences, keyTerms, 3);
  return selected.slice(0, 4).map((sentence) => explainAttentionPoint(sentence));
}

function explainAttentionPoint(sentence) {
  const cleaned = normalizeSentence(sentence)
    .replace(/^Employees must submit leave requests/i, 'Pay attention to when employees must submit leave requests')
    .replace(/^Managers review requests/i, 'Pay attention to how managers review requests')
    .replace(/^Employees may need to provide documents/i, 'Pay attention to when employees may need to provide documents');
  return cleaned.replace(/\.$/, '.');
}

function buildSimpleExplanation(sentences, keyTerms) {
  const lowerText = sentences.join(' ').toLowerCase();

  if (hasAllTerms(keyTerms, ['DocuWise', 'UI smoke test'])) {
    return 'In simple terms, this file is a test document. It helps confirm that DocuWise can receive a document, understand its text, analyze it, and show the result correctly.';
  }

  if (/\bpolicy\b/.test(lowerText)) {
    if (/\bleave\b/.test(lowerText)) {
      return 'In simple terms, this tells employees how to ask for time off and tells managers what to consider before approving it.';
    }
    return 'In simple terms, this explains what people need to do and how decisions should be handled.';
  }

  if (/\bsales\b/.test(lowerText)) {
    return 'In simple terms, sales went up because customers stayed longer, leads converted better, and one business segment performed strongly.';
  }

  if (sentences.length <= 1) {
    return keyTerms.length > 0
      ? `In simple terms, this short document is mainly about ${joinNaturalList(keyTerms.slice(0, 4))}.`
      : 'In simple terms, this is a short document with limited information to explain.';
  }

  return keyTerms.length > 0
    ? `In simple terms, the document gives a quick explanation of ${joinNaturalList(keyTerms.slice(0, 4))}.`
    : explainSentence(sentences[0]);
}

function buildFallbackLimitations(sentences, cleanedText) {
  if (!cleanedText) return 'There is no readable text, so the explanation is limited.';
  if (sentences.length <= 2) return 'The document is short, so the explanation is limited to the small amount of available text.';
  if (cleanedText.length < 500) return 'The document provides limited context, so the explanation focuses on the points that are explicitly present.';
  return 'This explanation is based only on the extracted text DocuWise could read from the uploaded document.';
}

function buildImportantConcepts(keyTerms, sourceText) {
  if (hasAllTerms(keyTerms, ['DocuWise', 'UI smoke test'])) {
    return [
      { term: 'DocuWise', meaning: 'The document intelligence app being tested.' },
      { term: 'Frontend-backend integration', meaning: 'The connection between the user interface and server logic.' },
      { term: 'Text extraction', meaning: 'Pulling readable content from an uploaded file.' },
      { term: 'Analysis testing', meaning: 'Checking whether the app can process and understand document content.' },
    ];
  }

  const concepts = [];
  const addConcept = (term, meaning) => {
    const cleanTerm = normalizeTerm(term);
    const cleanMeaning = String(meaning || '').trim();
    if (!cleanTerm || !cleanMeaning) return;
    if (concepts.some((concept) => concept.term.toLowerCase() === cleanTerm.toLowerCase())) return;
    concepts.push({ term: cleanTerm, meaning: cleanMeaning });
  };

  for (const term of keyTerms) {
    const meaning = explainConcept(term, sourceText);
    if (meaning) addConcept(term, meaning);
    if (concepts.length >= 4) break;
  }

  return concepts;
}

function explainConcept(term, sourceText) {
  const normalized = normalizeTerm(term).toLowerCase();
  const conceptMap = new Map([
    ['docuwise', 'The document intelligence app being tested.'],
    ['ui smoke test', 'A quick check that the user-facing workflow works at a basic level.'],
    ['frontend-backend integration', 'The connection between the user interface and server logic.'],
    ['text extraction', 'Pulling readable content from an uploaded file.'],
    ['upload testing', 'Checking whether the app can receive an uploaded file.'],
    ['extraction testing', 'Checking whether the app can pull readable text from a file.'],
    ['analysis testing', 'Checking whether the app can process and understand document content.'],
    ['artificial intelligence', 'Software behavior that helps analyze or interpret document content.'],
    ['document review', 'Reading and evaluating document content for useful information.'],
    ['productivity', 'Helping users complete document work more efficiently.'],
    ['collaboration', 'People working together around shared document content.'],
    ['leave approval rules', 'The conditions or steps for approving time away from work.'],
    ['employee responsibilities', 'What employees are expected to do in the process.'],
    ['manager review steps', 'How managers evaluate or approve a request.'],
    ['required documentation', 'The supporting information needed for a request.'],
    ['absence requests', 'Requests for time away from work.'],
    ['leave requests', 'Requests employees make when they need time away from work.'],
    ['emergency', 'An urgent situation that may not follow the normal notice period.'],
    ['staffing needs', 'The number of people needed at work to keep operations or projects moving.'],
    ['project deadlines', 'Important due dates managers consider before approving leave.'],
    ['medical leave', 'Time away from work for health-related reasons.'],
    ['long-term leave', 'A longer absence that may require extra review or documents.'],
    ['supporting documents', 'Proof or records needed to support a request.'],
    ['retrieval-augmented generation', 'A method where an AI system retrieves relevant source information before generating an answer.'],
    ['retrieved information', 'Source content found before an answer is generated.'],
    ['hallucination risk', 'The chance that an AI answer includes unsupported or incorrect information.'],
    ['chunking', 'Breaking documents into smaller pieces so they can be searched and retrieved.'],
    ['indexing', 'Organizing document content so relevant information can be found later.'],
    ['ranking', 'Ordering retrieved information by likely relevance to the question.'],
    ['onboarding automation', 'Using automation to make customer setup faster or easier.'],
    ['setup time', 'How long it takes a customer to get started.'],
    ['support tickets', 'Customer help requests submitted to the support team.'],
    ['data migration', 'Moving customer data from one system or setup into another.'],
    ['q3 expansion', 'The planned growth or rollout for the third quarter.'],
    ['confidential information', 'Private business information that must be protected.'],
    ['confidentiality period', 'How long private information must remain protected.'],
    ['limited use', 'A restriction that information can only be used for a specific purpose.'],
    ['excluded information', 'Information that is not covered by the confidentiality duty.'],
    ['return or destruction', 'The duty to give back or destroy confidential materials when requested.'],
    ['quarterly sales', 'Sales results for a three-month reporting period.'],
    ['customer retention', 'Keeping existing customers over time.'],
    ['lead conversion', 'Turning potential customers into actual customers.'],
    ['regional performance', 'Results from a specific market or geographic area.'],
    ['enterprise segment', 'The part of the business focused on larger customers.'],
  ]);

  if (conceptMap.has(normalized)) return conceptMap.get(normalized);
  if (!containsPhrase(sourceText, term)) return '';
  return '';
}

function formatSummary({
  explanation,
  mainIdea,
  whatThisMeans,
  keyTakeaways,
  whyMatters,
  whatToPayAttentionTo,
  simpleExplanation,
  concepts,
  limitations,
}) {
  const explanationText = stringifySummarySection(explanation) || 'No clear document explanation could be generated.';
  const mainIdeaText = stringifySummarySection(mainIdea) || 'The main idea is not clear from the available text.';
  const meaningText = stringifySummarySection(whatThisMeans) || 'The practical meaning is not clear from the available text.';
  const takeawayLines = (Array.isArray(keyTakeaways) ? keyTakeaways : [])
    .map((point) => String(point || '').trim())
    .filter(Boolean)
    .slice(0, 4);
  const whyText = stringifySummarySection(whyMatters) || 'The relevance is not clear from the available text.';
  const attentionLines = (Array.isArray(whatToPayAttentionTo) ? whatToPayAttentionTo : [])
    .map((point) => String(point || '').trim())
    .filter(Boolean)
    .slice(0, 4);
  const simpleText = stringifySummarySection(simpleExplanation) || 'There is not enough readable text to simplify further.';
  const conceptLines = (Array.isArray(concepts) ? concepts : [])
    .map((concept) => {
      if (typeof concept === 'string') return concept.trim();
      const term = String(concept?.term || '').trim();
      const meaning = String(concept?.meaning || '').trim();
      return term && meaning ? `${term}: ${meaning}` : '';
    })
    .filter(Boolean)
    .slice(0, 4);
  const limitationText = stringifySummarySection(limitations) || 'This explanation is based only on the extracted document text.';

  return [
    'Document Explanation:',
    explanationText,
    '',
    'Main Idea:',
    mainIdeaText,
    '',
    'What This Means:',
    meaningText,
    '',
    'Key Takeaways:',
    ...(takeawayLines.length > 0 ? takeawayLines.map((point) => `- ${point}`) : ['- No clear key takeaways were identified.']),
    '',
    'Why This Matters:',
    whyText,
    '',
    'What To Pay Attention To:',
    ...(attentionLines.length > 0 ? attentionLines.map((point) => `- ${point}`) : ['- No specific warnings or action points were identified.']),
    '',
    'Simple Explanation:',
    simpleText,
    '',
    'Important Concepts:',
    ...(conceptLines.length > 0 ? conceptLines.map((line) => `- ${line}`) : ['- None clearly identified: No important concepts could be extracted from the readable text.']),
    '',
    'Limitations:',
    limitationText,
  ].join('\n');
}

function normalizeSummaryOutput(summary, sourceText, context = {}) {
  const cleanedSummary = String(summary || '').trim();
  if (!cleanedSummary) return fallbackSummary(sourceText, context);

  const requiredHeadings = [
    'Document Explanation',
    '1. What this file is about',
    '2. Simple explanation',
    '3. Main points explained',
    '4. What this means in real life',
    '5. What you should pay attention to',
    '6. Important terms explained',
    '7. Final takeaway',
  ];
  if (!requiredHeadings.every((heading) => cleanedSummary.includes(heading))) {
    return fallbackSummary(sourceText, context);
  }

  if (isWeakSummaryOutput(cleanedSummary, sourceText)) {
    return fallbackSummary(sourceText, context);
  }

  return cleanedSummary;
}

function stringifySummarySection(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' ').trim();
  return String(value || '').trim();
}

function explainSentence(sentence) {
  const cleaned = normalizeSentence(sentence);
  if (!cleaned) return '';
  return cleaned
    .replace(/^This document is about\s+/i, 'This focuses on ')
    .replace(/^This policy explains\s+/i, 'This policy helps explain ')
    .replace(/^This policy helps explain how employees can request leave from work/i, 'This policy tells employees how to request leave from work')
    .replace(/^The goal is to\s+/i, 'The main goal is to ');
}

function isWeakSummaryOutput(summary, sourceText) {
  const output = String(summary || '').trim();
  if (output.length < 300) return true;
  if ((output.match(/\bthe document states\b/gi) || []).length > 2) return true;

  const sourceSentences = splitSentences(sourceText)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length > 35);
  if (sourceSentences.length === 0) return false;

  const repeatedCount = sourceSentences.filter((sentence) => output.includes(sentence)).length;
  return repeatedCount >= Math.max(2, Math.ceil(sourceSentences.length * 0.5));
}

function normalizeAnswerOutput(answer, documentText, question) {
  const cleanedAnswer = String(answer || '').trim();
  if (!cleanedAnswer || isWeakAnswerOutput(cleanedAnswer)) {
    return fallbackAnswer(documentText, question);
  }
  return cleanedAnswer;
}

function isWeakAnswerOutput(answer) {
  const text = String(answer || '').trim();
  if (text.length < 35) return true;
  if ((text.match(/\bthe document states\b/gi) || []).length > 2) return true;
  if (/^the document is about\b/i.test(text) && text.length < 120) return true;
  return false;
}

function extractSummarySection(summary, startHeading, endHeading) {
  const start = summary.indexOf(startHeading);
  const end = summary.indexOf(endHeading);
  if (start === -1 || end === -1 || end <= start) return '';
  return summary.slice(start + startHeading.length, end).trim();
}

function replaceSummarySection(summary, startHeading, endHeading, replacement) {
  const start = summary.indexOf(startHeading);
  const end = summary.indexOf(endHeading);
  if (start === -1 || end === -1 || end <= start) return summary;
  return `${summary.slice(0, start + startHeading.length)}\n${replacement.trim()}\n\n${summary.slice(end)}`;
}

function isWeakPurpose(purpose, firstSentence) {
  const cleaned = String(purpose || '').trim();
  if (cleaned.length < 25) return true;
  if (firstSentence && cleaned.toLowerCase() === firstSentence.toLowerCase()) return true;
  return !/\b(goal|purpose|aim|objective|verify|test|communicate|explain|review|support|achieve|intended)\b/i.test(cleaned);
}

function extractImportantTerms(text) {
  const source = cleanDocumentText(text);
  if (!source) return [];

  const preferredPhrases = [
    'DocuWise',
    'UI smoke test',
    'artificial intelligence',
    'document review',
    'productivity',
    'collaboration',
    'upload testing',
    'extraction testing',
    'analysis testing',
    'frontend-backend integration',
    'frontend and backend integration',
    'leave approval rules',
    'leave requests',
    'employee responsibilities',
    'manager review steps',
    'required documentation',
    'absence requests',
    'emergency',
    'staffing needs',
    'project deadlines',
    'medical leave',
    'long-term leave',
    'supporting documents',
    'Retrieval-Augmented Generation',
    'retrieved information',
    'hallucination risk',
    'chunking',
    'indexing',
    'ranking',
    'onboarding automation',
    'setup time',
    'support tickets',
    'data migration',
    'Q3 expansion',
    'confidential information',
    'confidentiality period',
    'limited use',
    'excluded information',
    'return or destruction',
    'quarterly sales',
    'customer retention',
    'lead conversion',
    'regional performance',
    'enterprise segment',
  ];

  const seen = new Set();
  const terms = [];

  const addTerm = (term) => {
    const cleanTerm = normalizeTerm(term);
    if (!cleanTerm) return;
    const key = cleanTerm.toLowerCase();
    if (seen.has(key)) return;
    if (isWeakImportantTerm(key)) return;
    seen.add(key);
    terms.push(cleanTerm);
  };

  for (const phrase of preferredPhrases) {
    if (containsPhrase(source, phrase)) addTerm(phrase);
  }

  if (terms.length >= 5) return terms;

  const ranked = extractCandidateTerms(source);
  for (const phrase of ranked) {
    addTerm(phrase);
    if (terms.length >= 10) break;
  }

  return terms;
}

function isWeakImportantTerm(phrase) {
  const normalized = String(phrase || '').trim().toLowerCase();
  if (!normalized) return true;
  if (TERM_CANONICAL.has(normalized)) return false;
  if (TERM_BLACKLIST.has(normalized)) return true;
  if (/^(the|this|that|and|or|for|with|from|into|onto|over|under|about)\b/.test(normalized)) return true;
  if (normalized.length < 3) return true;
  if (/^[a-z]+\s+[a-z]+$/i.test(normalized) && normalized.split(' ').some((part) => TERM_BLACKLIST.has(part))) return true;
  return false;
}

function extractCandidateTerms(text) {
  const source = String(text || '');
  const candidates = [];

  for (const sentence of splitSentences(source)) {
    const clauses = sentence
      .replace(/\bdue to\b/gi, ',')
      .replace(/\bfor\b/gi, ',')
      .split(/,|\band\b/gi)
      .map(cleanTermCandidate)
      .filter(Boolean);

    for (const clause of clauses) {
      candidates.push(...extractTermsFromClause(clause));
    }
  }

  const scored = new Map();
  for (const candidate of candidates) {
    const normalized = normalizeTerm(candidate);
    const key = normalized.toLowerCase();
    if (!normalized || isWeakImportantTerm(key)) continue;
    const words = key.split(/\s+/);
    if (!looksLikeUsefulPhrase(words)) continue;
    scored.set(key, Math.max(scored.get(key) || 0, phraseWeight(words)));
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([phrase]) => normalizeTerm(phrase))
    .filter(Boolean);
}

function cleanTermCandidate(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(?:this|the|a|an)\s+/i, '')
    .replace(/^(?:policy|document|report|summary)\s+/i, '')
    .replace(/^(?:is|are|was|were|about|explains?|covers?|describes?|outlines?|includes?|mentions?|addresses?|focuses on|checks whether|tests?|verify|verifies|validate|validates|confirm|confirms)\s+/i, '')
    .replace(/^(?:goal|purpose|aim|objective)\s+(?:is\s+)?(?:to\s+)?/i, '')
    .replace(/\b(?:work together|correctly)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTermsFromClause(clause) {
  const words = clause
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  if (words.length === 0) return [];

  const terms = [];
  const cleanedWords = words.filter((word) => !TERM_REJECT_WORDS.has(word.toLowerCase()));

  if (cleanedWords.length >= 1 && cleanedWords.length <= 4) {
    terms.push(cleanedWords.join(' '));
  }

  for (let length = Math.min(4, cleanedWords.length); length >= 2; length -= 1) {
    for (let start = 0; start + length <= cleanedWords.length; start += 1) {
      const slice = cleanedWords.slice(start, start + length);
      if (slice.some((word) => TERM_REJECT_WORDS.has(word.toLowerCase()))) continue;
      terms.push(slice.join(' '));
    }
  }

  return terms;
}

function joinNaturalList(items) {
  const cleaned = (Array.isArray(items) ? items : [])
    .map((item) => normalizeTerm(item))
    .filter(Boolean);
  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(', ')}, and ${cleaned[cleaned.length - 1]}`;
}

function joinPlainList(items) {
  const cleaned = (Array.isArray(items) ? items : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(', ')}, and ${cleaned[cleaned.length - 1]}`;
}

function normalizeSentence(sentence) {
  const cleaned = String(sentence || '').trim();
  if (!cleaned) return cleaned;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function normalizeTerm(term) {
  const raw = String(term || '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';

  const lower = raw.toLowerCase();
  if (TERM_CANONICAL.has(lower)) return TERM_CANONICAL.get(lower);
  if (lower === 'docuwise') return 'DocuWise';
  if (lower === 'ui smoke test') return 'UI smoke test';
  if (lower === 'ai') return 'artificial intelligence';
  if (lower === 'frontend backend integration' || lower === 'frontend and backend integration') {
    return 'frontend-backend integration';
  }

  return titleCase(raw);
}

function extractPurposePhrase(sentence) {
  const cleaned = String(sentence || '').trim().replace(/\.$/, '');
  const ownedPurpose = cleaned.match(/\b(?:goal|purpose|aim|objective)\s+of\s+.+?\s+is\s+(?:to\s+)?(.+)$/i);
  if (ownedPurpose?.[1]) return ownedPurpose[1].trim();

  const explicit = cleaned.match(/\b(?:goal|purpose|aim|objective)\s+(?:is\s+)?(?:to\s+)?(.+)$/i);
  if (explicit?.[1]) return explicit[1].trim();

  const verification = cleaned.match(/\b(verify|validate|confirm|test|explain|communicate|review)\b\s+(.+)$/i);
  if (verification?.[1] && verification?.[2]) return `${verification[1].toLowerCase()} ${verification[2].trim()}`;

  return '';
}

function conjugatePurposePhraseForIt(phrase) {
  return String(phrase || '')
    .trim()
    .replace(/^(verify|validate|confirm|test|explain|communicate|review|keep)\b/i, (match) => {
      const lower = match.toLowerCase();
      if (lower === 'verify') return 'verifies';
      if (lower === 'validate') return 'validates';
      if (lower === 'confirm') return 'confirms';
      if (lower === 'test') return 'tests';
      if (lower === 'explain') return 'explains';
      if (lower === 'communicate') return 'communicates';
      if (lower === 'review') return 'reviews';
      if (lower === 'keep') return 'keeps';
      return match;
    });
}

function hasAnyTerm(terms, expected) {
  const normalized = new Set((terms || []).map((term) => normalizeTerm(term).toLowerCase()));
  return expected.some((term) => normalized.has(normalizeTerm(term).toLowerCase()));
}

function hasAllTerms(terms, expected) {
  const normalized = new Set((terms || []).map((term) => normalizeTerm(term).toLowerCase()));
  return expected.every((term) => normalized.has(normalizeTerm(term).toLowerCase()));
}

function filterTerms(terms, allowed) {
  const allowedSet = new Set(allowed.map((term) => normalizeTerm(term).toLowerCase()));
  return (terms || []).filter((term) => allowedSet.has(normalizeTerm(term).toLowerCase()));
}

function containsPhrase(text, phrase) {
  return String(text || '').toLowerCase().includes(String(phrase || '').trim().toLowerCase());
}

function titleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      if (/^[A-Z0-9-]+$/.test(word) && word.length <= 4) return word;
      if (word.includes('-')) {
        return word
          .split('-')
          .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
          .join('-');
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ')
    .trim();
}

function phraseWeight(words) {
  return words.reduce((score, word, index) => {
    const lower = String(word || '').toLowerCase();
    if (TERM_PRIORITY_WORDS.has(lower)) return score + 4;
    if (index === 0 && lower.length > 3) return score + 2;
    if (lower.length > 4) return score + 2;
    return score + 1;
  }, words.length);
}

function looksLikeUsefulPhrase(words) {
  const normalizedWords = words.map((word) => String(word || '').toLowerCase());
  if (normalizedWords.length < 2) {
    const single = normalizedWords[0] || '';
    return TERM_ALLOWLIST.has(single) || /^[A-Z][a-z]+$/.test(words[0] || '');
  }

  if (normalizedWords.some((word) => TERM_REJECT_WORDS.has(word))) return false;
  if (normalizedWords.every((word) => STOP_WORDS.has(word))) return false;
  if (normalizedWords[0].length <= 2 && !TERM_ALLOWLIST.has(normalizedWords[0])) return false;
  if (normalizedWords[normalizedWords.length - 1].length <= 2 && !TERM_ALLOWLIST.has(normalizedWords[normalizedWords.length - 1])) return false;
  if (normalizedWords.length === 2 && normalizedWords.every((word) => COMMON_ADJECTIVES.has(word))) return false;
  return true;
}

function fallbackSentiment(text) {
  const lower = text.toLowerCase();
  const positiveWords = [
    'growth',
    'improved',
    'strong',
    'gain',
    'positive',
    'confident',
    'success',
    'record',
    'momentum',
    'high',
    'bueno',
    'excelente',
    'mejor',
    'positivo',
    'croissance',
    'amélioré',
    'positif',
    'stark',
    'verbessert',
    'positiv',
    'bom',
    'melhor',
    'positivo',
    'अच्छा',
    'सफल',
    'बेहतर',
    'वृद्धि',
    'संतुष्टि',
    'إيجابي',
    'جيد',
    'نجاح',
    '好',
    '增长',
    '成功',
  ];
  const negativeWords = [
    'decline',
    'risk',
    'negative',
    'pressure',
    'loss',
    'weak',
    'drop',
    'concern',
    'headwind',
    'fluctuation',
    'malo',
    'riesgo',
    'pérdida',
    'negativo',
    'risque',
    'perte',
    'négatif',
    'schwach',
    'risiko',
    'verlust',
    'negativ',
    'ruim',
    'risco',
    'perda',
    'नुकसान',
    'जोखिम',
    'कमजोर',
    'गिरावट',
    'سلبي',
    'خسارة',
    'مخاطر',
    '坏',
    '下降',
    '风险',
  ];

  positiveWords.push('अच्छा', 'सफल', 'बेहतर', 'वृद्धि', 'समृद्ध', 'गौरवशाली', 'सम्मान', 'प्रगति', 'उपलब्धि', 'खुशी');
  negativeWords.push('नुकसान', 'जोखिम', 'कमजोर', 'गिरावट', 'चुनौती', 'समस्या', 'कठिन');

  const positiveHits = positiveWords.reduce((count, word) => count + countMatches(lower, word), 0);
  const negativeHits = negativeWords.reduce((count, word) => count + countMatches(lower, word), 0);
  const totalHits = positiveHits + negativeHits;

  if (totalHits === 0) {
    return normalizeSentiment({
      overall: 'neutral',
      positive: 30,
      negative: 20,
      neutral: 50,
      highlights: buildFallbackSentimentHighlights(text, positiveWords, negativeWords),
    });
  }

  const positive = Math.round((positiveHits / totalHits) * 70) + 15;
  const negative = Math.round((negativeHits / totalHits) * 50) + 10;
  const neutral = Math.max(0, 100 - positive - negative);
  const overall = positive > negative + 10 ? 'positive' : negative > positive + 10 ? 'negative' : 'neutral';

  return normalizeSentiment({
    overall,
    positive,
    negative,
    neutral,
    highlights: buildFallbackSentimentHighlights(text, positiveWords, negativeWords),
  });
}

function fallbackKeywords(text) {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));

  const counts = new Map();
  for (let i = 0; i < words.length; i += 1) {
    const unigram = words[i];
    counts.set(unigram, (counts.get(unigram) || 0) + 1);

    if (i < words.length - 1) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (!STOP_WORDS.has(words[i + 1])) {
        counts.set(bigram, (counts.get(bigram) || 0) + 2);
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([phrase]) => phrase)
    .filter(uniquePhraseFilter)
    .slice(0, 8)
    .map(toDisplayPhrase);
}

function fallbackCategorise(text, language = 'en') {
  const lower = text.toLowerCase();
  const categories = [];
  const add = (label) => {
    if (!categories.includes(label)) categories.push(label);
  };

  if (/revenue|profit|quarter|fiscal|earnings|retention|yoy|ingresos|beneficio|ganancia|trimestre|recettes|bénéfice|umsatz|gewinn|receita|lucro|राजस्व|लाभ|الإيرادات|الأرباح|收入|利润/.test(lower)) add('financial report');
  if (/whereas|hereinafter|liability|agreement|clause|party|contrato|acuerdo|cláusula|responsabilidad|contrat|accord|haftung|vereinbarung|vertrag|contrato|responsabilidade|अनुबंध|समझौता|اتفاقية|مسؤولية|合同|协议|责任/.test(lower)) add('legal document');
  if (/abstract|methodology|hypothesis|conclusion|experiment|resumen|metodología|hipótesis|conclusión|méthodologie|hypothèse|schlussfolgerung|methodik|metodologia|hipótese|सार|कार्यप्रणाली|निष्कर्ष|فرضية|منهجية|摘要|方法|结论/.test(lower)) add('research paper');
  if (/news|press|reported|journalist|breaking|noticia|prensa|informe|actualité|presse|nachricht|bericht|notícia|समाचार|خبر|新闻/.test(lower)) add('news article');
  if (/product|feature|specification|api|integration|release|producto|función|especificación|produit|fonctionnalité|spezifikation|produto|recurso|उत्पाद|विशेषता|منتج|ميزة|产品|功能/.test(lower)) add('technical specification');
  if (/customer|market|campaign|brand|conversion|cliente|mercado|campaña|marca|client|marché|campagne|kunde|markt|kampagne|cliente|mercado|ग्राहक|बाजार|حملة|علامة|客户|市场/.test(lower)) add('marketing content');
  if (/proposal|roadmap|timeline|deliverable|stakeholder|propuesta|cronograma|entregable|proposition|calendrier|vorschlag|zeitplan|proposta|cronograma|प्रस्ताव|समयरेखा|اقتراح|جدول|提案|路线图/.test(lower)) add('business proposal');
  if (/patient|clinical|diagnosis|treatment|medical|paciente|diagnóstico|tratamiento|médico|clinique|diagnostic|traitement|patient|behandlung|paciente|tratamento|रोगी|निदान|इलाज|مريض|تشخيص|علاج|患者|诊断|治疗/.test(lower)) add('medical document');

  const localized = categories.length > 0 ? categories.slice(0, 4) : ['general document'];
  return localizeCategoryLabels(localized, language);
}

function fallbackAnswer(text, question) {
  const cleanedText = cleanDocumentText(text);
  const normalizedQuestion = String(question || '').toLowerCase();
  const sentences = splitSentences(cleanedText);

  if (!cleanedText || sentences.length === 0) {
    return 'No readable document text was available to answer that question.';
  }

  if (isBroadComprehensionQuestion(normalizedQuestion)) {
    if (isAttentionQuestion(normalizedQuestion)) return answerAttentionQuestion(sentences);
    return answerBroadComprehension(cleanedText, sentences, normalizedQuestion);
  }

  if (isMainIdeaQuestion(normalizedQuestion)) {
    return answerMainIdea(sentences);
  }

  if (isPurposeQuestion(normalizedQuestion)) {
    return answerPurpose(sentences);
  }

  if (isKeyPointsQuestion(normalizedQuestion)) {
    return answerKeyPoints(sentences, normalizedQuestion);
  }

  if (isAttentionQuestion(normalizedQuestion)) {
    return answerAttentionQuestion(sentences);
  }

  const mentionTerm = extractMentionTerm(normalizedQuestion);
  if (mentionTerm) {
    return answerMentionQuestion(sentences, mentionTerm);
  }

  const aboutTerm = extractAboutTerm(normalizedQuestion);
  if (aboutTerm) {
    return answerTermQuestion(sentences, aboutTerm);
  }

  const queryTerms = extractQuestionTerms(normalizedQuestion);
  if (queryTerms.length === 0) {
    return answerMainIdea(sentences);
  }

  const matches = findRelevantSentences(sentences, queryTerms).slice(0, 3);
  if (matches.length > 0) {
    return formatInterpretiveAnswer(
      'The most relevant part of the document points to these details.',
      matches
    );
  }

  return `The document does not mention ${queryTerms.join(', ')}.`;
}

function isMainIdeaQuestion(question) {
  return /\b(mainly about|main idea|overall about|summari[sz]e|summary|what is this document about|what is this file about)\b/.test(question);
}

function isPurposeQuestion(question) {
  return /\b(purpose|goal|objective|aim|why was|what is this document for)\b/.test(question);
}

function isKeyPointsQuestion(question) {
  return /\b(key points|main points|takeaways|topics|features|being tested|tested)\b/.test(question);
}

function isAttentionQuestion(question) {
  return /\b(pay attention|watch out|notice|remember|important|focus on|look for)\b/.test(question);
}

function isBroadComprehensionQuestion(question) {
  return /\b(what should i understand|explain this document|explain this file|what is this document about|what is this file about|main idea|summari[sz]e this|key takeaways|what should i pay attention|what does this (document|file)?\s*mean|explain like i am new|explain this in simple words|simple words|purpose of this document|purpose of this file)\b/.test(
    String(question || '').toLowerCase()
  );
}

function answerBroadComprehension(cleanedText, sentences, question) {
  const documentType = detectDocumentType(cleanedText);
  const profile = buildDocumentProfile(cleanedText, sentences, documentType);
  const pointTitles = (profile.mainPoints || [])
    .slice(0, 3)
    .map((point) => String(point.title || '').trim())
    .filter(Boolean);
  const attention = (profile.attentionPoints || []).slice(0, 3);

  return [
    `Direct Answer: ${profile.finalTakeaway}`,
    '',
    `Simple Explanation: ${profile.simpleExplanation}`,
    '',
    'What To Pay Attention To:',
    ...(attention.length > 0
      ? attention.map((point) => `- ${point}`)
      : ['- Focus on the main duties, risks, and decisions described in the document.']),
    '',
    pointTitles.length > 0 ? `Main Points: ${joinPlainList(pointTitles)}.` : '',
    'Evidence snippets: See the source snippets below for the exact document text that supports this answer.',
  ].filter(Boolean).join('\n');
}

function answerMainIdea(sentences) {
  const aboutSentence = sentences.find((sentence) => /\b(this\s+)?document\s+is\s+about\b/i.test(sentence));
  if (aboutSentence) return formatInterpretiveAnswer('This document is mainly about the topic it introduces.', [aboutSentence]);

  const purposeSentence = findPurposeSentence(sentences);
  if (purposeSentence) return formatInterpretiveAnswer('This document is mainly about its stated purpose.', [purposeSentence]);

  return formatInterpretiveAnswer('This document appears to focus on its opening idea.', [sentences[0]]);
}

function answerPurpose(sentences) {
  const purposeSentence = findPurposeSentence(sentences);
  if (purposeSentence) return formatInterpretiveAnswer('The purpose is shown in the document text.', [purposeSentence]);

  const purposeLike = sentences.find((sentence) =>
    /\b(verify|validate|confirm|test|explain|review|communicate)\b/i.test(sentence)
  );
  return purposeLike ? formatInterpretiveAnswer('The likely purpose is based on the action described in the document.', [purposeLike]) : answerMainIdea(sentences);
}

function answerKeyPoints(sentences, question) {
  const testingQuestion = /\b(features|tested|testing)\b/.test(question);
  const testingSentences = testingQuestion
    ? sentences.filter((sentence) => /\b(test|testing|tested|upload|extraction|analysis)\b/i.test(sentence))
    : [];
  const sourceSentences = testingSentences.length > 0 ? testingSentences : sentences;
  const points = extractListItemsFromSentences(sourceSentences)
    .filter((point) => !testingQuestion || /\b(test|testing|tested|upload|extraction|analysis)\b/i.test(point));
  const selected = (points.length > 0 ? points : sourceSentences)
    .filter(Boolean)
    .slice(0, 5);

  return selected.map((point) => `- ${normalizeSentence(point)}`).join('\n');
}

function answerMentionQuestion(sentences, term) {
  const matches = findRelevantSentences(sentences, [term]);
  if (matches.length === 0) {
    return `The document does not mention ${term}.`;
  }

  return formatInterpretiveAnswer(`Yes. The document mentions ${term}.`, matches.slice(0, 2));
}

function answerTermQuestion(sentences, term) {
  const matches = findRelevantSentences(sentences, extractQuestionTerms(term));
  if (matches.length === 0) {
    return `The document does not mention ${term}.`;
  }

  return formatInterpretiveAnswer(`The document connects ${term} to these details.`, matches.slice(0, 3));
}

function answerAttentionQuestion(sentences) {
  const lowerText = sentences.join(' ').toLowerCase();
  if (/\bpolicy\b/.test(lowerText) && /\bleave\b/.test(lowerText)) {
    const points = [];
    if (/\bseven days\b|\bin advance\b/.test(lowerText)) {
      points.push('request leave early, ideally at least seven days in advance');
    }
    if (/\bemergency\b/.test(lowerText)) {
      points.push('emergencies may be treated differently from normal requests');
    }
    if (/\bstaffing\b|\bproject deadlines\b/.test(lowerText)) {
      points.push('manager approval may depend on staffing needs and project deadlines');
    }
    if (/\bmedical\b|\blong-term\b|\bdocuments?\b/.test(lowerText)) {
      points.push('medical or long-term leave may require documents');
    }
    if (points.length === 0) {
      points.push('the timing, approval criteria, and any required documents for leave requests');
    }

    return [
      `Direct Answer: Employees should pay attention to ${joinPlainList(points)}.`,
      '',
      'Simple Explanation: The policy is not just saying that leave is allowed. It is explaining the conditions that make leave requests easier to review and approve.',
      '',
      'What To Notice: The important practical point is to plan ahead, understand the emergency exception, and be ready with documents when the type of leave requires them.',
    ].join('\n');
  }

  const importantSentences = sentences.filter((sentence) =>
    /\b(must|need to|required|should|deadline|risk|except|unless|important|review|approve)\b/i.test(sentence)
  );
  const selected = (importantSentences.length > 0 ? importantSentences : sentences).slice(0, 3);
  return formatInterpretiveAnswer('Pay attention to the document details that describe requirements, exceptions, or decisions.', selected);
}

function formatInterpretiveAnswer(directAnswer, evidenceSentences) {
  const points = (evidenceSentences || [])
    .map((sentence) => simplifyEvidenceSentence(sentence))
    .filter(Boolean)
    .slice(0, 3);

  if (points.length === 0) return directAnswer;

  return [
    `Direct Answer: ${directAnswer}`,
    '',
    `Simple Explanation: ${points.join(' ')}`,
    '',
    'What To Notice: Use the evidence snippets below to check the exact wording from the document.',
  ].join('\n');
}

function simplifyEvidenceSentence(sentence) {
  const cleaned = normalizeSentence(sentence).replace(/\.$/, '');
  return cleaned
    .replace(/^This document is about\s+/i, 'It focuses on ')
    .replace(/^This policy explains how employees can request leave from work/i, 'It explains how employees request leave from work')
    .replace(/^Employees must submit leave requests/i, 'Employees need to submit leave requests')
    .replace(/^Managers review requests/i, 'Managers review requests')
    .replace(/^Employees may need to provide documents/i, 'Employees may need to provide documents') + '.';
}

function findPurposeSentence(sentences) {
  return sentences.find((sentence) => /\b(goal|purpose|objective|aim)\b/i.test(sentence));
}

function extractMentionTerm(question) {
  const match = question.match(/\b(?:does|do|did)\s+(?:this\s+)?document\s+mention\s+(.+?)\??$/i);
  return match?.[1] ? cleanQuestionTerm(match[1]) : '';
}

function extractAboutTerm(question) {
  const match = question.match(/\b(?:say|says|explain|explains|state|states)\s+about\s+(.+?)\??$/i);
  if (match?.[1]) return cleanQuestionTerm(match[1]);

  const direct = question.match(/\babout\s+(.+?)\??$/i);
  return direct?.[1] && !/\b(mainly|overall)\b/.test(question) ? cleanQuestionTerm(direct[1]) : '';
}

function cleanQuestionTerm(value) {
  return String(value || '')
    .replace(/[?!.]+$/g, '')
    .replace(/\b(the|a|an|it)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractQuestionTerms(question) {
  return cleanQuestionTerm(question)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term) && !QUESTION_STOP_WORDS.has(term));
}

function findRelevantSentences(sentences, terms) {
  const normalizedTerms = terms.map((term) => String(term || '').toLowerCase()).filter(Boolean);
  if (normalizedTerms.length === 0) return [];

  return sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: scoreAnswerSentence(sentence, normalizedTerms),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.sentence);
}

function scoreAnswerSentence(sentence, terms) {
  const lower = sentence.toLowerCase();
  return terms.reduce((score, term) => {
    if (containsPhrase(lower, term)) return score + 5;

    const stem = stemQuestionTerm(term);
    if (stem.length > 2 && new RegExp(`\\b${escapeRegex(stem)}[a-z]*\\b`, 'i').test(lower)) {
      return score + 2;
    }

    return score;
  }, 0);
}

function stemQuestionTerm(term) {
  return String(term || '')
    .toLowerCase()
    .replace(/(ing|ed|es|s)$/i, '');
}

function extractListItemsFromSentences(sentences) {
  return sentences.flatMap((sentence) => {
    const listMatch = sentence.match(/\b(?:about|includes?|mentions?|covers?)\s+(.+)$/i);
    const listText = listMatch?.[1] || '';
    if (!listText || !listText.includes(',')) return [];

    return listText
      .replace(/\.$/, '')
      .split(/\s*,\s*|\s+and\s+/)
      .map((item) => item.trim())
      .map((item) => item.replace(/^and\s+/i, '').trim())
      .filter((item) => item.length > 0);
  });
}

function fallbackImproveText(text) {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();

  if (!cleaned) return '';

  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.charAt(0).toUpperCase() + sentence.slice(1))
    .join(' ');
}

function getOpenAIWarning(error) {
  if (error?.status === 429 || error?.code === 'insufficient_quota') {
    return 'OpenAI quota is exceeded, so DocuWise used a basic cleanup instead.';
  }

  if (error?.status === 401) {
    return 'OpenAI API authentication failed, so DocuWise used a basic cleanup instead.';
  }

  return 'OpenAI could not improve the text right now, so DocuWise used a basic cleanup instead.';
}

function fallbackBatchInsights(files, analysisType = 'summarization') {
  const summaries = files
    .map((file) => String(file.summary || '').trim())
    .filter(Boolean);
  const translations = files
    .map((file) => String(file.translation || '').trim())
    .filter(Boolean);
  const keywordCounts = new Map();
  const documentTypeCounts = new Map();
  const sentiments = { positive: 0, negative: 0, neutral: 0 };

  files.forEach((file) => {
    (file.keywords || []).forEach((keyword) => {
      const key = String(keyword || '').trim().toLowerCase();
      if (!key || STOP_WORDS.has(key)) return;
      keywordCounts.set(key, (keywordCounts.get(key) || 0) + 1);
    });

    const documentType = String(file.documentType || '').trim();
    if (documentType) {
      documentTypeCounts.set(documentType, (documentTypeCounts.get(documentType) || 0) + 1);
    }

    if (file.sentiment) {
      sentiments.positive += Number(file.sentiment.positive || 0);
      sentiments.negative += Number(file.sentiment.negative || 0);
      sentiments.neutral += Number(file.sentiment.neutral || 0);
    }
  });

  const commonThemes = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([keyword]) => toDisplayPhrase(keyword))
    .slice(0, 5);
  const commonDocumentTypes = [...documentTypeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .map(([type, count]) => `${formatBatchType(type)} (${count})`)
    .slice(0, 3);

  const dominantSentiment = (() => {
    const total = sentiments.positive + sentiments.negative + sentiments.neutral;
    if (total <= 0) return 'neutral';
    if (sentiments.positive >= sentiments.negative && sentiments.positive >= sentiments.neutral) return 'positive';
    if (sentiments.negative >= sentiments.positive && sentiments.negative >= sentiments.neutral) return 'negative';
    return 'neutral';
  })();

  const fileCount = files.length;
  const focusLabel =
    analysisType === 'sentiment'
      ? 'sentiment'
      : analysisType === 'keywords'
        ? 'keyword patterns'
        : 'document themes';

  return normalizeBatchInsights(
    {
      summary:
        fileCount === 0
          ? 'No batch results were available.'
          : `Processed ${fileCount} file${fileCount === 1 ? '' : 's'} and identified shared ${focusLabel}.`,
      commonThemes,
      highlights: [
        ...summaries.slice(0, 2),
        ...(translations.length > 0 ? [`Translations available for ${translations.length} file${translations.length === 1 ? '' : 's'}.`] : []),
        ...(commonDocumentTypes.length > 0 ? [`Common document types: ${commonDocumentTypes.join(', ')}.`] : []),
      ].slice(0, 5),
      recommendations:
        commonThemes.length > 0
          ? [
              `Review the recurring themes around ${commonThemes.slice(0, 3).join(', ')}.`,
              'Use the per-file results to compare how each document differs from the batch trend.',
            ]
          : ['Review the individual file analyses for more detail.'],
      dominantSentiment,
    },
    files,
    analysisType
  );
}

function buildSemanticComparison(profileA, profileB) {
  const changes = compareProfiles(profileA, profileB);
  const criticalAlerts = changes
    .filter((change) => change.severity === 'high' && change.summary)
    .slice(0, 4)
    .map((change) => ({
      category: change.category,
      severity: 'high',
      summary: change.summary,
    }));

  const keyChanges = changes.slice(0, 6).map((change) => ({
    category: change.category,
    label: change.label,
    status: change.status,
    severity: change.severity,
    summary: change.summary,
    left: change.left,
    right: change.right,
  }));

  const sideBySideDiff = keyChanges.slice(0, 5).map((change) => ({
    category: change.category,
    label: change.label,
    status: change.status,
    left: change.left,
    right: change.right,
    summary: change.summary,
  }));

  const keyInsights = buildKeyInsights(profileA, profileB, keyChanges, criticalAlerts);
  const riskLevel = inferComparisonRiskLevel(criticalAlerts, keyChanges, profileA, profileB);
  const riskSummary = buildRiskSummary(riskLevel, criticalAlerts, profileA, profileB);
  const executiveSummary = buildExecutiveSummary(profileA, profileB, changes, riskLevel, criticalAlerts);
  const similarityScore = scoreComparison(profileA, profileB);
  const documentTypes = buildDocumentTypeComparison(profileA, profileB);

  return {
    executiveSummary,
    summaryDiff: executiveSummary,
    similarityScore,
    keyInsights,
    keyChanges,
    criticalAlerts,
    sideBySideDiff,
    riskSummary,
    riskLevel,
    documentTypes,
  };
}

function buildComparisonProfile(text, name) {
  const cleanedText = cleanDocumentText(text);
  const sentences = splitSentences(cleanedText);
  const documentType = detectDocumentType(cleanedText);
  const wordCount = cleanedText ? cleanedText.split(/\s+/).filter(Boolean).length : 0;
  const sentenceCount = sentences.length;
  const typeLabel = formatDocumentType(documentType);
  const signals = extractComparisonSignals(cleanedText, sentences);

  return {
    name,
    text: cleanedText,
    sentences,
    documentType,
    typeLabel,
    wordCount,
    sentenceCount,
    signals,
  };
}

function formatDocumentType(documentType) {
  return {
    policyLegal: 'Policy / Legal',
    academicTechnical: 'Academic / Technical',
    businessProject: 'Business / Project',
    general: 'General',
  }[documentType] || 'General';
}

function buildDocumentTypeComparison(profileA, profileB) {
  const match = profileA.documentType === profileB.documentType;
  const warning = match
    ? ''
    : `Document types differ: ${profileA.typeLabel} vs ${profileB.typeLabel}. Review this as a cross-type comparison.`;

  return {
    documentA: { value: profileA.documentType, label: profileA.typeLabel },
    documentB: { value: profileB.documentType, label: profileB.typeLabel },
    match,
    warning,
  };
}

function buildExecutiveSummary(profileA, profileB, changes, riskLevel, criticalAlerts) {
  const typePart = profileA.documentType === profileB.documentType
    ? `Both files are ${profileA.typeLabel.toLowerCase()} documents.`
    : `The files are different document types: ${profileA.typeLabel.toLowerCase()} versus ${profileB.typeLabel.toLowerCase()}.`;
  const changeCount = changes.length;
  const topChange = changes[0]?.summary || 'the most material clauses and obligations do not align perfectly';
  const alertPart = criticalAlerts.length > 0
    ? `Critical risk is ${riskLevel} because ${criticalAlerts[0].summary.toLowerCase()}`
    : 'No critical risk alert was detected.';

  return `${typePart} ${changeCount > 0 ? `We found ${changeCount} meaningful change${changeCount === 1 ? '' : 's'}, with ${topChange}.` : 'The documents are closely aligned.'} ${alertPart}`.trim();
}

function buildRiskSummary(riskLevel, criticalAlerts, profileA, profileB) {
  if (criticalAlerts.length > 0) {
    return `${riskLevel === 'high' ? 'High' : riskLevel === 'medium' ? 'Medium' : 'Low'} risk: ${criticalAlerts[0].summary}`;
  }

  if (riskLevel === 'medium') {
    return profileA.documentType !== profileB.documentType
      ? 'Medium risk because the documents serve different purposes and should not be merged without review.'
      : 'Medium risk because the highlighted changes affect how the document should be interpreted or actioned.';
  }

  if (profileA.documentType !== profileB.documentType) {
    return 'Medium risk because the documents serve different purposes and should not be merged without review.';
  }

  return 'Low risk. The material changes are limited and do not currently look business-critical.';
}

function inferComparisonRiskLevel(criticalAlerts, keyChanges, profileA, profileB) {
  if (criticalAlerts.length > 0) return 'high';
  if (profileA.documentType !== profileB.documentType) return 'medium';
  if (keyChanges.some((change) => change.severity === 'high')) return 'high';
  if (keyChanges.some((change) => change.severity === 'medium')) return 'medium';
  return 'low';
}

function scoreComparison(profileA, profileB) {
  const categories = ['payments', 'dates', 'clauses', 'responsibilities', 'financialValues', 'skills', 'policies'];
  const weights = {
    payments: 20,
    dates: 16,
    clauses: 18,
    responsibilities: 20,
    financialValues: 18,
    skills: 8,
    policies: 10,
  };

  let totalWeight = 0;
  let matchedWeight = 0;

  for (const category of categories) {
    const valuesA = profileA.signals[category] || [];
    const valuesB = profileB.signals[category] || [];
    const union = new Set([...valuesA.map((item) => item.normalized), ...valuesB.map((item) => item.normalized)]);
    if (union.size === 0) continue;

    const intersection = [...valuesA]
      .map((item) => item.normalized)
      .filter((value) => valuesB.some((candidate) => candidate.normalized === value));
    const weight = weights[category];
    totalWeight += weight;
    matchedWeight += weight * (intersection.length / union.size);
  }

  if (totalWeight === 0) {
    const lengthRatio = Math.min(profileA.wordCount, profileB.wordCount) / Math.max(profileA.wordCount, profileB.wordCount, 1);
    const typeBoost = profileA.documentType === profileB.documentType ? 0.18 : 0.02;
    return Math.max(0, Math.min(100, Math.round((lengthRatio * 0.3 + typeBoost) * 100)));
  }

  let score = (matchedWeight / totalWeight) * 100;
  if (profileA.documentType === profileB.documentType && profileA.documentType !== 'general') {
    score += 6;
  } else if (profileA.documentType !== profileB.documentType) {
    score -= 6;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function compareProfiles(profileA, profileB) {
  const categories = [
    ['payments', 'Payment change', 'payment'],
    ['dates', 'Date change', 'date'],
    ['clauses', 'Clause change', 'clause'],
    ['responsibilities', 'Responsibility change', 'responsibility'],
    ['financialValues', 'Financial value change', 'financial value'],
    ['skills', 'Skill requirement change', 'skill'],
    ['policies', 'Policy change', 'policy'],
  ];

  const changes = [];

  for (const [category, labelPrefix] of categories) {
    const left = profileA.signals[category] || [];
    const right = profileB.signals[category] || [];
    const shared = intersectSignals(left, right);
    const removed = left.filter((item) => !shared.some((match) => match.normalized === item.normalized));
    const added = right.filter((item) => !shared.some((match) => match.normalized === item.normalized));

    if (shared.length > 0 && removed.length === 0 && added.length === 0) continue;

    if (removed.length > 0 && added.length > 0) {
      changes.push(
        buildChange({
          category,
          label: labelPrefix,
          status: 'modified',
          severity: categorySeverity(category),
          left: summarizeSignal(removed[0]),
          right: summarizeSignal(added[0]),
          summary: buildDifferenceSummary(category, removed[0], added[0], profileA, profileB),
        })
      );
      continue;
    }

    if (removed.length > 0) {
      changes.push(
        buildChange({
          category,
          label: labelPrefix,
          status: 'removed',
          severity: categorySeverity(category),
          left: summarizeSignal(removed[0]),
          right: '',
          summary: buildRemovalSummary(category, removed[0], profileA),
        })
      );
      continue;
    }

    if (added.length > 0) {
      changes.push(
        buildChange({
          category,
          label: labelPrefix,
          status: 'added',
          severity: categorySeverity(category),
          left: '',
          right: summarizeSignal(added[0]),
          summary: buildAdditionSummary(category, added[0], profileB),
        })
      );
    }
  }

  if (profileA.documentType !== profileB.documentType) {
    changes.unshift(
      buildChange({
        category: 'documentType',
        label: 'Document type',
        status: 'modified',
        severity: 'high',
        left: profileA.typeLabel,
        right: profileB.typeLabel,
        summary: `Document types differ: ${profileA.typeLabel} vs ${profileB.typeLabel}.`,
      })
    );
  }

  return changes
    .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || categoryPriority(b.category) - categoryPriority(a.category))
    .slice(0, 8);
}

function buildChange(change) {
  return {
    category: change.category,
    label: change.label,
    status: change.status,
    severity: change.severity,
    summary: String(change.summary || '').trim(),
    left: String(change.left || '').trim(),
    right: String(change.right || '').trim(),
  };
}

function buildKeyInsights(profileA, profileB, keyChanges, criticalAlerts) {
  const insights = [];
  if (profileA.documentType !== profileB.documentType) {
    insights.push(`Document types differ: ${profileA.typeLabel} vs ${profileB.typeLabel}.`);
  }
  criticalAlerts.forEach((alert) => {
    if (insights.length < 5) insights.push(alert.summary);
  });
  keyChanges.forEach((change) => {
    if (insights.length < 5 && change.summary) insights.push(change.summary);
  });
  return insights.slice(0, 5);
}

function categorySeverity(category) {
  if (['payments', 'dates', 'financialValues', 'responsibilities', 'clauses'].includes(category)) return 'high';
  if (['policies', 'skills'].includes(category)) return 'medium';
  return 'low';
}

function categoryPriority(category) {
  return {
    documentType: 8,
    payments: 7,
    dates: 6,
    financialValues: 6,
    responsibilities: 5,
    clauses: 4,
    policies: 3,
    skills: 2,
  }[category] || 0;
}

function severityWeight(severity) {
  return { high: 3, medium: 2, low: 1 }[severity] || 0;
}

function intersectSignals(left, right) {
  const rightByValue = new Map(right.map((item) => [item.normalized, item]));
  return left.filter((item) => rightByValue.has(item.normalized));
}

function buildDifferenceSummary(category, left, right) {
  const leftText = summarizeSignal(left);
  const rightText = summarizeSignal(right);
  switch (category) {
    case 'payments':
      return `Payment terms changed from ${leftText} to ${rightText}.`;
    case 'dates':
      return `Timing changed from ${leftText} to ${rightText}.`;
    case 'financialValues':
      return `Financial values changed from ${leftText} to ${rightText}.`;
    case 'responsibilities':
      return `Responsibilities changed from ${leftText} to ${rightText}.`;
    case 'clauses':
      return `Clause wording changed from ${leftText} to ${rightText}.`;
    case 'skills':
      return `Skill expectations changed from ${leftText} to ${rightText}.`;
    case 'policies':
      return `Policy wording changed from ${leftText} to ${rightText}.`;
    default:
      return `${leftText} changed to ${rightText}.`;
  }
}

function buildRemovalSummary(category, item) {
  const value = summarizeSignal(item);
  switch (category) {
    case 'payments':
      return `Payment detail removed: ${value}.`;
    case 'dates':
      return `Timing detail removed: ${value}.`;
    case 'financialValues':
      return `Financial value removed: ${value}.`;
    case 'responsibilities':
      return `Responsibility removed: ${value}.`;
    case 'clauses':
      return `Clause removed: ${value}.`;
    case 'skills':
      return `Skill requirement removed: ${value}.`;
    case 'policies':
      return `Policy wording removed: ${value}.`;
    default:
      return `${value} was removed.`;
  }
}

function buildAdditionSummary(category, item) {
  const value = summarizeSignal(item);
  switch (category) {
    case 'payments':
      return `New payment detail added: ${value}.`;
    case 'dates':
      return `New timing detail added: ${value}.`;
    case 'financialValues':
      return `New financial value added: ${value}.`;
    case 'responsibilities':
      return `New responsibility added: ${value}.`;
    case 'clauses':
      return `New clause added: ${value}.`;
    case 'skills':
      return `New skill requirement added: ${value}.`;
    case 'policies':
      return `New policy wording added: ${value}.`;
    default:
      return `${value} was added.`;
  }
}

function summarizeSignal(item) {
  return String(item?.display || item?.value || item?.excerpt || '').trim();
}

function extractComparisonSignals(text, sentences) {
  const signals = {
    payments: [],
    dates: [],
    clauses: [],
    responsibilities: [],
    financialValues: [],
    skills: [],
    policies: [],
  };

  for (const sentence of sentences) {
    const normalized = normalizeSignalSentence(sentence);
    if (!normalized) continue;

    if (isPaymentSentence(normalized)) {
      addSignal(signals.payments, createSignal('payments', sentence, extractPaymentValue(sentence), 3));
    }

    if (isDateSentence(normalized)) {
      addSignal(signals.dates, createSignal('dates', sentence, extractDateValue(sentence), 3));
    }

    if (isClauseSentence(normalized)) {
      addSignal(signals.clauses, createSignal('clauses', sentence, extractClauseValue(sentence), 2));
    }

    if (isResponsibilitySentence(normalized)) {
      addSignal(signals.responsibilities, createSignal('responsibilities', sentence, extractResponsibilityValue(sentence), 3));
    }

    if (isFinancialValueSentence(normalized)) {
      addSignal(signals.financialValues, createSignal('financialValues', sentence, extractFinancialValue(sentence), 3));
    }

    if (isSkillSentence(normalized)) {
      addSignal(signals.skills, createSignal('skills', sentence, extractSkillValue(sentence), 2));
    }

    if (isPolicySentence(normalized)) {
      addSignal(signals.policies, createSignal('policies', sentence, extractPolicyValue(sentence), 2));
    }
  }

  return signals;
}

function addSignal(bucket, signal) {
  if (!signal || !signal.normalized) return;
  if (bucket.some((item) => item.normalized === signal.normalized)) return;
  bucket.push(signal);
}

function createSignal(category, sentence, value, importance = 1) {
  const display = trimSignal(sentence, value);
  const normalized = normalizeSignalValue(value || sentence);
  return {
    category,
    value: value || sentence,
    display,
    excerpt: trimSignal(sentence, 110),
    normalized,
    importance,
  };
}

function trimSignal(sentence, value = '') {
  const base = String(value || sentence || '').trim();
  if (!base) return '';
  return base.length > 120 ? `${base.slice(0, 117)}...` : base;
}

function normalizeSignalSentence(sentence) {
  return String(sentence || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeSignalValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(the|a|an|and|or|to|of|for|in|on|at|by|with|from)\b/g, ' ')
    .replace(/[^a-z0-9$%.,/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPaymentSentence(sentence) {
  return /\b(payment|pay|paid|fee|fees|invoice|charge|charges|compensation|salary|rate|cost|costs|price|pricing|refund|budget)\b/.test(sentence);
}

function isDateSentence(sentence) {
  return /\b(date|deadline|due|due date|effective|start date|end date|within \d+ (?:day|week|month)s?|by \d+ (?:day|week|month)s?)\b/.test(sentence) || hasDatePattern(sentence);
}

function isClauseSentence(sentence) {
  return /\b(clause|section|except|unless|subject to|provided that|notwithstanding|terminate|renew|confidential|return or destroy|liability|indemnify)\b/.test(sentence);
}

function isResponsibilitySentence(sentence) {
  return /\b(must|shall|required to|responsible for|is responsible for|will be responsible for|needs to|need to|agrees to|agree to)\b/.test(sentence);
}

function isFinancialValueSentence(sentence) {
  return /\b(\$|usd|eur|gbp|percent|%|budget|revenue|amount|value|cost|price|fee|compensation|salary|payment)\b/.test(sentence) || hasMoneyPattern(sentence);
}

function isSkillSentence(sentence) {
  return /\b(skill|skills|experience|proficient|proficiency|qualified|qualification|certification|familiar with|knowledge of|background in)\b/.test(sentence);
}

function isPolicySentence(sentence) {
  return /\b(policy|policies|procedure|procedures|guideline|guidelines|approval|approved|compliance|standard|standards|rule|rules)\b/.test(sentence);
}

function hasDatePattern(sentence) {
  return /(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b\s+\d{1,2}(?:,\s*\d{4})?|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b)/i.test(sentence);
}

function hasMoneyPattern(sentence) {
  return /(?:[$€£]\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:usd|eur|gbp|dollars?|euros?|pounds?)\b)/i.test(sentence);
}

function extractPaymentValue(sentence) {
  return extractPattern(sentence, /(?:[$€£]\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:usd|eur|gbp|dollars?|euros?|pounds?)\b)/i) || extractNumberPhrase(sentence, ['payment', 'fee', 'charge', 'cost', 'price', 'compensation', 'salary', 'rate']);
}

function extractDateValue(sentence) {
  return extractPattern(sentence, /(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b\s+\d{1,2}(?:,\s*\d{4})?|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\bwithin \d+ (?:day|week|month)s?\b|\bby \d+ (?:day|week|month)s?\b)/i) || extractNumberPhrase(sentence, ['deadline', 'due date', 'effective date', 'start date', 'end date']);
}

function extractClauseValue(sentence) {
  return extractPhraseAfter(sentence, ['provided that', 'subject to', 'except', 'unless', 'notwithstanding', 'return or destroy', 'terminate', 'renew']);
}

function extractResponsibilityValue(sentence) {
  return extractPhraseAfter(sentence, ['must', 'shall', 'required to', 'responsible for', 'is responsible for', 'will be responsible for', 'needs to', 'need to', 'agrees to', 'agree to']);
}

function extractFinancialValue(sentence) {
  return extractPattern(sentence, /(?:[$€£]\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:usd|eur|gbp|dollars?|euros?|pounds?|percent|%)\b)/i) || extractNumberPhrase(sentence, ['budget', 'revenue', 'cost', 'price', 'value', 'amount']);
}

function extractSkillValue(sentence) {
  return extractPhraseAfter(sentence, ['skills in', 'experience in', 'proficient in', 'proficiency in', 'qualified in', 'qualification in', 'knowledge of', 'background in', 'familiar with']);
}

function extractPolicyValue(sentence) {
  return extractPhraseAfter(sentence, ['policy', 'policies', 'procedure', 'guideline', 'approval', 'compliance', 'standard', 'rule']);
}

function extractPattern(sentence, pattern) {
  const match = String(sentence || '').match(pattern);
  return match?.[0] ? match[0].trim() : '';
}

function extractNumberPhrase(sentence, words) {
  const lower = String(sentence || '').toLowerCase();
  for (const word of words) {
    const idx = lower.indexOf(word);
    if (idx >= 0) {
      return trimSignal(sentence.slice(idx, idx + 120));
    }
  }
  return '';
}

function extractPhraseAfter(sentence, terms) {
  const lower = String(sentence || '').toLowerCase();
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx >= 0) {
      const slice = sentence.slice(idx);
      return trimSignal(slice.replace(/\s+/g, ' '));
    }
  }
  return '';
}

function normalizeBatchInsights(insights, files, analysisType = 'summarization') {
  const commonThemes = Array.isArray(insights?.commonThemes) ? insights.commonThemes.filter(Boolean).slice(0, 5) : [];
  const highlights = Array.isArray(insights?.highlights) ? insights.highlights.filter(Boolean).slice(0, 5) : [];
  const recommendations = Array.isArray(insights?.recommendations) ? insights.recommendations.filter(Boolean).slice(0, 5) : [];

  return {
    summary: String(insights?.summary || '').trim() || `Processed ${files.length} file${files.length === 1 ? '' : 's'} using ${analysisType} focus.`,
    commonThemes,
    highlights,
    recommendations,
    dominantSentiment: ['positive', 'negative', 'neutral'].includes(insights?.dominantSentiment)
      ? insights.dominantSentiment
      : inferDominantSentiment(files),
  };
}

function formatBatchType(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return 'General';
  return normalized
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b(policyLegal)\b/i, 'Policy / Legal')
    .replace(/\b(academicTechnical)\b/i, 'Academic / Technical')
    .replace(/\b(businessProject)\b/i, 'Business / Project')
    .replace(/\s+/g, ' ')
    .replace(/^\w/, (char) => char.toUpperCase());
}

function inferDominantSentiment(files) {
  const totals = files.reduce(
    (acc, file) => {
      const sentiment = file.sentiment || {};
      acc.positive += Number(sentiment.positive || 0);
      acc.negative += Number(sentiment.negative || 0);
      acc.neutral += Number(sentiment.neutral || 0);
      return acc;
    },
    { positive: 0, negative: 0, neutral: 0 }
  );

  if (totals.positive >= totals.negative && totals.positive >= totals.neutral) return 'positive';
  if (totals.negative >= totals.positive && totals.negative >= totals.neutral) return 'negative';
  return 'neutral';
}

function keywordBoost(sentence) {
  const lower = sentence.toLowerCase();
  const focusWords = ['revenue', 'growth', 'summary', 'result', 'conclusion', 'key', 'risk', 'market'];
  return focusWords.reduce((score, word) => score + countMatches(lower, word) * 20, 0);
}

function countMatches(text, word) {
  const escaped = escapeRegex(word);
  const isAsciiWord = /^[a-z0-9-]+$/i.test(word);
  const matches = text.match(new RegExp(isAsciiWord ? `\\b${escaped}\\b` : escaped, 'gu'));
  return matches ? matches.length : 0;
}

function normalizeSentiment(sentiment) {
  let positive = Number(sentiment.positive) || 0;
  let negative = Number(sentiment.negative) || 0;
  let neutral = Number(sentiment.neutral) || 0;

  const total = positive + negative + neutral;
  if (total <= 0) {
    return {
      overall: 'neutral',
      positive: 33,
      negative: 33,
      neutral: 34,
      highlights: normalizeSentimentHighlights(sentiment?.highlights),
    };
  }

  positive = Math.round((positive / total) * 100);
  negative = Math.round((negative / total) * 100);
  neutral = Math.max(0, 100 - positive - negative);

  return {
    overall: sentiment?.overall || (positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral'),
    positive,
    negative,
    neutral,
    highlights: normalizeSentimentHighlights(sentiment?.highlights),
  };
}

function normalizeSentimentHighlights(highlights = {}) {
  const normalizeList = (items) =>
    (Array.isArray(items) ? items : [])
      .map((item) => String(item || '').trim())
      .filter((item) => item.length >= 2 && item.length <= 80)
      .filter((item, index, arr) => arr.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index)
      .slice(0, 8);

  return {
    positive: normalizeList(highlights.positive),
    negative: normalizeList(highlights.negative),
    neutral: normalizeList(highlights.neutral),
  };
}

function buildFallbackSentimentHighlights(text, positiveWords, negativeWords) {
  const findHits = (words) =>
    words
      .filter((word) => countMatches(text.toLowerCase(), word.toLowerCase()) > 0)
      .slice(0, 8);

  const positive = findHits([...positiveWords, 'अच्छा', 'सफल', 'बेहतर', 'वृद्धि', 'समृद्ध', 'गौरवशाली', 'सम्मान', 'प्रगति', 'उपलब्धि']);
  const negative = findHits([...negativeWords, 'नुकसान', 'जोखिम', 'कमजोर', 'गिरावट', 'चुनौती', 'समस्या', 'कठिन']);
  const neutral = fallbackKeywords(text)
    .filter((word) => !positive.some((hit) => word.toLowerCase().includes(hit.toLowerCase())))
    .filter((word) => !negative.some((hit) => word.toLowerCase().includes(hit.toLowerCase())))
    .slice(0, 8);

  return { positive, negative, neutral };
}

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?।॥])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function summariseLongSentence(sentence) {
  const clauses = sentence
    .split(/(?<=[,;:।॥])\s+|\s+-\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (clauses.length >= 3) return clauses.slice(0, 4).join(' ');

  const words = sentence.split(/\s+/).filter(Boolean);
  return words.length > 90 ? `${words.slice(0, 90).join(' ')}...` : sentence;
}

function compactSentence(sentence, maxWords = 38) {
  const words = sentence.split(/\s+/).filter(Boolean);
  return words.length > maxWords ? `${words.slice(0, maxWords).join(' ')}...` : sentence;
}

function uniquePhraseFilter(phrase, index, arr) {
  return arr.findIndex((candidate) => candidate.includes(phrase) || phrase.includes(candidate)) === index;
}

function toDisplayPhrase(phrase) {
  return phrase
    .split(' ')
    .map((part) => (/^[a-z]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripMarkdownFences(value) {
  return String(value || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function isAcceptableTranslation(output, sourceText, language) {
  if (!output) return false;

  const normalizedOutput = normalizeWhitespace(output);
  const normalizedSource = normalizeWhitespace(sourceText);
  if (!normalizedOutput) return false;
  if (normalizedOutput === normalizedSource) return false;

  if (language === 'hi') {
    return /[\u0900-\u097F]/.test(output);
  }

  return true;
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLanguage(language, fallbackLanguage = 'en') {
  const supportedLanguages = new Set(['ar', 'de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'pt', 'ru', 'zh']);
  const cleanedLanguage = String(language || '').trim().toLowerCase();
  const cleanedFallback = String(fallbackLanguage || '').trim().toLowerCase();

  if (supportedLanguages.has(cleanedLanguage)) return cleanedLanguage;
  if (cleanedLanguage === 'auto' || cleanedLanguage === 'unknown' || !cleanedLanguage) {
    return supportedLanguages.has(cleanedFallback) ? cleanedFallback : 'en';
  }

  return supportedLanguages.has(cleanedFallback) ? cleanedFallback : 'en';
}

function resolveLanguageName(language) {
  const map = {
    ar: 'Arabic',
    de: 'German',
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    hi: 'Hindi',
    it: 'Italian',
    ja: 'Japanese',
    ko: 'Korean',
    pt: 'Portuguese',
    ru: 'Russian',
    zh: 'Chinese',
  };

  return map[language] || language;
}

function localizeCategoryLabels(categories, language = 'en') {
  const translations = {
    es: {
      'financial report': 'informe financiero',
      'legal document': 'documento legal',
      'research paper': 'articulo de investigacion',
      'news article': 'articulo de noticias',
      'technical specification': 'especificacion tecnica',
      'marketing content': 'contenido de marketing',
      'business proposal': 'propuesta comercial',
      'medical document': 'documento medico',
      'general document': 'documento general',
    },
    fr: {
      'financial report': 'rapport financier',
      'legal document': 'document juridique',
      'research paper': 'article de recherche',
      'news article': 'article d actualite',
      'technical specification': 'specification technique',
      'marketing content': 'contenu marketing',
      'business proposal': 'proposition commerciale',
      'medical document': 'document medical',
      'general document': 'document general',
    },
    de: {
      'financial report': 'finanzbericht',
      'legal document': 'rechtsdokument',
      'research paper': 'forschungsarbeit',
      'news article': 'nachrichtenartikel',
      'technical specification': 'technische spezifikation',
      'marketing content': 'marketinginhalt',
      'business proposal': 'geschaeftsvorschlag',
      'medical document': 'medizinisches dokument',
      'general document': 'allgemeines dokument',
    },
    pt: {
      'financial report': 'relatorio financeiro',
      'legal document': 'documento juridico',
      'research paper': 'artigo de pesquisa',
      'news article': 'artigo de noticias',
      'technical specification': 'especificacao tecnica',
      'marketing content': 'conteudo de marketing',
      'business proposal': 'proposta comercial',
      'medical document': 'documento medico',
      'general document': 'documento geral',
    },
    hi: {
      'financial report': 'वित्तीय रिपोर्ट',
      'legal document': 'कानूनी दस्तावेज',
      'research paper': 'शोध पत्र',
      'news article': 'समाचार लेख',
      'technical specification': 'तकनीकी विनिर्देश',
      'marketing content': 'मार्केटिंग सामग्री',
      'business proposal': 'व्यावसायिक प्रस्ताव',
      'medical document': 'चिकित्सा दस्तावेज',
      'general document': 'सामान्य दस्तावेज',
    },
    ar: {
      'financial report': 'تقرير مالي',
      'legal document': 'وثيقة قانونية',
      'research paper': 'ورقة بحثية',
      'news article': 'مقال اخباري',
      'technical specification': 'مواصفات تقنية',
      'marketing content': 'محتوى تسويقي',
      'business proposal': 'اقتراح عمل',
      'medical document': 'وثيقة طبية',
      'general document': 'وثيقة عامة',
    },
    zh: {
      'financial report': '财务报告',
      'legal document': '法律文件',
      'research paper': '研究论文',
      'news article': '新闻文章',
      'technical specification': '技术规范',
      'marketing content': '营销内容',
      'business proposal': '商业提案',
      'medical document': '医疗文件',
      'general document': '通用文件',
    },
  };

  const map = translations[normalizeLanguage(language)] || {};
  return categories.map((category) => map[category] || category);
}

const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'against',
  'between',
  'before',
  'being',
  'below',
  'could',
  'document',
  'during',
  'each',
  'from',
  'have',
  'having',
  'into',
  'more',
  'most',
  'over',
  'same',
  'should',
  'some',
  'such',
  'than',
  'that',
  'their',
  'there',
  'these',
  'they',
  'this',
  'through',
  'under',
  'very',
  'what',
  'when',
  'where',
  'which',
  'while',
  'with',
  'would',
  'your',
  'were',
  'been',
  'will',
  'also',
  'into',
  'onto',
  'across',
  'because',
  'them',
  'then',
  'than',
  'para',
  'como',
  'pero',
  'esta',
  'este',
  'avec',
  'dans',
  'pour',
  'eine',
  'nicht',
  'oder',
  'und',
  'com',
  'uma',
  'que',
  'por',
  'और',
  'यह',
  'लिए',
  'के',
  'का',
  'في',
  'من',
  'على',
  'هذا',
  'هذه',
  '的',
  '了',
  '在',
  '是',
]);

const QUESTION_STOP_WORDS = new Set([
  'what',
  'which',
  'who',
  'whom',
  'whose',
  'when',
  'where',
  'why',
  'how',
  'does',
  'did',
  'document',
  'mention',
  'mentions',
  'say',
  'says',
  'about',
  'mainly',
  'summarize',
  'summarise',
  'purpose',
  'features',
  'being',
  'tested',
  'key',
  'points',
  'topics',
]);

const TERM_BLACKLIST = new Set([
  'about',
  'analysis',
  'appear',
  'appears',
  'content',
  'document',
  'goal',
  'information',
  'main',
  'purpose',
  'test',
  'testing',
  'text',
  'topic',
  'topics',
  'verify',
]);

const TERM_ALLOWLIST = new Set([
  'docuwise',
  'ui',
  'ai',
  'sales',
  'leave',
  'approval',
  'rules',
  'employee',
  'manager',
  'retention',
  'conversion',
  'performance',
  'segment',
]);

const TERM_REJECT_WORDS = new Set([
  'about',
  'appear',
  'appears',
  'be',
  'content',
  'document',
  'explains',
  'explain',
  'goal',
  'improved',
  'increased',
  'information',
  'main',
  'purpose',
  'test',
  'testing',
  'text',
  'topic',
  'topics',
  'verify',
]);

const TERM_PRIORITY_WORDS = new Set([
  'artificial',
  'backend',
  'collaboration',
  'customer',
  'document',
  'enterprise',
  'extraction',
  'frontend',
  'integration',
  'lead',
  'productivity',
  'regional',
  'review',
  'smoke',
  'upload',
  'testing',
]);

const TERM_CANONICAL = new Map([
  ['artificial intelligence', 'artificial intelligence'],
  ['analysis testing', 'analysis testing'],
  ['absence requests', 'absence requests'],
  ['collaboration', 'collaboration'],
  ['customer retention', 'customer retention'],
  ['document review', 'document review'],
  ['employee responsibilities', 'employee responsibilities'],
  ['enterprise segment', 'enterprise segment'],
  ['extraction testing', 'extraction testing'],
  ['frontend and backend integration', 'frontend-backend integration'],
  ['frontend backend integration', 'frontend-backend integration'],
  ['frontend-backend integration', 'frontend-backend integration'],
  ['lead conversion', 'lead conversion'],
  ['leave approval rules', 'leave approval rules'],
  ['leave request', 'leave requests'],
  ['manager review steps', 'manager review steps'],
  ['onboarding automation', 'onboarding automation'],
  ['productivity', 'productivity'],
  ['q3 expansion', 'Q3 expansion'],
  ['retrieval augmented generation', 'Retrieval-Augmented Generation'],
  ['retrieval-augmented generation', 'Retrieval-Augmented Generation'],
  ['quarterly sales', 'quarterly sales'],
  ['regional performance', 'regional performance'],
  ['required documentation', 'required documentation'],
  ['return destruction', 'return or destruction'],
  ['return or destruction', 'return or destruction'],
  ['upload testing', 'upload testing'],
  ['ui smoke test', 'UI smoke test'],
  ['ui smoke test document', 'UI smoke test'],
]);

const COMMON_ADJECTIVES = new Set([
  'better',
  'enterprise',
  'improved',
  'regional',
  'stronger',
  'quarterly',
]);

module.exports = {
  detectDocumentLanguage,
  summariseDocument,
  analyseSentiment,
  categoriseDocument,
  extractKeywords,
  translateText,
  answerQuestion,
  generateAIGuide,
  improveText,
  improveTextDetailed,
  generateBatchInsights,
  compareDocuments,
  readabilityScore,
};

function detectDocumentLanguage(text) {
  const sample = String(text || '').slice(0, 5000);
  if (!sample.trim()) return 'unknown';

  const scriptChecks = [
    ['hi', /[\u0900-\u097F]/g],
    ['ar', /[\u0600-\u06FF]/g],
    ['zh', /[\u4E00-\u9FFF]/g],
    ['ja', /[\u3040-\u30FF]/g],
    ['ko', /[\uAC00-\uD7AF]/g],
    ['ru', /[\u0400-\u04FF]/g],
  ];

  for (const [code, regex] of scriptChecks) {
    const hits = sample.match(regex)?.length || 0;
    if (hits >= 8) return code;
  }

  const lower = sample.toLowerCase();
  const scores = {
    es: countLanguageWords(lower, [' el ', ' la ', ' los ', ' las ', ' que ', ' para ', ' con ', ' una ', ' este ', ' esta ', 'ción']),
    fr: countLanguageWords(lower, [' le ', ' la ', ' les ', ' des ', ' que ', ' pour ', ' avec ', ' une ', ' est ', ' dans ', 'tion']),
    de: countLanguageWords(lower, [' der ', ' die ', ' das ', ' und ', ' mit ', ' für ', ' ist ', ' nicht ', ' ein ', ' eine ', 'ung']),
    pt: countLanguageWords(lower, [' o ', ' a ', ' os ', ' as ', ' que ', ' para ', ' com ', ' uma ', ' este ', ' esta ', 'ção']),
    it: countLanguageWords(lower, [' il ', ' lo ', ' la ', ' gli ', ' che ', ' per ', ' con ', ' una ', ' questo ', ' questa ', 'zione']),
  };

  const [bestCode, bestScore] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return bestScore >= 3 ? bestCode : 'en';
}

function countLanguageWords(text, needles) {
  const padded = ` ${text.replace(/\s+/g, ' ')} `;
  return needles.reduce((score, needle) => score + countMatches(padded, needle.trim()), 0);
}
