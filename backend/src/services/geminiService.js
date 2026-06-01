const { GoogleGenAI } = require('@google/genai');

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_GEMINI_INPUT_CHARS = 30000;

function hasGeminiConfig() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim() && !/^(your_|test_|sk-?\.{3})/i.test(key.trim()));
}

async function summariseDocumentWithGemini(text, language = 'en', context = {}) {
  const cleanedText = cleanDocumentText(text);
  if (!cleanedText) throw new Error('No document text available for Gemini summary');
  const contextLines = buildSummaryContext(context);

  const prompt = `You are a document teacher. Use only the uploaded document text. Do not invent facts, names, dates, obligations, risks, or conclusions that are not supported by the document.
Explain like a human teacher. Prefer interpretation over extraction. Do not simply repeat or paste document sentences. Avoid robotic phrases like "The document states". Keep evidence separate from the explanation because the app may display snippets separately.
If the document is technical or academic, explain the concept, mechanism, limitations, and evaluation points. If it is legal or policy, explain duties, deadlines, exceptions, approval conditions, proof/documents, risks, and obligations. If it is business/project content, explain results, risks, decisions, action points, and business impact.
Use the file context to keep the explanation specific to this document and avoid generic boilerplate.
${contextLines}
Respond in language code: ${language}, defaulting to English when the document language is unclear.
Return only this exact plain-text format:

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

[One clear final explanation of what the user should remember.]

DOCUMENT:
${truncate(cleanedText, MAX_GEMINI_INPUT_CHARS)}`;

  const output = await generateText(prompt, 1200);
  if (!hasRequiredSummarySections(output) || isWeakSummaryOutput(output, cleanedText)) {
    throw new Error('Gemini summary response was missing required sections');
  }
  return output;
}

async function answerQuestionWithGemini(documentText, question) {
  const cleanedText = cleanDocumentText(documentText);
  const cleanedQuestion = String(question || '').trim();
  if (!cleanedText) throw new Error('No document text available for Gemini Q&A');
  if (!cleanedQuestion) throw new Error('No question provided for Gemini Q&A');

  const prompt = `You are a NotebookLM-style document assistant. Answer the user's question based ONLY on the provided document.
Explain like a human teacher: directly answer first, then explain the meaning in simple human language and point out what matters in practice. Use the document as evidence, but do not copy large chunks from it. Keep source snippets separate from the answer because the app displays evidence separately.
If the document does not clearly answer, say "The document does not mention this" and explain what can and cannot be inferred. Do not invent facts. Do not use fake page numbers.
Use this concise structure when useful:
Direct Answer:
Simple Explanation:
What To Pay Attention To:

DOCUMENT:
${truncate(cleanedText, MAX_GEMINI_INPUT_CHARS)}

QUESTION:
${cleanedQuestion}`;

  const answer = await generateText(prompt, 700);
  if (!answer || answer.length < 2 || isWeakAnswerOutput(answer)) {
    throw new Error('Gemini Q&A response was empty');
  }

  const sources = buildQASources(cleanedText, cleanedQuestion);
  return {
    answer,
    sources,
    followUpQuestions: buildQAFollowUps(cleanedText, cleanedQuestion),
    confidence: inferQAConfidence(sources, answer),
    provider: 'gemini',
  };
}

async function generateAIGuideWithGemini(documentText, summary = '') {
  const cleanedText = cleanDocumentText(documentText);
  if (!cleanedText) throw new Error('No document text available for Gemini guide');

  const prompt = `You are a document study assistant. Use only the document text and existing summary below. Do not invent unsupported facts.
Return ONLY valid JSON with this exact shape:
{
  "suggestedQuestions": ["string"],
  "studyGuide": {
    "overview": "string",
    "keyPoints": ["string"],
    "thingsToRemember": ["string"]
  },
  "glossary": [{"term":"string","meaning":"string"}],
  "keyTakeaways": ["string"]
}
Keep it concise. Suggested questions should be useful for asking about this document. Glossary terms must come from the document.

DOCUMENT:
${truncate(cleanedText, MAX_GEMINI_INPUT_CHARS)}

EXISTING SUMMARY:
${truncate(cleanDocumentText(summary), 6000)}`;

  const output = await generateText(prompt, 1100);
  const parsed = parseJsonObject(output);
  const guide = normalizeGuide(parsed, cleanedText);
  if (!guide.studyGuide.overview && guide.keyTakeaways.length === 0) {
    throw new Error('Gemini guide response was weak');
  }
  return { ...guide, provider: 'gemini' };
}

async function translateTextWithGemini(text, language = 'en') {
  const cleanedText = cleanDocumentText(text);
  const cleanedLanguage = String(language || 'en').trim();
  if (!cleanedText) throw new Error('No text provided for Gemini translation');
  if (!cleanedLanguage || cleanedLanguage === 'en') return cleanedText;

  const targetLanguage = resolveLanguageName(cleanedLanguage);
  const scriptHint = cleanedLanguage === 'hi' ? 'Use Devanagari script.' : '';

  const prompt = `You are a professional translator. Translate the user's text into ${targetLanguage}. Preserve meaning, formatting, and tone. ${scriptHint} Return only the translated text in ${targetLanguage}, with no explanation, no markdown, and no bilingual output.

TEXT:
${truncate(cleanedText, MAX_GEMINI_INPUT_CHARS)}`;

  const output = await generateText(prompt, 900);
  if (!output || output.length < 2) throw new Error('Gemini translation response was empty');
  return output.trim();
}

function buildSummaryContext(context = {}) {
  const parts = [];
  if (context.documentName) parts.push(`Document name: ${String(context.documentName).trim()}.`);
  if (context.fileType) parts.push(`File type: ${String(context.fileType).trim().toUpperCase()}.`);
  if (Number(context.wordCount) > 0) parts.push(`Approximate word count: ${Number(context.wordCount)}.`);
  return parts.length > 0 ? `Document context: ${parts.join(' ')} ` : '';
}

async function generateText(prompt, maxOutputTokens) {
  if (!hasGeminiConfig()) throw new Error('Gemini API key is not configured');

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    contents: prompt,
    config: {
      temperature: 0.2,
      maxOutputTokens,
    },
  });

  return String(response.text || '').trim();
}

function parseJsonObject(value) {
  const text = String(value || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Gemini guide response was not JSON');
  return JSON.parse(text.slice(start, end + 1));
}

function hasRequiredSummarySections(value) {
  const text = String(value || '');
  return [
    'Document Explanation',
    '1. What this file is about',
    '2. Simple explanation',
    '3. Main points explained',
    '4. What this means in real life',
    '5. What you should pay attention to',
    '6. Important terms explained',
    '7. Final takeaway',
  ].every((marker) => text.includes(marker));
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

function isWeakAnswerOutput(answer) {
  const text = String(answer || '').trim();
  if (text.length < 35) return true;
  if ((text.match(/\bthe document states\b/gi) || []).length > 2) return true;
  if (/^the document is about\b/i.test(text) && text.length < 120) return true;
  return false;
}

function cleanDocumentText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncate(text, maxChars) {
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n[...truncated]` : text;
}

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildQASources(documentText, question) {
  const sentences = splitSentences(documentText);
  const terms = extractQuestionTerms(question);
  const fallbackTerms = extractImportantTerms(documentText).slice(0, 6);
  const queryTerms = [...new Set([...(terms.length ? terms : fallbackTerms), ...intentTerms(question)])];

  if (sentences.length === 0 || queryTerms.length === 0) return [];

  const seen = new Set();
  return sentences
    .map((sentence, index) => ({
      sentence: trimSourceSnippet(sentence),
      index,
      score: scoreSentence(sentence, queryTerms),
    }))
    .filter((item) => item.score > 0 && item.sentence)
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

function intentTerms(question) {
  const text = String(question || '').toLowerCase();
  if (/\b(what should i understand|explain this document|explain this file|what is this document about|what does this.*mean|simple words|purpose)\b/.test(text)) {
    return ['purpose', 'important', 'risk', 'must', 'should', 'requires'];
  }
  if (/\b(mainly about|main idea|summary|summari[sz]e)\b/.test(text)) return ['about', 'goal', 'purpose'];
  if (/\b(key takeaways|takeaways|key points|main points)\b/.test(text)) return ['key', 'important', 'goal'];
  if (/\b(risk|limitation|concern)\b/.test(text)) return ['risk', 'limitation', 'concern'];
  return [];
}

function extractQuestionTerms(question) {
  return String(question || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
}

function extractImportantTerms(text) {
  const counts = new Map();
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
    .forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([word]) => word)
    .slice(0, 10);
}

function scoreSentence(sentence, terms) {
  const lower = String(sentence || '').toLowerCase();
  return terms.reduce((score, term) => {
    const normalized = String(term || '').toLowerCase();
    if (!normalized) return score;
    if (lower.includes(normalized)) return score + 5;
    const stem = normalized.replace(/(ing|ed|es|s)$/i, '');
    if (stem.length > 2 && new RegExp(`\\b${escapeRegex(stem)}[a-z]*\\b`, 'i').test(lower)) {
      return score + 2;
    }
    return score;
  }, 0);
}

function trimSourceSnippet(sentence, maxChars = 240) {
  const cleaned = String(sentence || '').replace(/\s+/g, ' ').trim();
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
  const terms = extractImportantTerms(documentText).slice(0, 3);
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
    .filter((item) => item.toLowerCase() !== asked)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function normalizeGuide(payload, documentText) {
  const terms = extractImportantTerms(documentText);
  const suggestedQuestions = normalizeStringArray(payload?.suggestedQuestions, 5);
  const keyPoints = normalizeStringArray(payload?.studyGuide?.keyPoints, 5);
  const thingsToRemember = normalizeStringArray(payload?.studyGuide?.thingsToRemember, 5);
  const keyTakeaways = normalizeStringArray(payload?.keyTakeaways, 5);
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
    suggestedQuestions: mergeGuideQuestions(suggestedQuestions, documentText),
    studyGuide: {
      overview: String(payload?.studyGuide?.overview || '').trim() || splitSentences(documentText)[0] || '',
      keyPoints: keyPoints.length > 0 ? keyPoints : splitSentences(documentText).slice(0, 4),
      thingsToRemember: thingsToRemember.length > 0 ? thingsToRemember : terms.slice(0, 4).map((term) => `Remember how ${term} is used in this document.`),
    },
    glossary,
    keyTakeaways: keyTakeaways.length > 0 ? keyTakeaways : splitSentences(documentText).slice(0, 4),
  };
}

function mergeGuideQuestions(providerQuestions, documentText) {
  const defaults = [
    'What is this document mainly about?',
    'What are the key takeaways?',
    'Explain this in simple language.',
    'What should I pay attention to?',
    'What questions should I ask about this document?',
  ];
  const seen = new Set();
  return [...defaults, ...(providerQuestions || []), ...buildQAFollowUps(documentText, '')]
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

function normalizeStringArray(value, limit) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, limit)
    : [];
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'being',
  'could',
  'document',
  'does',
  'from',
  'have',
  'into',
  'mainly',
  'more',
  'most',
  'question',
  'should',
  'summarize',
  'summarise',
  'than',
  'that',
  'their',
  'there',
  'these',
  'they',
  'this',
  'what',
  'understand',
  'explain',
  'meaning',
  'mean',
  'when',
  'where',
  'which',
  'while',
  'with',
  'would',
  'your',
]);

module.exports = {
  hasGeminiConfig,
  summariseDocumentWithGemini,
  answerQuestionWithGemini,
  generateAIGuideWithGemini,
  translateTextWithGemini,
};
