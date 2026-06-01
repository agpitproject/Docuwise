const Document = require('../models/Document');
const { sendError } = require('../utils/apiResponse');

const checkCollaboratorAccess = async (req, res, next) => {
  const documentId = req.params.documentId || req.body.documentId;
  if (!documentId) return sendError(res, 400, 'documentId is required');

  const doc = await Document.findById(documentId);
  if (!doc) return sendError(res, 404, 'Document not found');

  const isOwner = String(doc.user) === String(req.user._id);
  const collaborator = doc.collaborators.find(
    (entry) => String(entry.email).toLowerCase() === String(req.user.email).toLowerCase()
  );

  if (!isOwner && !collaborator) {
    return sendError(res, 403, 'You do not have access to this document');
  }

  req.document = doc;
  req.userRole = isOwner ? 'owner' : collaborator.role;
  return next();
};

module.exports = { checkCollaboratorAccess };
