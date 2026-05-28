import api from './api';

export const commentService = {
  add: (data) => api.post('/comments', data),
  list: (params) => api.get('/comments', { params }),
  edit: (id, content) => api.patch(`/comments/${id}`, { content }),
  resolve: (id) => api.patch(`/comments/${id}/resolve`),
  remove: (id) => api.delete(`/comments/${id}`),
  react: (id, emoji) => api.post(`/comments/${id}/reaction`, { emoji }),
};

export default commentService;
