import { create } from 'zustand';
import { analysisService } from '../services/analysisService';

const defaultFilters = { status: '', mode: '', dateFrom: '', dateTo: '' };

function upsertItem(items, item) {
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [item, ...items];
  return items.map((entry, entryIndex) => (entryIndex === index ? item : entry));
}

export const useActivityStore = create((set, get) => ({
  items: [],
  stats: {},
  page: 1,
  totalPages: 1,
  hasMore: false,
  loading: false,
  statsLoading: false,
  filters: defaultFilters,
  sseConnected: false,
  eventSource: null,

  fetchActivity: async (page = 1) => {
    set({ loading: true });
    try {
      const { filters } = get();
      const params = {
        page,
        limit: 20,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.mode ? { mode: filters.mode } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
      };
      const res = await analysisService.activity(params);
      const data = res.data?.data || {};
      const nextItems = data.items || [];

      set((state) => ({
        items: page > 1 ? [...state.items, ...nextItems] : nextItems,
        page: data.page || page,
        totalPages: data.totalPages || 1,
        hasMore: Boolean(data.hasMore),
        loading: false,
      }));
    } catch {
      set({ loading: false, items: page > 1 ? get().items : [] });
    }
  },

  fetchMore: async () => {
    const { loading, hasMore, page, fetchActivity } = get();
    if (loading || !hasMore) return;
    await fetchActivity(page + 1);
  },

  fetchStats: async () => {
    set({ statsLoading: true });
    try {
      const res = await analysisService.activityStats();
      set({ stats: res.data?.data || {}, statsLoading: false });
    } catch {
      set({ statsLoading: false });
    }
  },

  setFilter: async (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
      page: 1,
      hasMore: false,
    }));
    await get().fetchActivity(1);
  },

  clearFilters: async () => {
    set({ filters: { ...defaultFilters }, page: 1, hasMore: false });
    await get().fetchActivity(1);
  },

  connectSSE: () => {
    const existing = get().eventSource;
    if (existing) return;

    const source = analysisService.activityStream();

    source.onopen = () => {
      set({ sseConnected: true });
    };

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { type, item } = payload || {};

        if (type === 'activity_update' && item?.id) {
          set((state) => ({ items: upsertItem(state.items, item) }));
          return;
        }

        if (type === 'activity_snapshot') {
          const snapshotItems = Array.isArray(item) ? item : [];
          const processingIds = new Set(snapshotItems.map((entry) => entry.id));
          set((state) => ({
            items: [
              ...snapshotItems,
              ...state.items.filter((entry) => !processingIds.has(entry.id) && entry.status !== 'processing' && entry.status !== 'pending'),
            ],
          }));
        }
      } catch {
        // no-op
      }
    };

    source.onerror = () => {
      const activeSource = get().eventSource;
      if (activeSource) activeSource.close();
      set({ eventSource: null, sseConnected: false });
    };

    set({ eventSource: source });
  },

  disconnectSSE: () => {
    const source = get().eventSource;
    if (source) source.close();
    set({ eventSource: null, sseConnected: false });
  },
}));
