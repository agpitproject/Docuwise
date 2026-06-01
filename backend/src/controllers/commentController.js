const Comment = require('../models/Comment');
const Document = require('../models/Document');
const CollabEvent = require('../models/CollabEvent');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { answerQuestion } = require('../services/openaiService');

const ALLOWED_REACTIONS = new Set(['\u{1F44D}', '\u{1F44E}', '\u{2753}', '\u{2705}']);

// POST /api/comments
const addComment = asyncHandler(async (req, res) => {
  const { documentId, content, parentCommentId } = req.body;
  const text = String(content || '').trim();

  if (!documentId) return sendError(res, 400, 'documentId is required');
  if (text.length < 1 || text.length > 2000) return sendError(res, 400, 'content must be between 1 and 2000 characters');

  const doc = await Document.findById(documentId);
  if (!doc) return sendError(res, 404, 'Document not found');

  const isOwner = String(doc.user) === String(req.user._id);
  const collaborator = doc.collaborators.find(
    (entry) => String(entry.email).toLowerCase() === String(req.user.email).toLowerCase()
  );
  if (!isOwner && !collaborator) return sendError(res, 403, 'You do not have access to this document');

  let parentComment = null;
  if (parentCommentId) {
    parentComment = await Comment.findById(parentCommentId);
    if (!parentComment || String(parentComment.document) !== String(doc._id)) {
      return sendError(res, 400, 'Parent comment is invalid for this document');
    }
    if (parentComment.parentComment) {
      return sendError(res, 400, 'Nested replies are not allowed');
    }
  }

  const authorName = `${String(req.user.firstName || '').trim()} ${String(req.user.lastName || '').trim()}`.trim();
  const created = await Comment.create({
    document: doc._id,
    author: req.user._id,
    authorName,
    authorEmail: req.user.email,
    content: text,
    parentComment: parentComment ? parentComment._id : null,
  });

  await CollabEvent.log(req.user, doc._id, 'comment_added', { commentId: created._id });

  if (text.length > 50 && String(doc.extractedText || '').trim()) {
    Promise.resolve()
      .then(() => answerQuestion(doc.extractedText, `Suggest a concise, helpful reply to: ${text}`))
      .then((suggestion) => Comment.findByIdAndUpdate(created._id, { aiSuggestion: suggestion }))
      .catch(() => {});
  }

  const comment = await Comment.findById(created._id).populate('author', 'firstName lastName email');
  return sendSuccess(res, 201, 'Comment added', { comment });
});

// GET /api/comments
const getComments = asyncHandler(async (req, res) => {
  const { documentId } = req.query;
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100);

  if (!documentId) return sendError(res, 400, 'documentId is required');

  const doc = await Document.findById(documentId);
  if (!doc) return sendError(res, 404, 'Document not found');

  const isOwner = String(doc.user) === String(req.user._id);
  const collaborator = doc.collaborators.find(
    (entry) => String(entry.email).toLowerCase() === String(req.user.email).toLowerCase()
  );
  if (!isOwner && !collaborator) return sendError(res, 403, 'You do not have access to this document');

  const resolvedFilter = req.query.resolved;
  const filter = { document: documentId, parentComment: null };
  if (resolvedFilter === 'true') filter.resolved = true;
  if (resolvedFilter === 'false') filter.resolved = false;

  const [topLevelComments, total] = await Promise.all([
    Comment.find(filter)
      .populate('author', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Comment.countDocuments(filter),
  ]);

  const parentIds = topLevelComments.map((entry) => entry._id);
  const replies = await Comment.find({ document: documentId, parentComment: { $in: parentIds } })
    .populate('author', 'firstName lastName email')
    .sort({ createdAt: 1 });

  const repliesMap = replies.reduce((acc, reply) => {
    const key = String(reply.parentComment);
    if (!acc[key]) acc[key] = [];
    acc[key].push(reply);
    return acc;
  }, {});

  const comments = topLevelComments.map((entry) => {
    const plain = entry.toObject();
    plain.replies = repliesMap[String(entry._id)] || [];
    plain.replyCount = plain.replies.length;
    return plain;
  });

  return sendSuccess(res, 200, 'Comments retrieved', {
    comments,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  });
});

// PATCH /api/comments/:id
const editComment = asyncHandler(async (req, res) => {
  const text = String(req.body.content || '').trim();
  if (text.length < 1 || text.length > 2000) return sendError(res, 400, 'content must be between 1 and 2000 characters');

  const comment = await Comment.findById(req.params.id);
  if (!comment) return sendError(res, 404, 'Comment not found');

  const doc = await Document.findById(comment.document);
  if (!doc) return sendError(res, 404, 'Document not found');

  const isOwner = String(doc.user) === String(req.user._id);
  const isAuthor = String(comment.author) === String(req.user._id);
  if (!isOwner && !isAuthor) return sendError(res, 403, 'You do not have permission to edit this comment');

  comment.content = text;
  comment.editedAt = new Date();
  await comment.save();

  await CollabEvent.log(req.user, doc._id, 'comment_edited', { commentId: comment._id });

  const updated = await Comment.findById(comment._id).populate('author', 'firstName lastName email');
  return sendSuccess(res, 200, 'Comment updated', { comment: updated });
});

// PATCH /api/comments/:id/resolve
const resolveComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return sendError(res, 404, 'Comment not found');

  const doc = await Document.findById(comment.document);
  if (!doc) return sendError(res, 404, 'Document not found');

  const isOwner = String(doc.user) === String(req.user._id);
  const collaborator = doc.collaborators.find(
    (entry) => String(entry.email).toLowerCase() === String(req.user.email).toLowerCase()
  );
  const role = isOwner ? 'owner' : collaborator?.role;
  if (!['owner', 'approver', 'reviewer'].includes(role)) {
    return sendError(res, 403, 'You do not have permission to resolve this comment');
  }

  comment.resolved = true;
  comment.resolvedBy = req.user._id;
  comment.resolvedAt = new Date();
  await comment.save();

  await CollabEvent.log(req.user, doc._id, 'comment_resolved', { commentId: comment._id });
  return sendSuccess(res, 200, 'Comment resolved', { comment });
});

// DELETE /api/comments/:id
const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return sendError(res, 404, 'Comment not found');

  const doc = await Document.findById(comment.document);
  if (!doc) return sendError(res, 404, 'Document not found');

  const isOwner = String(doc.user) === String(req.user._id);
  const isAuthor = String(comment.author) === String(req.user._id);
  if (!isOwner && !isAuthor) return sendError(res, 403, 'You do not have permission to delete this comment');

  await Comment.deleteMany({ $or: [{ _id: comment._id }, { parentComment: comment._id }] });
  return sendSuccess(res, 200, 'Comment deleted');
});

// POST /api/comments/:id/reaction
const addReaction = asyncHandler(async (req, res) => {
  const { emoji } = req.body;
  if (!ALLOWED_REACTIONS.has(emoji)) return sendError(res, 400, 'Invalid emoji');

  const comment = await Comment.findById(req.params.id);
  if (!comment) return sendError(res, 404, 'Comment not found');

  const doc = await Document.findById(comment.document);
  if (!doc) return sendError(res, 404, 'Document not found');

  const isOwner = String(doc.user) === String(req.user._id);
  const collaborator = doc.collaborators.find(
    (entry) => String(entry.email).toLowerCase() === String(req.user.email).toLowerCase()
  );
  if (!isOwner && !collaborator) return sendError(res, 403, 'You do not have access to this document');

  const existingIndex = comment.reactions.findIndex((reaction) => String(reaction.userId) === String(req.user._id));
  if (existingIndex >= 0 && comment.reactions[existingIndex].emoji === emoji) {
    comment.reactions.splice(existingIndex, 1);
  } else if (existingIndex >= 0) {
    comment.reactions[existingIndex].emoji = emoji;
  } else {
    comment.reactions.push({ userId: req.user._id, emoji });
  }
  await comment.save();

  await CollabEvent.log(req.user, doc._id, 'reaction_added', { commentId: comment._id, metadata: { emoji } });
  return sendSuccess(res, 200, 'Reaction updated', { comment });
});

module.exports = { addComment, getComments, editComment, resolveComment, deleteComment, addReaction };
