const express = require('express');
const router = express.Router();

const {
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
} = require('../controllers/documentController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes require auth
router.use(protect);

// POST /api/documents/upload
router.post('/upload', upload.single('file'), uploadDocument);

// GET  /api/documents
router.get('/', getDocuments);

// GET  /api/documents/:id
router.get('/:id', getDocument);

// GET /api/documents/:id/collaboration
router.get('/:id/collaboration', getCollaboration);

// PATCH /api/documents/:id/collaborators
router.patch('/:id/collaborators', updateCollaborators);

// POST /api/documents/:id/collaborators
router.post('/:id/collaborators', updateCollaborators);

// POST /api/documents/:id/comments
router.post('/:id/comments', addComment);

// POST /api/documents/:id/comments/:commentId/replies
router.post('/:id/comments/:commentId/replies', addReply);

// PATCH /api/documents/:id/comments/:commentId/resolve
router.patch('/:id/comments/:commentId/resolve', resolveComment);

// POST /api/documents/:id/presence
router.post('/:id/presence', updatePresence);

// POST /api/documents/:id/ai/summarize
router.post('/:id/ai/summarize', summarizeCollaborationDocument);

// POST /api/documents/:id/ai/improve
router.post('/:id/ai/improve', improveCollaborationText);

// DELETE /api/documents/:id
router.delete('/:id', deleteDocument);

module.exports = router;
