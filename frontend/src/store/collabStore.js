import { create } from 'zustand';
import { commentService } from '../services/commentService';
import { collabService } from '../services/collabService';

const initialState = {
  comments: [],
  events: [],
  summary: null,
  loading: false,
  submitting: false,
  currentDocumentId: null,
  sseConnected: false,
  filters: { resolved: false },
  page: 1,
  totalPages: 1,
  eventSource: null,
};

function upsertCommentInTree(comments, id, updates) {
  return comments.map((comment) => {
    if (comment._id === id || comment.id === id) {
      return { ...comment, ...updates };
    }
    const replies = Array.isArray(comment.replies) ? comment.replies : [];
    const updatedReplies = replies.map((reply) => (
      reply._id === id || reply.id === id ? { ...reply, ...updates } : reply
    ));
    return updatedReplies !== replies ? { ...comment, replies: updatedReplies } : comment;
  });
}

export const useCollabStore = create((set, get) => ({
  ...initialState,

  upsertComment: (id, updates) => {
    set((state) => ({ comments: upsertCommentInTree(state.comments, id, updates) }));
  },

  init: async (documentId) => {
    set({ currentDocumentId: documentId });
    await Promise.all([
      get().fetchComments(1),
      get().fetchSummary(),
      get().fetchEvents(),
    ]);
    get().connectCollabSSE();
  },

  cleanup: () => {
    get().disconnectCollabSSE();
    set({ ...initialState });
  },

  fetchComments: async (page = 1) => {
    const { currentDocumentId, filters } = get();
    if (!currentDocumentId) return;

    set({ loading: true });
    try {
      const res = await commentService.list({
        documentId: currentDocumentId,
        page,
        resolved: filters.resolved,
      });
      const data = res.data?.data || {};
      set({
        comments: data.comments || [],
        page: data.page || page,
        totalPages: data.totalPages || 1,
        loading: false,
      });
    } catch {
      set({ loading: false, comments: page > 1 ? get().comments : [] });
    }
  },

  addComment: async (content, parentCommentId = null) => {
    const { currentDocumentId } = get();
    if (!currentDocumentId) return { success: false, message: 'No document selected' };

    set({ submitting: true });
    try {
      const res = await commentService.add({ documentId: currentDocumentId, content, parentCommentId });
      const comment = res.data?.data?.comment;

      set((state) => {
        if (!parentCommentId) {
          return { comments: [comment, ...state.comments], submitting: false };
        }
        const comments = state.comments.map((entry) => {
          if (entry._id !== parentCommentId && entry.id !== parentCommentId) return entry;
          return { ...entry, replies: [...(entry.replies || []), comment] };
        });
        return { comments, submitting: false };
      });

      get().fetchSummary();
      return { success: true, comment };
    } catch (err) {
      set({ submitting: false });
      return { success: false, message: err.response?.data?.message || 'Comment failed' };
    }
  },

  editComment: async (id, content) => {
    set({ submitting: true });
    try {
      const res = await commentService.edit(id, content);
      const comment = res.data?.data?.comment;
      set((state) => ({
        comments: upsertCommentInTree(state.comments, id, comment),
        submitting: false,
      }));
      return { success: true };
    } catch (err) {
      set({ submitting: false });
      return { success: false, message: err.response?.data?.message || 'Action failed' };
    }
  },

  resolveComment: async (id) => {
    set({ submitting: true });
    try {
      const res = await commentService.resolve(id);
      const comment = res.data?.data?.comment;
      set((state) => ({
        comments: upsertCommentInTree(state.comments, id, comment),
        submitting: false,
      }));
      get().fetchSummary();
      return { success: true };
    } catch (err) {
      set({ submitting: false });
      return { success: false, message: err.response?.data?.message || 'Action failed' };
    }
  },

  removeComment: async (id) => {
    set({ submitting: true });
    try {
      await commentService.remove(id);
      set((state) => ({
        comments: state.comments
          .filter((entry) => entry._id !== id && entry.id !== id)
          .map((entry) => ({
            ...entry,
            replies: (entry.replies || []).filter((reply) => reply._id !== id && reply.id !== id),
          })),
        submitting: false,
      }));
      get().fetchSummary();
      return { success: true };
    } catch (err) {
      set({ submitting: false });
      return { success: false, message: err.response?.data?.message || 'Action failed' };
    }
  },

  addReaction: async (id, emoji) => {
    try {
      const res = await commentService.react(id, emoji);
      const comment = res.data?.data?.comment;
      set((state) => ({ comments: upsertCommentInTree(state.comments, id, comment) }));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Action failed' };
    }
  },

  fetchEvents: async () => {
    const { currentDocumentId } = get();
    if (!currentDocumentId) return;

    try {
      const res = await collabService.events(currentDocumentId, { page: 1, limit: 30 });
      set({ events: res.data?.data?.events || [] });
    } catch {
      // no-op
    }
  },

  fetchSummary: async () => {
    const { currentDocumentId } = get();
    if (!currentDocumentId) return;

    try {
      const res = await collabService.summary(currentDocumentId);
      set({ summary: res.data?.data || null });
    } catch {
      // no-op
    }
  },

  setFilter: async (key, val) => {
    set((state) => ({ filters: { ...state.filters, [key]: val }, page: 1 }));
    await get().fetchComments(1);
  },

  connectCollabSSE: () => {
    const { currentDocumentId, eventSource } = get();
    if (!currentDocumentId || eventSource) return;

    const source = collabService.stream(currentDocumentId);
    source.onopen = () => set({ sseConnected: true });

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'collab_event' && payload.item) {
          set((state) => ({ events: [payload.item, ...state.events] }));
          return;
        }
        if (payload?.type === 'comment_update') {
          get().fetchComments(1);
        }
      } catch {
        // no-op
      }
    };

    source.onerror = () => {
      const active = get().eventSource;
      if (active) active.close();
      set({ eventSource: null, sseConnected: false });
    };

    set({ eventSource: source });
  },

  disconnectCollabSSE: () => {
    const source = get().eventSource;
    if (source) source.close();
    set({ eventSource: null, sseConnected: false });
  },
}));
