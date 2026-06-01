import { create } from 'zustand';
import { comparisonService } from '../services/comparisonService';

export const useComparisonStore = create((set, get) => ({
  comparisons: [],
  currentComparison: null,
  loading: false,
  comparing: false,
  error: null,

  // ─── Create comparison ─────────────────────────────────
  createComparison: async (documentAId, documentBId, mode = 'full') => {
    set({ comparing: true, currentComparison: null, error: null });
    try {
      const res = await comparisonService.create({ documentAId, documentBId, mode });
      const { comparisonId } = res.data.data;

      const comparison = await get().pollComparison(comparisonId);
      set({ comparing: false });
      return { success: true, comparison };
    } catch (err) {
      set({ comparing: false, error: err.response?.data?.message || 'Comparison failed' });
      return { success: false, message: err.response?.data?.message || 'Comparison failed' };
    }
  },

  // ─── Poll until done ───────────────────────────────────
  pollComparison: (comparisonId) =>
    new Promise((resolve, reject) => {
      const MAX = 30; // max 30 polls × 2s = 60s timeout
      let attempts = 0;

      const poll = async () => {
        try {
          const res = await comparisonService.get(comparisonId);
          const comparison = res.data.data.comparison;
          set({ currentComparison: comparison });

          if (comparison.status === 'completed') return resolve(comparison);
          if (comparison.status === 'failed') return reject(new Error(comparison.errorMessage));
          if (++attempts >= MAX) return reject(new Error('Comparison timed out'));

          setTimeout(poll, 2000);
        } catch (err) {
          reject(err);
        }
      };
      poll();
    }),

  // ─── List ──────────────────────────────────────────────
  fetchComparisons: async () => {
    set({ loading: true });
    try {
      const res = await comparisonService.list({ limit: 50 });
      set({ comparisons: res.data.data.comparisons || [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  // ─── Fetch single comparison ───────────────────────────
  fetchComparison: async (comparisonId) => {
    set({ loading: true });
    try {
      const res = await comparisonService.get(comparisonId);
      set({ currentComparison: res.data.data.comparison, loading: false });
    } catch {
      set({ currentComparison: null, loading: false });
    }
  },

  // ─── Delete comparison ─────────────────────────────────
  removeComparison: async (comparisonId) => {
    try {
      await comparisonService.remove(comparisonId);
      set((state) => ({
        comparisons: state.comparisons.filter((comparison) => comparison._id !== comparisonId),
        currentComparison: state.currentComparison?._id === comparisonId ? null : state.currentComparison,
      }));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' };
    }
  },

  clearCurrent: () => set({ currentComparison: null }),
}));
