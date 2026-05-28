import api from './api';

export const documentService = {
  upload: (file, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (!onProgress) return;
        const total = e.total || file?.size || 0;
        if (!total) return;
        onProgress(Math.max(0, Math.min(100, Math.round((e.loaded / total) * 100))));
      },
    });
  },
  list:   (params) => api.get('/documents', { params }),
  get:    (id)     => api.get(`/documents/${id}`),
  collaboration: (id) => api.get(`/documents/${id}/collaboration`),
  updateCollaborators: (id, collaborators) => api.patch(`/documents/${id}/collaborators`, { collaborators }),
  addComment: (id, text) => api.post(`/documents/${id}/comments`, { text }),
  addReply: (id, commentId, text) => api.post(`/documents/${id}/comments/${commentId}/replies`, { text }),
  resolveComment: (id, commentId, resolved) => api.patch(`/documents/${id}/comments/${commentId}/resolve`, { resolved }),
  presence: (id, status = 'online') => api.post(`/documents/${id}/presence`, { status }),
  summarize: (id) => api.post(`/documents/${id}/ai/summarize`),
  improveText: (id, text) => api.post(`/documents/${id}/ai/improve`, { text }),
  delete: (id)     => api.delete(`/documents/${id}`),
};
