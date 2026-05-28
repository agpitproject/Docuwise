import api from './api';

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  googleLogin: (token) => api.post('/auth/google', { token }),
  getMe:    ()     => api.get('/auth/me'),
  updateMe: (data) => api.patch('/auth/me', data),
  generateApiKey: () => api.post('/auth/api-key'),
};
