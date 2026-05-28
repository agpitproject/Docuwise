const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    originalName: { type: String, required: true },
    storedName:   { type: String, required: true },
    filePath:     { type: String, required: true },
    fileType:     { type: String, enum: ['txt', 'pdf', 'docx'], required: true },
    fileSize:     { type: Number, required: true }, // bytes
    extractedText:{ type: String, default: '' },
    wordCount:    { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'done', 'error'],
      default: 'uploaded',
    },
    collaborators: {
      type: [
        {
          name: { type: String, required: true, trim: true },
          email: { type: String, required: true, trim: true, lowercase: true },
          role: { type: String, enum: ['editor', 'reviewer', 'approver'], default: 'editor', trim: true },
          invitedAt: { type: Date, default: Date.now },
          status: { type: String, enum: ['invited', 'active'], default: 'invited' },
        },
      ],
      default: [],
      validate: {
        validator: (value) => value.length <= 3,
        message: 'A document can have up to 3 collaborators.',
      },
    },
    comments: {
      type: [
        {
          author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          authorName: { type: String, required: true, trim: true },
          text: { type: String, required: true, trim: true },
          resolved: { type: Boolean, default: false },
          replies: [
            {
              author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
              authorName: { type: String, required: true, trim: true },
              text: { type: String, required: true, trim: true },
              createdAt: { type: Date, default: Date.now },
            },
          ],
          createdAt: { type: Date, default: Date.now },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    activity: {
      type: [
        {
          type: { type: String, enum: ['edit', 'comment', 'invite', 'resolve', 'ai'], required: true },
          actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          actorName: { type: String, required: true, trim: true },
          message: { type: String, required: true, trim: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    activeUsers: {
      type: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          name: { type: String, required: true, trim: true },
          role: { type: String, enum: ['owner', 'editor', 'reviewer', 'approver'], default: 'editor' },
          status: { type: String, enum: ['online', 'editing'], default: 'online' },
          lastSeenAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Auto-delete file path info if user privacy.autoDeleteFiles
documentSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // 30-day TTL

module.exports = mongoose.model('Document', documentSchema);
