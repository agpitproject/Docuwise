import { create } from 'zustand';
import { documentService } from '../services/documentService';
import { analysisService } from '../services/analysisService';

export const useDocumentStore = create((set, get) => ({
  documents:     [],
  currentDoc:    null,
  currentAnalysis: null,
  uploadProgress: 0,
  uploading:     false,
  analysing:     false,
  loading:       false,
  error:         null,

  // ─── Upload ──────────────────────────────────────────
  uploadDocument: async (file) => {
    set({ uploading: true, uploadProgress: 0, error: null });
    try {
      const res = await documentService.upload(file, (pct) => {
        set({ uploadProgress: pct });
      });
      const doc = res.data.data.document;
      set((state) => ({
        currentDoc: doc,
        documents: [doc, ...state.documents.filter((item) => item._id !== doc._id)],
        uploading: false,
        uploadProgress: 100,
        error: null,
      }));
      return { success: true, document: doc };
    } catch (err) {
      const message = getUploadErrorMessage(err, file);
      set({ uploading: false, uploadProgress: 0, error: message });
      return { success: false, message };
    }
  },

  // ─── List ─────────────────────────────────────────────
  fetchDocuments: async () => {
    set({ loading: true });
    try {
      const res = await documentService.list({ limit: 50 });
      set({ documents: res.data.data.documents, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  // ─── Delete ──────────────────────────────────────────
  deleteDocument: async (id) => {
    try {
      await documentService.delete(id);
      set((state) => ({
        documents: state.documents.filter((d) => d._id !== id),
        analyses: state.analyses.filter((a) => a.document?._id !== id),
        currentDoc: state.currentDoc?._id === id ? null : state.currentDoc,
        currentAnalysis: state.currentAnalysis?.document?._id === id ? null : state.currentAnalysis,
      }));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' };
    }
  },

  // ─── Run analysis ────────────────────────────────────
  runAnalysis: async (documentId, mode, language = 'en') => {
    set({ analysing: true, currentAnalysis: null, error: null });
    try {
      const res = await analysisService.run({ documentId, mode, language });
      const { analysisId } = res.data.data;

      // Poll until completed
      const result = await get().pollAnalysis(analysisId);
      set({ analysing: false });
      return { success: true, analysis: result };
    } catch (err) {
      set({ analysing: false, error: err.response?.data?.message || 'Analysis failed' });
      return { success: false, message: err.response?.data?.message || 'Analysis failed' };
    }
  },

  // ─── Poll until done ─────────────────────────────────
  pollAnalysis: (analysisId) =>
    new Promise((resolve, reject) => {
      const MAX = 30; // max 30 polls × 2s = 60s timeout
      let attempts = 0;

      const poll = async () => {
        try {
          const res = await analysisService.get(analysisId);
          const analysis = res.data.data.analysis;
          set({ currentAnalysis: analysis });

          if (analysis.status === 'completed') return resolve(analysis);
          if (analysis.status === 'failed')    return reject(new Error(analysis.errorMessage));
          if (++attempts >= MAX)               return reject(new Error('Analysis timed out'));

          setTimeout(poll, 2000);
        } catch (err) {
          reject(err);
        }
      };
      poll();
    }),

  // ─── Fetch existing analysis ──────────────────────────
  fetchAnalysis: async (analysisId) => {
    set({ loading: true });
    try {
      const res = await analysisService.get(analysisId);
      set({ currentAnalysis: res.data.data.analysis, loading: false });
    } catch {
      set({ currentAnalysis: null, loading: false });
    }
  },

  // ─── Fetch all analyses ───────────────────────────────
  analyses: [],
  fetchAnalyses: async () => {
    set({ loading: true });
    try {
      const res = await analysisService.list({ limit: 50, status: 'processing,completed,failed' });
      set({
        analyses: (res.data.data.analyses || []).filter((analysis) => analysis.document),
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  setCurrentDoc: (doc) => set({ currentDoc: doc }),
  clearCurrent:  ()    => set({ currentDoc: null, currentAnalysis: null, uploadProgress: 0 }),
}));

function getUploadErrorMessage(error, file) {
  const message = extractErrorMessage(error);
  const lower = message.toLowerCase();
  const fileName = String(file?.name || '').toLowerCase();
  const isPdf = fileName.endsWith('.pdf');

  if (error?.response?.status === 413 || lower.includes('too large') || lower.includes('max size')) {
    return 'File is too large. Please upload a smaller document.';
  }

  if (lower.includes('unsupported file type') || (lower.includes('txt') && lower.includes('pdf') && lower.includes('docx'))) {
    return 'Unsupported file type. Please upload a TXT, PDF, or DOCX file.';
  }

  if (
    lower.includes('no selectable text') ||
    lower.includes('no readable text') ||
    lower.includes('no extractable text') ||
    lower.includes('ocr is not supported')
  ) {
    return 'No readable text was found in this document. Scanned PDFs need OCR, which is not supported yet.';
  }

  if (isPdf && (lower.includes('could not extract') || lower.includes('invalid pdf') || lower.includes('pdf'))) {
    return 'Could not read this PDF. Please try a valid text-based PDF.';
  }

  if (lower.includes('could not extract') || lower.includes('extraction')) {
    return 'Could not extract readable text from this file.';
  }

  return message || 'Upload failed. Please try again.';
}

function extractErrorMessage(error) {
  const data = error?.response?.data;
  const firstError = Array.isArray(data?.errors) ? data.errors[0] : null;
  return (
    data?.message ||
    data?.error ||
    firstError?.message ||
    (typeof firstError === 'string' ? firstError : null) ||
    error?.message ||
    'Upload failed. Please try again.'
  );
}
