import api from './api';

export const comparisonService = {
  create: (data) => api.post('/comparisons', data),
  get: (id) => api.get(`/comparisons/${id}`),
  list: (params) => api.get('/comparisons', { params }),
  remove: (id) => api.delete(`/comparisons/${id}`),
};

export default comparisonService;
