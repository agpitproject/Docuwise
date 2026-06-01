import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/authService';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:  null,
      token: null,
      loading: false,

      login: async (email, password) => {
        set({ loading: true });
        try {
          const res = await authService.login({ email, password });
          set({ user: res.data.data.user, token: res.data.data.token, loading: false });
          return { success: true };
        } catch (err) {
          set({ loading: false });
          return { success: false, message: err.response?.data?.message || 'Login failed' };
        }
      },

      googleLogin: async (credential) => {
        set({ loading: true });
        try {
          const res = await authService.googleLogin(credential);
          set({ user: res.data.data.user, token: res.data.data.token, loading: false });
          return { success: true };
        } catch (err) {
          set({ loading: false });
          return { success: false, message: err.response?.data?.message || 'Google login failed' };
        }
      },

      register: async (firstName, lastName, email, password) => {
        set({ loading: true });
        try {
          const res = await authService.register({ firstName, lastName, email, password });
          set({ user: res.data.data.user, token: res.data.data.token, loading: false });
          return { success: true };
        } catch (err) {
          set({ loading: false });
          return { success: false, message: err.response?.data?.message || 'Registration failed' };
        }
      },

      logout: () => {
        set({ user: null, token: null });
      },

      fetchMe: async () => {
        try {
          const res = await authService.getMe();
          set({ user: res.data.data.user });
        } catch {
          set({ user: null, token: null });
        }
      },

      updateProfile: async (data) => {
        try {
          const res = await authService.updateMe(data);
          set({ user: res.data.data.user });
          return { success: true };
        } catch (err) {
          return { success: false, message: err.response?.data?.message || 'Update failed' };
        }
      },

      isLoggedIn: () => !!get().token,
    }),
    {
      name: 'docuwise_auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
