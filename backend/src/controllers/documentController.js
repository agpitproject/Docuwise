const fs = require('fs');
const path = require('path');
const Document = require('../models/Document');
const Analysis = require('../models/Analysis');
const CollabEvent = require('../models/CollabEvent');
const { extractText } = require('../services/fileService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { summariseDocument, improveTextDetailed, detectDocumentLanguage } = require('../services/openaiService');
const { sendCollaboratorInvite } = require('../services/mailService');

const VALID_ROLES = ['editor', 'reviewer', 'approver'];
const STALE_AFTER_MS = 45000;

// POST /api/documents/upload
const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) return sendError(res, 400, 'No file uploaded');

  const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');

  // Extract raw text from the uploaded file
  let extractedText = '';
  try {
    extractedText = await extractText(req.file.path, ext);
  } catch (err) {
    console.error('Text extraction failed:', err.message);
    cleanupUploadedFile(req.file.path);
    return sendError(res, 400, 'Could not extract readable text from this file.');
  }

  if (!extractedText.trim()) {
    cleanupUploadedFile(req.file.path);
    return sendError(res, 400, 'No selectable text found in this document. OCR is not supported yet.');
  }

  const wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;

  const doc = await Document.create({
    user: req.user._id,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    filePath: req.file.path,
    fileType: ext,
    fileSize: req.file.size,
    extractedText,
    wordCount,
    status: 'uploaded',
  });

  sendSuccess(res, 201, 'Document uploaded', { document: doc });
});

// GET /api/documents
const getDocuments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const filter = {
    $or: [
      { user: req.user._id },
      { 'collaborators.email': req.user.email },
    ],
  };
  if (type) filter.fileType = type;

  const docs = await Document.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .select('-extractedText -filePath');

  const total = await Document.countDocuments(filter);

  sendSuccess(res, 200, 'Documents retrieved', { documents: docs, total, page: Number(page) });
});

// GET /api/documents/:id
const getDocument = asyncHandler(async (req, res) => {
  const doc = await findAccessibleDocument(req.params.id, req.user);
  if (!doc) return sendError(res, 404, 'Document not found');
  sendSuccess(res, 200, 'Document retrieved', { document: doc });
});

// DELETE /api/documents/:id
const deleteDocument = asyncHandler(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, user: req.user._id });
  if (!doc) return sendError(res, 404, 'Document not found');

  // Remove file from disk
  try {
    if (fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath);
  } catch (_) {}

  await Analysis.deleteMany({ document: doc._id, user: req.user._id });
  await doc.deleteOne();
  sendSuccess(res, 200, 'Document deleted');
});

// PATCH /api/documents/:id/collaborators
const updateCollaborators = asyncHandler(async (req, res) => {
  const collaborators = Array.isArray(req.body.collaborators) ? req.body.collaborators : [];

  if (collaborators.length > 3) {
    return sendError(res, 400, 'You can add up to 3 collaborators per document.');
  }

  const sanitized = collaborators
    .map((partner) => ({
      name: String(partner?.name || '').trim() || String(partner?.email || '').split('@')[0] || 'Collaborator',
      email: String(partner?.email || '').trim().toLowerCase(),
      role: normalizeRole(partner?.role),
      status: 'invited',
      invitedAt: new Date(),
    }))
    .filter((partner) => partner.email);

  const uniqueEmails = new Set(sanitized.map((partner) => partner.email));
  if (uniqueEmails.size !== sanitized.length) {
    return sendError(res, 400, 'Collaborator emails must be unique.');
  }

  let doc = await findAccessibleDocument(req.params.id, req.user);
  if (!doc) return sendError(res, 404, 'Document not found');
  if (!canManage(doc, req.user)) return sendError(res, 403, 'Only owners and editors can invite collaborators.');

  const previousCollaborators = Array.isArray(doc.collaborators) ? doc.collaborators : [];
  const previousByEmail = new Map(
    previousCollaborators.map((partner) => [String(partner.email || '').toLowerCase(), partner])
  );
  const nextByEmail = new Map(
    sanitized.map((partner) => [String(partner.email || '').toLowerCase(), partner])
  );

  const logs = [];
  nextByEmail.forEach((partner, email) => {
    const previous = previousByEmail.get(email);
    if (!previous) {
      logs.push(
        CollabEvent.log(req.user, doc._id, 'collaborator_added', {
          targetEmail: partner.email,
          targetRole: partner.role,
        })
      );
      return;
    }

    if (String(previous.role || 'editor') !== String(partner.role || 'editor')) {
      logs.push(
        CollabEvent.log(req.user, doc._id, 'role_changed', {
          targetEmail: partner.email,
          targetRole: partner.role,
        })
      );
    }
  });

  previousByEmail.forEach((partner, email) => {
    if (!nextByEmail.has(email)) {
      logs.push(
        CollabEvent.log(req.user, doc._id, 'collaborator_removed', {
          targetEmail: partner.email,
        })
      );
    }
  });

  if (logs.length > 0) await Promise.allSettled(logs);

  const existingEmails = new Set(doc.collaborators.map((partner) => partner.email));
  const newCollaborators = sanitized.filter((partner) => !existingEmails.has(partner.email));

  doc.collaborators = sanitized;
  newCollaborators.forEach((partner) => {
    addActivity(doc, 'invite', req.user, `Invited ${partner.email} as ${partner.role}`);
  });
  await doc.save();

  const inviteResults = await Promise.allSettled(
    newCollaborators.map((partner) => sendCollaboratorInvite({
      collaborator: partner,
      document: doc,
      inviter: req.user,
    }))
  );

  inviteResults
    .filter((result) => result.status === 'rejected')
    .forEach((result) => {
      console.error('Collaborator invite email failed:', result.reason?.message || result.reason);
    });

  doc = await Document.findById(doc._id).select('-filePath');

  const failedEmails = inviteResults
    .map((result, index) => (result.status === 'rejected' ? newCollaborators[index].email : null))
    .filter(Boolean);

  sendSuccess(res, 200, failedEmails.length ? 'Collaborators updated, but some invite emails failed.' : 'Collaborators updated', {
    document: doc,
    email: {
      invited: newCollaborators.length,
      failed: failedEmails,
    },
  });
});

// GET /api/documents/:id/collaboration
const getCollaboration = asyncHandler(async (req, res) => {
  const doc = await findAccessibleDocument(req.params.id, req.user).select('-filePath');
  if (!doc) return sendError(res, 404, 'Document not found');

  prunePresence(doc);
  await doc.save();

  sendSuccess(res, 200, 'Collaboration retrieved', {
    document: doc,
    role: getUserRole(doc, req.user),
    permissions: getPermissions(doc, req.user),
  });
});

// POST /api/documents/:id/comments
const addComment = asyncHandler(async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) return sendError(res, 400, 'Comment text is required.');

  const doc = await findAccessibleDocument(req.params.id, req.user);
  if (!doc) return sendError(res, 404, 'Document not found');
  if (!canComment(doc, req.user)) return sendError(res, 403, 'Your role cannot add comments.');

  doc.comments.push({
    author: req.user._id,
    authorName: displayName(req.user),
    text,
  });
  addActivity(doc, 'comment', req.user, 'Added a comment');
  await doc.save();

  sendSuccess(res, 201, 'Comment added', { comments: doc.comments, activity: doc.activity });
});

// POST /api/documents/:id/comments/:commentId/replies
const addReply = asyncHandler(async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) return sendError(res, 400, 'Reply text is required.');

  const doc = await findAccessibleDocument(req.params.id, req.user);
  if (!doc) return sendError(res, 404, 'Document not found');
  if (!canComment(doc, req.user)) return sendError(res, 403, 'Your role cannot reply to comments.');

  const comment = doc.comments.id(req.params.commentId);
  if (!comment) return sendError(res, 404, 'Comment not found');

  comment.replies.push({
    author: req.user._id,
    authorName: displayName(req.user),
    text,
  });
  comment.updatedAt = new Date();
  addActivity(doc, 'comment', req.user, 'Replied to a comment');
  await doc.save();

  sendSuccess(res, 201, 'Reply added', { comments: doc.comments, activity: doc.activity });
});

// PATCH /api/documents/:id/comments/:commentId/resolve
const resolveComment = asyncHandler(async (req, res) => {
  const doc = await findAccessibleDocument(req.params.id, req.user);
  if (!doc) return sendError(res, 404, 'Document not found');
  if (!canEdit(doc, req.user)) return sendError(res, 403, 'Only owners and editors can resolve comments.');

  const comment = doc.comments.id(req.params.commentId);
  if (!comment) return sendError(res, 404, 'Comment not found');

  comment.resolved = Boolean(req.body.resolved);
  comment.updatedAt = new Date();
  addActivity(doc, 'resolve', req.user, `${comment.resolved ? 'Resolved' : 'Reopened'} a comment`);
  await doc.save();

  sendSuccess(res, 200, 'Comment updated', { comments: doc.comments, activity: doc.activity });
});

// POST /api/documents/:id/presence
const updatePresence = asyncHandler(async (req, res) => {
  const doc = await findAccessibleDocument(req.params.id, req.user);
  if (!doc) return sendError(res, 404, 'Document not found');

  const role = getUserRole(doc, req.user);
  const status = req.body.status === 'editing' && canEdit(doc, req.user) ? 'editing' : 'online';
  const existing = doc.activeUsers.find((item) => String(item.user) === String(req.user._id));

  if (existing) {
    existing.name = displayName(req.user);
    existing.role = role;
    existing.status = status;
    existing.lastSeenAt = new Date();
  } else {
    doc.activeUsers.push({
      user: req.user._id,
      name: displayName(req.user),
      role,
      status,
      lastSeenAt: new Date(),
    });
  }

  prunePresence(doc);
  await doc.save();

  sendSuccess(res, 200, 'Presence updated', { activeUsers: doc.activeUsers });
});

// POST /api/documents/:id/ai/summarize
const summarizeCollaborationDocument = asyncHandler(async (req, res) => {
  const doc = await findAccessibleDocument(req.params.id, req.user);
  if (!doc) return sendError(res, 404, 'Document not found');
  if (!doc.extractedText) return sendError(res, 400, 'Document has no extractable text.');

  const sourceLanguage = detectDocumentLanguage(doc.extractedText);
  const requestedLanguage = req.body.language || (sourceLanguage === 'unknown' ? 'en' : sourceLanguage);
  const summary = await summariseDocument(doc.extractedText, requestedLanguage, sourceLanguage);
  addActivity(doc, 'ai', req.user, 'Generated an AI summary');
  await doc.save();

  sendSuccess(res, 200, 'Summary generated', { summary, activity: doc.activity });
});

// POST /api/documents/:id/ai/improve
const improveCollaborationText = asyncHandler(async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) return sendError(res, 400, 'Text is required.');

  const doc = await findAccessibleDocument(req.params.id, req.user);
  if (!doc) return sendError(res, 404, 'Document not found');
  if (!canEdit(doc, req.user)) return sendError(res, 403, 'Only owners and editors can improve text.');

  const suggestion = await improveTextDetailed(text);
  addActivity(doc, 'edit', req.user, 'Generated an improved text suggestion');
  await doc.save();

  sendSuccess(res, 200, 'Text improved', {
    suggestion: suggestion.text,
    source: suggestion.source,
    warning: suggestion.warning,
    activity: doc.activity,
  });
});

module.exports = {
  uploadDocument,
  getDocuments,
  getDocument,
  deleteDocument,
  updateCollaborators,
  getCollaboration,
  addComment,
  addReply,
  resolveComment,
  updatePresence,
  summarizeCollaborationDocument,
  improveCollaborationText,
};

function findAccessibleDocument(id, user) {
  return Document.findOne({
    _id: id,
    $or: [
      { user: user._id },
      { 'collaborators.email': user.email },
    ],
  });
}

function normalizeRole(role) {
  const normalized = String(role || 'editor').trim().toLowerCase();
  return VALID_ROLES.includes(normalized) ? normalized : 'editor';
}

function getUserRole(doc, user) {
  if (String(doc.user) === String(user._id)) return 'owner';
  const collaborator = doc.collaborators.find((partner) => partner.email === user.email);
  return collaborator?.role || 'editor';
}

function getPermissions(doc, user) {
  return {
    canView: Boolean(doc),
    canInvite: canManage(doc, user),
    canComment: canComment(doc, user),
    canEdit: canEdit(doc, user),
  };
}

function canManage(doc, user) {
  return ['owner', 'approver'].includes(getUserRole(doc, user));
}

function canComment(doc, user) {
  return ['owner', 'editor', 'reviewer', 'approver'].includes(getUserRole(doc, user));
}

function canEdit(doc, user) {
  return ['owner', 'editor', 'approver'].includes(getUserRole(doc, user));
}

function addActivity(doc, type, user, message) {
  doc.activity.unshift({
    type,
    actor: user._id,
    actorName: displayName(user),
    message,
    createdAt: new Date(),
  });
  doc.activity = doc.activity.slice(0, 50);
}

function displayName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'User';
}

function cleanupUploadedFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error('Uploaded file cleanup failed:', err.message);
  }
}

function prunePresence(doc) {
  const cutoff = Date.now() - STALE_AFTER_MS;
  doc.activeUsers = doc.activeUsers.filter((item) => new Date(item.lastSeenAt).getTime() >= cutoff);
}
