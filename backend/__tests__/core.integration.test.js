const fs = require('fs');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const request = require('supertest');

require('dotenv').config();

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
process.env.OPENAI_API_KEY = 'sk-...';
process.env.HUGGINGFACE_API_TOKEN = 'hf_...';
process.env.GEMINI_API_KEY = 'sk-...';

const app = require('../server');
const { hasGeminiConfig } = require('../src/services/geminiService');
const { summariseDocument, answerQuestion } = require('../src/services/openaiService');
const Analysis = require('../src/models/Analysis');
const CollabEvent = require('../src/models/CollabEvent');
const Comment = require('../src/models/Comment');
const Document = require('../src/models/Document');
const User = require('../src/models/User');

const usingTestMongoUri = Boolean(process.env.MONGODB_URI_TEST);
const mongoUri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;
const dbAvailable = Boolean(mongoUri);
const testRunId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const testEmail = `integration-${testRunId}@example.com`;
const pdfFixturePath = path.join(__dirname, 'fixtures', 'docuwise-extraction.pdf');
const uploadsDir = path.join(__dirname, '..', 'uploads');
const password = 'Password123!';
const documentText = [
  'DocuWise UI smoke test document.',
  'This document is about artificial intelligence, document review, productivity, collaboration, upload testing, extraction testing, and analysis testing.',
  'The goal is to verify the frontend and backend integration.',
].join('\n');
const leavePolicyText = [
  'This policy explains how employees can request leave from work.',
  'Employees must submit leave requests at least seven days in advance unless there is an emergency.',
  'Managers review requests based on staffing needs and project deadlines.',
  'Employees may need to provide documents for medical or long-term leave.',
  'The purpose of the policy is to keep leave approval fair, organized, and predictable.',
].join(' ');
const technicalNotesText = [
  'Retrieval-Augmented Generation helps language models answer questions by retrieving relevant information from external documents before generating a response.',
  'This reduces hallucination risk and improves factual grounding.',
  'However, retrieval quality depends on chunking, indexing, and ranking methods.',
].join(' ');
const businessReportText = [
  'The Q2 customer onboarding report shows that average setup time decreased from 12 days to 7 days after automation was introduced.',
  'Support tickets dropped by 18 percent, but enterprise customers still reported delays during data migration.',
  'The operations team recommends improving migration tooling before the Q3 expansion.',
].join(' ');
const legalAgreementText = [
  'This confidentiality agreement requires both parties to protect shared business information for three years.',
  'Confidential information may only be used for evaluation of a potential partnership.',
  'Publicly known information and independently developed information are excluded.',
  'Upon request, each party must return or destroy confidential materials.',
].join(' ');

let token;
let documentId;
let analysisId;
let uploadedFilePath;
const createdDocumentIds = [];
const createdAnalysisIds = [];
const createdCommentIds = [];
const uploadedFilePaths = [];

const maybeTest = dbAvailable ? test : test.skip;

beforeAll(async () => {
  if (!dbAvailable) return;
  warnIfUsingFallbackDb();
  assertSafeTestDatabase(mongoUri);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    if (documentId) {
      const doc = await Document.findById(documentId);
      uploadedFilePath = doc?.filePath || uploadedFilePath;
    }

    if (analysisId) await Analysis.deleteMany({ _id: analysisId }).catch(() => {});
    if (createdCommentIds.length) await Comment.deleteMany({ _id: { $in: createdCommentIds } }).catch(() => {});
    if (createdDocumentIds.length) await CollabEvent.deleteMany({ document: { $in: createdDocumentIds } }).catch(() => {});
    if (documentId) await Document.deleteMany({ _id: documentId }).catch(() => {});
    if (createdAnalysisIds.length) await Analysis.deleteMany({ _id: { $in: createdAnalysisIds } }).catch(() => {});
    if (createdDocumentIds.length) await Document.deleteMany({ _id: { $in: createdDocumentIds } }).catch(() => {});
    await User.deleteMany({ email: testEmail }).catch(() => {});
    await mongoose.disconnect();
  }

  if (uploadedFilePath) uploadedFilePaths.push(uploadedFilePath);
  for (const filePath of uploadedFilePaths) {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

describe('core backend integration flow', () => {
  test('GET /health returns ok without opening a listener', async () => {
    const res = await request(app).get('/health').expect(200);

    expect(res.body.status).toBe('ok');
  });

  test('Gemini config is optional in tests', () => {
    expect(hasGeminiConfig()).toBe(false);
  });

  maybeTest('auth flow registers, logs in, and returns current user', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Integration',
        lastName: 'Tester',
        email: testEmail,
        password,
      })
      .expect(201);

    expect(registerRes.body.success).toBe(true);
    expect(registerRes.body.data.token).toBeTruthy();
    expect(registerRes.body.data.user.email).toBe(testEmail);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password })
      .expect(200);

    token = loginRes.body.data.token;
    expect(token).toBeTruthy();

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(meRes.body.data.user.email).toBe(testEmail);
  });

  maybeTest('upload flow stores a txt document with extracted text', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(documentText), 'docuwise-integration.txt')
      .expect(201);

    const doc = res.body.data.document;
    documentId = doc._id;
    uploadedFilePath = doc.filePath;
    createdDocumentIds.push(doc._id);
    uploadedFilePaths.push(doc.filePath);

    expect(doc.originalName).toBe('docuwise-integration.txt');
    expect(doc.fileType).toBe('txt');
    expect(doc.extractedText).toContain('DocuWise UI smoke test document');
  });

  maybeTest('analysis flow starts and can be retrieved', async () => {
    const startRes = await request(app)
      .post('/api/analysis/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ documentId, mode: 'all', language: 'en' })
      .expect(202);

    analysisId = startRes.body.data.analysisId;
    createdAnalysisIds.push(analysisId);
    expect(analysisId).toBeTruthy();
    expect(startRes.body.data.status).toBe('processing');

    const analysis = await waitForAnalysis(analysisId, token);
    expect(['processing', 'completed']).toContain(analysis.status);
    expect(analysis.document.extractedText).toContain('frontend and backend integration');
  });

  maybeTest('Q&A flow returns a non-empty grounded answer', async () => {
    const res = await request(app)
      .post(`/api/analysis/${analysisId}/qa`)
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'What is this document mainly about?' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.answer).toEqual(expect.any(String));
    expect(res.body.data.answer.trim().length).toBeGreaterThan(0);
    expect(res.body.data.answer.toLowerCase()).toContain('artificial intelligence');
    expect(Array.isArray(res.body.data.sources)).toBe(true);
    expect(Array.isArray(res.body.data.followUpQuestions)).toBe(true);
    expect(['high', 'medium', 'low']).toContain(res.body.data.confidence);
    expect(['openai', 'fallback']).toContain(res.body.data.provider);

    for (const source of res.body.data.sources) {
      expect(source.snippet).toEqual(expect.any(String));
      expect(['high', 'medium', 'low']).toContain(source.relevance);
      expect(normalizeWhitespace(documentText)).toContain(normalizeWhitespace(source.snippet).replace(/\.\.\.$/, ''));
    }
  });

  maybeTest('AI guide flow returns helper tools without Gemini config', async () => {
    const res = await request(app)
      .get(`/api/analysis/${analysisId}/ai-guide`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.suggestedQuestions)).toBe(true);
    expect(res.body.data.suggestedQuestions.length).toBeGreaterThan(0);
    expect(res.body.data.studyGuide).toEqual(expect.any(Object));
    expect(res.body.data.studyGuide.overview).toEqual(expect.any(String));
    expect(Array.isArray(res.body.data.studyGuide.keyPoints)).toBe(true);
    expect(Array.isArray(res.body.data.studyGuide.thingsToRemember)).toBe(true);
    expect(Array.isArray(res.body.data.glossary)).toBe(true);
    expect(Array.isArray(res.body.data.keyTakeaways)).toBe(true);
    expect(['openai', 'fallback']).toContain(res.body.data.provider);
  });

  maybeTest('API key generation is clearly marked as inactive for authentication', async () => {
    const res = await request(app)
      .post('/api/auth/api-key')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.apiKey).toEqual(expect.stringMatching(/^dw_live_/));
    expect(res.body.data.warning).toBe('API key authentication is not enabled yet. Use JWT authentication.');
  });
});

describe('document extraction reliability', () => {
  maybeTest('TXT upload extracts expected text', async () => {
    const text = 'DocuWise TXT extraction test. This file verifies plain text extraction.';
    const doc = await uploadFixture(Buffer.from(text, 'utf-8'), 'docuwise-extraction.txt');

    expect(doc.fileType).toBe('txt');
    expect(doc.extractedText).toContain('DocuWise TXT extraction test');
    expect(doc.extractedText).toContain('plain text extraction');
    expect(doc.wordCount).toBeGreaterThan(0);
  });

  maybeTest('PDF upload extracts expected text from selectable text', async () => {
    const text = 'DocuWise PDF extraction test. This file verifies PDF text extraction.';
    const doc = await uploadFixture(fs.readFileSync(pdfFixturePath), 'docuwise-extraction.pdf');

    expect(doc.fileType).toBe('pdf');
    expect(normalizeWhitespace(doc.extractedText)).toContain(text);
    expect(doc.wordCount).toBeGreaterThan(0);
  });

  maybeTest('DOCX upload extracts expected text', async () => {
    const text = 'DocuWise DOCX extraction test. This file verifies Word document text extraction.';
    const doc = await uploadFixture(createDocxBuffer(text), 'docuwise-extraction.docx');

    expect(doc.fileType).toBe('docx');
    expect(normalizeWhitespace(doc.extractedText)).toContain(text);
    expect(doc.wordCount).toBeGreaterThan(0);
  });

  maybeTest('unsupported file extension is rejected', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('unsupported content'), 'docuwise-extraction.csv')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Unsupported file type. Please upload TXT, PDF, or DOCX.');
  });

  maybeTest('empty extracted text is rejected without creating a document', async () => {
    const filename = `docuwise-empty-${testRunId}.txt`;
    const beforeCount = await Document.countDocuments({ originalName: filename });
    const beforeFiles = getUploadFileNames();

    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('', 'utf-8'), filename)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('No selectable text found in this document. OCR is not supported yet.');
    await expect(Document.countDocuments({ originalName: filename })).resolves.toBe(beforeCount);
    expect(getUploadFileNames()).toEqual(beforeFiles);
  });

  maybeTest('invalid PDF extraction failure is rejected without creating a document', async () => {
    const filename = `docuwise-invalid-${testRunId}.pdf`;
    const beforeCount = await Document.countDocuments({ originalName: filename });
    const beforeFiles = getUploadFileNames();

    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4\nbroken pdf content', 'utf-8'), filename)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Could not extract readable text from this file.');
    await expect(Document.countDocuments({ originalName: filename })).resolves.toBe(beforeCount);
    expect(getUploadFileNames()).toEqual(beforeFiles);
  });
});

describe('human-readable explanation quality', () => {
  test('fallback summary explains leave policy with practical meaning', async () => {
    const summary = await summariseDocument(leavePolicyText, 'en');
    const normalizedSummary = normalizeWhitespace(summary).toLowerCase();

    expect(summary).toContain('Document Explanation');
    expect(summary).toContain('1. What this file is about');
    expect(summary).toContain('3. Main points explained');
    expect(summary).toContain('4. What this means in real life');
    expect(summary).toContain('5. What you should pay attention to');
    expect(summary).toContain('7. Final takeaway');
    expect(normalizedSummary).toContain('leave');
    expect(normalizedSummary).toContain('approval');
    expect(normalizedSummary).toMatch(/request.*early|seven days|advance/);
    expect(normalizedSummary).toContain('emergency');
    expect(normalizedSummary).toMatch(/staffing|project/);
    expect(normalizedSummary).toMatch(/medical|long-term|documents?/);
    expect(normalizedSummary).toMatch(/plain english|in real life|practical/);

    const pastedSentences = leavePolicyText
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => sentence.length > 35 && summary.includes(sentence));
    expect(pastedSentences.length).toBeLessThan(2);
  });

  test('fallback summary explains academic and technical notes without repeated phrase chunks', async () => {
    const summary = await summariseDocument(technicalNotesText, 'en');
    const normalizedSummary = normalizeWhitespace(summary).toLowerCase();

    expect(normalizedSummary).toContain('retrieval-augmented generation');
    expect(normalizedSummary).toMatch(/retrieves?|retrieved information/);
    expect(normalizedSummary).toContain('hallucination');
    expect(normalizedSummary).toMatch(/chunking|indexing|ranking/);
    expect(normalizedSummary).not.toMatch(/retrieval-augmented generation retrieval-augmented generation/);
  });

  test('fallback summary explains business report results, risk, and action point', async () => {
    const summary = await summariseDocument(businessReportText, 'en');
    const normalizedSummary = normalizeWhitespace(summary).toLowerCase();

    expect(normalizedSummary).toMatch(/onboarding.*improved|improved onboarding/);
    expect(normalizedSummary).toContain('automation');
    expect(normalizedSummary).toMatch(/migration.*risk|data migration/);
    expect(normalizedSummary).toMatch(/q3|expansion|migration tooling/);
  });

  test('fallback summary explains legal agreement duties without adding purchase or license commitment', async () => {
    const summary = await summariseDocument(legalAgreementText, 'en');
    const normalizedSummary = normalizeWhitespace(summary).toLowerCase();

    expect(normalizedSummary).toContain('confidential');
    expect(normalizedSummary).toContain('three years');
    expect(normalizedSummary).toMatch(/evaluation.*partnership|partnership.*evaluation/);
    expect(normalizedSummary).toMatch(/publicly known|independently developed|excluded/);
    expect(normalizedSummary).toMatch(/return|destroy/);
    expect(normalizedSummary).not.toMatch(/creates? a purchase|license commitment/);
  });

  test.each([
    'What should I understand from this document?',
    'What should I pay attention to?',
    'Explain this in simple words.',
    'What does this document mean in real life?',
  ])('fallback Q&A handles broad question: %s', async (question) => {
    const result = await answerQuestion(leavePolicyText, question);
    const answer = result.answer.toLowerCase();

    expect(answer).not.toContain('does not mention understand');
    expect(answer).toMatch(/direct answer|simple explanation/);
    expect(answer).toMatch(/request.*early|seven days|advance/);
    expect(answer).toMatch(/emergency|documents?|medical|long-term/);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(['high', 'medium', 'low']).toContain(result.confidence);

    for (const source of result.sources) {
      expect(normalizeWhitespace(leavePolicyText)).toContain(normalizeWhitespace(source.snippet).replace(/\.\.\.$/, ''));
    }
  });
});

describe('SSE authentication regression', () => {
  maybeTest('normal protected route rejects query token', async () => {
    const res = await request(app)
      .get(`/api/auth/me?token=${encodeURIComponent(token)}`)
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  maybeTest('normal protected route accepts Authorization header', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
  });

  maybeTest('SSE activity stream accepts query token with event-stream Accept header', async () => {
    const res = await requestStreamingHeaders(
      `/api/analysis/activity/stream?token=${encodeURIComponent(token)}`,
      { Accept: 'text/event-stream' }
    );

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
  });

  maybeTest('SSE activity stream rejects missing token', async () => {
    const res = await requestStreamingHeaders('/api/analysis/activity/stream', {
      Accept: 'text/event-stream',
    });

    expect(res.statusCode).toBe(401);
  });

  maybeTest('SSE activity stream rejects invalid token', async () => {
    const res = await requestStreamingHeaders('/api/analysis/activity/stream?token=invalid', {
      Accept: 'text/event-stream',
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('comment reactions', () => {
  maybeTest('valid reaction is added and returned on a comment', async () => {
    const comment = await createTestComment('Reaction target comment');

    const res = await request(app)
      .post(`/api/comments/${comment._id}/reaction`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '\u{1F44D}' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.comment.reactions).toHaveLength(1);
    expect(res.body.data.comment.reactions[0].emoji).toBe('\u{1F44D}');
  });

  maybeTest('invalid reaction is rejected cleanly', async () => {
    const comment = await createTestComment('Invalid reaction target comment');

    const res = await request(app)
      .post(`/api/comments/${comment._id}/reaction`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: 'fire' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid emoji');
  });

  maybeTest('same reaction from same user toggles off', async () => {
    const comment = await createTestComment('Toggle reaction target comment');

    await request(app)
      .post(`/api/comments/${comment._id}/reaction`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '\u{2705}' })
      .expect(200);

    const res = await request(app)
      .post(`/api/comments/${comment._id}/reaction`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '\u{2705}' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.comment.reactions).toHaveLength(0);
  });
});

async function uploadFixture(buffer, filename) {
  const res = await request(app)
    .post('/api/documents/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', buffer, filename)
    .expect(201);

  const doc = res.body.data.document;
  createdDocumentIds.push(doc._id);
  uploadedFilePaths.push(doc.filePath);
  return doc;
}

async function createTestComment(content) {
  const res = await request(app)
    .post('/api/comments')
    .set('Authorization', `Bearer ${token}`)
    .send({ documentId, content })
    .expect(201);

  const comment = res.body.data.comment;
  createdCommentIds.push(comment._id);
  return comment;
}

function requestStreamingHeaders(pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let req;
    let res;
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: pathname,
          method: 'GET',
          headers,
        },
        (response) => {
          res = response;
          const result = { statusCode: response.statusCode, headers: response.headers };
          if (String(response.headers['content-type'] || '').includes('text/event-stream')) {
            response.once('data', () => {
              setTimeout(() => finish(null, result), 250);
            });
            response.resume();
            return;
          }
          finish(null, result);
        }
      );

      req.on('error', (err) => {
        finish(err);
      });

      req.end();
    });

    server.on('error', (err) => {
      finish(err);
    });

    const timeout = setTimeout(() => {
      finish(new Error(`Timed out waiting for ${pathname}`));
    }, 5000);

    function finish(err, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (res) res.destroy();
      if (req) req.destroy();
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      server.close();
      if (err) reject(err);
      else resolve(result);
    }
  });
}

async function waitForAnalysis(id, authToken) {
  let lastAnalysis;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const res = await request(app)
      .get(`/api/analysis/${id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    lastAnalysis = res.body.data.analysis;
    if (lastAnalysis.status === 'completed') return lastAnalysis;

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return lastAnalysis;
}

function warnIfUsingFallbackDb() {
  if (!usingTestMongoUri) {
    console.warn(
      'MONGODB_URI_TEST is not configured. Integration tests are using MONGODB_URI with targeted cleanup only.'
    );
  }
}

function assertSafeTestDatabase(uri) {
  const dbName = getMongoDatabaseName(uri);
  const looksUnsafe = /(^|[-_])(prod|production|live)([-_]|$)/i.test(dbName);
  if (looksUnsafe) {
    throw new Error(
      `Refusing to run integration tests against database "${dbName}". Set MONGODB_URI_TEST to a dedicated test database.`
    );
  }
}

function getMongoDatabaseName(uri) {
  try {
    const parsed = new URL(uri);
    return parsed.pathname.replace(/^\//, '').split('?')[0] || '';
  } catch {
    const withoutQuery = String(uri || '').split('?')[0];
    return withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1);
  }
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getUploadFileNames() {
  if (!fs.existsSync(uploadsDir)) return [];
  return fs.readdirSync(uploadsDir).sort();
}

function createDocxBuffer(text) {
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${escapeXml(text)}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`,
  };

  return createZipBuffer(files);
}

function createZipBuffer(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  Object.entries(files).forEach(([name, content]) => {
    const nameBuffer = Buffer.from(name, 'utf-8');
    const dataBuffer = Buffer.from(content, 'utf-8');
    const crc = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
