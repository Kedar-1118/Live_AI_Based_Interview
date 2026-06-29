import { create } from 'zustand';
import { authAPI } from '../services/api';

const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login({ email, password });
      const { access_token, user } = response.data;

      // Store token in memory (per spec — not localStorage)
      window.__AUTH_TOKEN__ = access_token;

      set({
        user,
        token: access_token,
        isAuthenticated: true,
        isLoading: false,
      });

      return true;
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.register({ email, password, name });
      const { access_token, user } = response.data;

      window.__AUTH_TOKEN__ = access_token;

      set({
        user,
        token: access_token,
        isAuthenticated: true,
        isLoading: false,
      });

      return true;
    } catch (error) {
      const message = error.response?.data?.detail || 'Registration failed';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  logout: () => {
    window.__AUTH_TOKEN__ = null;
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.refresh();
      const { access_token, user } = response.data;

      window.__AUTH_TOKEN__ = access_token;

      set({
        user,
        token: access_token,
        isAuthenticated: true,
        isLoading: false,
      });

      return true;
    } catch (error) {
      window.__AUTH_TOKEN__ = null;
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
