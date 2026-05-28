import api from './api';

// Note: comparison and collaboration API calls live in dedicated files:
// `comparisonService` (./comparisonService) and `collabService` (./collabService).
export const analysisService = {
  run:    (data)              => api.post('/analysis/run', data),
  batch:  (data)              => api.post('/analysis/batch', data),
  batchInsights: (data)       => api.post('/analysis/batch/insights', data),
  get:    (id)                => api.get(`/analysis/${id}`),
  list:   (params)            => api.get('/analysis', { params }),
  activity: (params)          => api.get('/analysis/activity', { params }),
  activityStats: ()           => api.get('/analysis/activity/stats'),
  activityStream: ()          => {
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
    return new EventSource(`/api/analysis/activity/stream${qs}`);
  },
  selectionAction: (analysisId, data) => api.post(`/analysis/${analysisId}/selection`, data),
  aiGuide: (analysisId) => api.get(`/analysis/${analysisId}/ai-guide`),
  askQA:  (analysisId, question) => api.post(`/analysis/${analysisId}/qa`, { question }),
};
