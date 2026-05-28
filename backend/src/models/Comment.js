const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    authorEmail: { type: String, required: true },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: { type: String, enum: ['\u{1F44D}', '\u{1F44E}', '\u{2753}', '\u{2705}'] },
      },
    ],
    aiSuggestion: { type: String, default: null },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

commentSchema.index({ document: 1, createdAt: -1 });
commentSchema.index({ document: 1, parentComment: 1 });

commentSchema.pre('save', function (next) {
  if (typeof this.content === 'string') this.content = this.content.trim();
  next();
});

commentSchema.virtual('replyCount').get(function () {
  if (!Array.isArray(this.replies)) return 0;
  return this.replies.length;
});

module.exports = mongoose.model('Comment', commentSchema);
