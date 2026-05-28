const mongoose = require('mongoose');

const collabEventSchema = new mongoose.Schema(
  {
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, default: '' },
    action: {
      type: String,
      enum: [
        'collaborator_added',
        'collaborator_removed',
        'role_changed',
        'comment_added',
        'comment_resolved',
        'comment_edited',
        'reaction_added',
        'analysis_shared',
        'document_viewed',
      ],
      required: true,
    },
    targetEmail: { type: String, default: null },
    targetRole: { type: String, default: null },
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

collabEventSchema.index({ document: 1, createdAt: -1 });
collabEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

collabEventSchema.statics.log = function (actorUser, documentId, action, extra = {}) {
  const firstName = String(actorUser?.firstName || '').trim();
  const lastName = String(actorUser?.lastName || '').trim();
  const actorName = `${firstName} ${lastName}`.trim();

  return this.create({
    document: documentId,
    actor: actorUser._id,
    actorName,
    action,
    ...extra,
  });
};

module.exports = mongoose.model('CollabEvent', collabEventSchema);
