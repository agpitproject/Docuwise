import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

const getStoredToken = () => {
  const stored = localStorage.getItem('docuwise_auth');
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);
    return parsed?.state?.token || parsed?.token || null;
  } catch {
    localStorage.removeItem('docuwise_auth');
    return null;
  }
};

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global response error handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('docuwise_auth');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;
