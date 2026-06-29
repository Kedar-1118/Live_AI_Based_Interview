import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // for httpOnly cookies (refresh token)
});

// Request interceptor — inject Bearer token
api.interceptors.request.use((config) => {
  // Get token from memory (not localStorage, per spec)
  const token = window.__AUTH_TOKEN__;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401s
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Could implement refresh token logic here
      window.__AUTH_TOKEN__ = null;
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth API ─────────────────────────────────────────────

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
};

// ─── Session API ──────────────────────────────────────────

export const sessionAPI = {
  create: (data) => api.post('/sessions/create', data),
  get: (id) => api.get(`/sessions/${id}`),
  end: (id) => api.patch(`/sessions/${id}/end`),
  getBaseline: (id) => api.get(`/sessions/${id}/baseline`),
  submitCalibration: (id, formData) => api.post(`/sessions/${id}/calibration/submit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  }),
  completeCalibration: (id, data) => api.post(`/sessions/${id}/calibration/complete`, data),
  getReport: (id) => api.get(`/sessions/${id}/report`),
};

// ─── Answer API ───────────────────────────────────────────

export const answerAPI = {
  submit: (data) => api.post('/answers/submit', data),
  submitAudio: (formData) =>
    api.post('/answers/submit-audio', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // 60s timeout for audio processing
    }),
};

// ─── User API ─────────────────────────────────────────────

export const userAPI = {
  me: () => api.get('/users/me'),
  dashboard: () => api.get('/users/me/dashboard'),
  sessions: () => api.get('/users/me/sessions'),
  weakTopics: () => api.get('/users/me/weak-topics'),
};
