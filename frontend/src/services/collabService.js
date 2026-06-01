import api, { API_ROOT } from './api';

export const collabService = {
  events: (documentId, params) => api.get(`/collab/${documentId}/events`, { params }),
  summary: (documentId) => api.get(`/collab/${documentId}/summary`),
  stream: (documentId) => {
    const stored = localStorage.getItem('docuwise_auth');
    let token = '';

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        token = parsed?.state?.token || parsed?.token || '';
      } catch {
        token = '';
      }
    }

    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    return new EventSource(`${API_ROOT}/collab/${documentId}/stream${qs}`);
  },
};

export default collabService;
