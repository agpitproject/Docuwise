import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Clock3,
  Download,
  FileText,
  Info,
  ListChecks,
  Lock,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Tags,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { documentService } from '../../services/documentService';
import { analysisService } from '../../services/analysisService';
import { useAuthStore } from '../../store/authStore';
import { formatDate, formatFileSize } from '../../utils/formatters';
import { validateFile } from '../../utils/validators';

const AUDIT_KEY = 'docuwise_batch_audit_v1';
const HISTORY_KEY = 'docuwise_batch_history_v1';

const ANALYSIS_TYPES = [
  {
    key: 'summarization',
    title: 'Executive summary',
    description: 'Focus the combined report on purpose, outcomes, and the most material changes.',
    icon: Sparkles,
  },
  {
    key: 'sentiment',
    title: 'Tone and risk',
    description: 'Focus the combined report on sentiment, pressure points, and risk signals.',
    icon: Brain,
  },
  {
    key: 'keywords',
    title: 'Key terms',
    description: 'Focus the combined report on recurring phrases, entities, and themes.',
    icon: Tags,
  },
];

export default function BatchUploadWorkspace() {
  const { user } = useAuthStore();
  const backendBatchLocked = user?.plan === 'free';

  const [items, setItems] = useState([]);
  const [analysisType, setAnalysisType] = useState('summarization');
  const [running, setRunning] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [detailTab, setDetailTab] = useState('overview');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  const [auditTrail, setAuditTrail] = useState(() => loadJson(AUDIT_KEY, []));
  const [history, setHistory] = useState(() => loadJson(HISTORY_KEY, []));

  const itemsRef = useRef(items);
  const selectedItemIdRef = useRef(selectedItemId);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    selectedItemIdRef.current = selectedItemId;
  }, [selectedItemId]);

  useEffect(() => {
    persistJson(AUDIT_KEY, auditTrail.slice(0, 120));
  }, [auditTrail]);

  useEffect(() => {
    persistJson(HISTORY_KEY, history.slice(0, 20));
  }, [history]);

  useEffect(() => {
    if (!items.length) {
      setSelectedItemId('');
      return;
    }

    if (selectedItemId && items.some((item) => item.id === selectedItemId)) return;
    const preferred = items.find((item) => item.status === 'completed' && item.analysis) || items[0];
    setSelectedItemId(preferred?.id || '');
  }, [items, selectedItemId]);

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((item) => item.status === 'completed').length;
    const failed = items.filter((item) => item.status === 'failed').length;
    const uploading = items.filter((item) => item.status === 'uploading').length;
    const processing = items.filter((item) => item.status === 'processing').length;
    const waiting = items.filter((item) => item.status === 'pending').length;

    const uploadProgress = total
      ? Math.round(items.reduce((sum, item) => sum + (item.uploadProgress || 0), 0) / total)
      : 0;

    const processingProgress = total
      ? Math.round(items.reduce((sum, item) => sum + (item.processingProgress || (item.status === 'completed' ? 100 : 0)), 0) / total)
      : 0;

    return { total, completed, failed, waiting, uploading, processing, uploadProgress, processingProgress };
  }, [items]);

  const visibleItems = useMemo(
    () => filterItems(items, searchQuery, statusFilter, sortBy),
    [items, searchQuery, statusFilter, sortBy]
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) || visibleItems[0] || null,
    [items, selectedItemId, visibleItems]
  );
  const selectedAnalysis = selectedItem?.analysis || null;
  const selectedItemAudit = useMemo(
    () => auditTrail.filter((entry) => !selectedItem?.id || entry.itemId === selectedItem.id),
    [auditTrail, selectedItem]
  );

  const onDrop = (acceptedFiles, fileRejections = []) => {
    if (fileRejections.length > 0) {
      toast.error(getDropzoneErrorMessage(fileRejections));
      return;
    }

    const queued = [];
    acceptedFiles.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        toast.error(`${file.name}: ${error}`);
        return;
      }

      const id = makeId();
      queued.push({
        id,
        file,
        status: 'pending',
        uploadProgress: 0,
        processingProgress: 0,
        error: null,
        errorStage: null,
        document: null,
        analysis: null,
      });
    });

    if (!queued.length) return;

    setItems((current) => [...current, ...queued]);
    setInsights(null);
    if (!selectedItemIdRef.current) setSelectedItemId(queued[0].id);

    queued.forEach((entry) => {
      pushAudit(setAuditTrail, {
        type: 'queued',
        itemId: entry.id,
        fileName: entry.file.name,
        message: `${entry.file.name} was added to the queue.`,
      });
    });
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: true,
    noClick: true,
    disabled: running,
  });

  const updateItem = (itemId, patch) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) } : item))
    );
  };

  const removeItem = (itemId) => {
    if (running) return;
    const item = itemsRef.current.find((entry) => entry.id === itemId);
    if (item) {
      pushAudit(setAuditTrail, {
        type: 'removed',
        itemId,
        fileName: item.file.name,
        message: `Removed ${item.file.name} from the queue.`,
      });
    }
    setItems((current) => current.filter((item) => item.id !== itemId));
    if (selectedItemIdRef.current === itemId) {
      setSelectedItemId('');
      setIsDetailOpen(false);
    }
    setInsights(null);
  };

  const clearAll = () => {
    if (running) return;
    if (itemsRef.current.length > 0) {
      pushAudit(setAuditTrail, {
        type: 'cleared',
        message: `Cleared ${itemsRef.current.length} queued file${itemsRef.current.length === 1 ? '' : 's'}.`,
      });
    }
    setItems([]);
    setInsights(null);
    setSelectedItemId('');
    setIsDetailOpen(false);
  };

  const pollAnalysis = async (analysisId, itemId) => {
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const res = await analysisService.get(analysisId);
      const analysis = res.data.data.analysis;

      if (analysis.status === 'completed') {
        updateItem(itemId, {
          processingProgress: 100,
          analysis,
          status: 'completed',
          error: null,
          errorStage: null,
        });
        pushAudit(setAuditTrail, {
          type: 'completed',
          itemId,
          fileName: analysis.document?.originalName || itemsRef.current.find((entry) => entry.id === itemId)?.file?.name || 'Document',
          message: `Analysis completed for ${analysis.document?.originalName || 'a document'}.`,
        });
        return analysis;
      }

      if (analysis.status === 'failed') {
        throw new Error(analysis.errorMessage || 'Analysis failed');
      }

      updateItem(itemId, {
        processingProgress: Math.min(95, 45 + attempt * 6),
      });

      await sleep(2500);
    }

    throw new Error('Analysis timed out');
  };

  const processItem = async (item) => {
    const language = user?.defaultLanguage || 'en';

    updateItem(item.id, {
      status: 'uploading',
      uploadProgress: 0,
      processingProgress: 0,
      error: null,
      errorStage: null,
    });

    let document = null;

    try {
      const uploadResponse = await documentService.upload(item.file, (pct) => {
        updateItem(item.id, { uploadProgress: pct });
      });

      document = uploadResponse.data.data.document;
      setSelectedItemId((current) => current || item.id);
      updateItem(item.id, {
        status: 'processing',
        uploadProgress: 100,
        processingProgress: 5,
        document,
      });
      pushAudit(setAuditTrail, {
        type: 'uploaded',
        itemId: item.id,
        fileName: item.file.name,
        message: `${item.file.name} uploaded successfully.`,
      });
    } catch (error) {
      const message = error.response?.data?.message || 'Upload failed';
      updateItem(item.id, {
        status: 'failed',
        errorStage: 'upload',
        error: message,
      });
      pushAudit(setAuditTrail, {
        type: 'failed',
        itemId: item.id,
        fileName: item.file.name,
        message: `Upload failed for ${item.file.name}: ${message}`,
      });
      throw error;
    }

    try {
      const runResponse = await analysisService.run({
        documentId: document._id,
        mode: 'all',
        language,
      });

      const analysisId = runResponse.data.data.analysisId;
      const analysis = await pollAnalysis(analysisId, item.id);
      return { document, analysis };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Analysis failed';
      updateItem(item.id, {
        status: 'failed',
        errorStage: 'analysis',
        error: message,
      });
      pushAudit(setAuditTrail, {
        type: 'failed',
        itemId: item.id,
        fileName: item.file.name,
        message: `Analysis failed for ${item.file.name}: ${message}`,
      });
      throw error;
    }
  };

  const refreshInsights = async (latestResults = []) => {
    const completedFiles = collectInsightFiles(itemsRef.current, latestResults);
    if (completedFiles.length === 0) {
      setInsights(null);
      return;
    }

    setInsightsLoading(true);
    try {
      const response = await analysisService.batchInsights({
        analysisType,
        files: completedFiles,
      });
      setInsights(response.data.data.insights);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Batch insights could not be generated.');
    } finally {
      setInsightsLoading(false);
    }
  };

  const runBatch = async () => {
    const queue = items.filter((item) => item.status === 'pending' || item.status === 'failed');
    if (queue.length === 0) {
      toast.error('Add at least one file before starting the batch.');
      return;
    }

    setRunning(true);
    setInsights(null);
    pushAudit(setAuditTrail, {
      type: 'batch_start',
      message: `Batch processing started for ${queue.length} file${queue.length === 1 ? '' : 's'} using ${analysisLabel(analysisType)} focus.`,
    });

    try {
      let failures = 0;
      const completedResults = [];

      for (const item of queue) {
        if (item.status === 'completed') continue;
        try {
          const result = await processItem(item);
          if (result) completedResults.push(result);
        } catch {
          failures += 1;
        }
      }

      await refreshInsights(completedResults);
      if (completedResults.length > 0) {
        setHistory((current) => [
          {
            id: makeId(),
            createdAt: new Date().toISOString(),
            analysisType,
            total: queue.length,
            completed: completedResults.length,
            failed: failures,
            summary: `Processed ${completedResults.length} document${completedResults.length === 1 ? '' : 's'} with ${failures} failure${failures === 1 ? '' : 's'}.`,
          },
          ...current,
        ]);
      }
      pushAudit(setAuditTrail, {
        type: 'batch_complete',
        message: `Batch processing finished with ${completedResults.length} success${completedResults.length === 1 ? '' : 'es'} and ${failures} failure${failures === 1 ? '' : 's'}.`,
      });

      if (failures > 0) {
        toast.error(`Batch finished with ${failures} failed file${failures === 1 ? '' : 's'}.`);
      } else {
        toast.success('Batch processing completed.');
      }
    } finally {
      setRunning(false);
    }
  };

  const retryItem = async (itemId) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item || running) return;

    setRunning(true);
    pushAudit(setAuditTrail, {
      type: 'retry',
      itemId,
      fileName: item.file.name,
      message: `Retrying ${item.file.name}.`,
    });

    try {
      const result = await processItem(item);
      await refreshInsights(result ? [result] : []);
      toast.success(`${item.file.name} processed again.`);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Retry failed.');
    } finally {
      setRunning(false);
    }
  };

  const openItemDetails = (itemId) => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    setSelectedItemId(itemId);
    setDetailTab('overview');
    setIsDetailOpen(true);
  };

  const closeItemDetails = () => {
    setIsDetailOpen(false);
  };

  useEffect(() => {
    if (running) return;
    if (!itemsRef.current.some((item) => item.status === 'completed' && item.analysis)) return;
    refreshInsights();
    // Recompute the combined report when the primary focus changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisType]);

  const allDone = items.length > 0 && stats.completed + stats.failed === items.length && !running && !insightsLoading;

  return (
    <>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <section className="space-y-6">
          <div className="rounded-2xl border border-black/[0.08] bg-white p-6 md:p-7 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="section-eyebrow mb-2">Batch upload</p>
                <h2 className="font-serif text-[28px]">Batch upload workspace</h2>
                <p className="text-[13px] text-muted mt-1 max-w-3xl">
                  Upload many documents at once, run the same per-document analysis users get in single upload, and review the results in a compact dashboard.
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-outline" onClick={open} disabled={running}>
                  <Upload size={14} />
                  Add files
                </button>
                <button type="button" className="btn-primary" onClick={runBatch} disabled={running || items.length === 0}>
                  {running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {running ? 'Processing...' : 'Start batch'}
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <BehaviorNote
                icon={<ListChecks size={16} />}
                title="Summary first"
                text="See compact status cards and queue rows first. Open the drawer only when you need deep detail."
              />
              <BehaviorNote
                icon={backendBatchLocked ? <Lock size={16} /> : <Info size={16} />}
                title={backendBatchLocked ? 'Plan-limited batch endpoint' : 'Batch workflow ready'}
                text={backendBatchLocked
                  ? 'Your current free plan still supports the queue view, upload states, and per-file analysis.'
                  : 'Your plan can run the batch pipeline, while the dashboard stays focused on fast document navigation.'}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
            <div
              {...getRootProps()}
              className={`rounded-[24px] border-2 border-dashed p-7 text-center transition-all select-none ${
                isDragActive ? 'border-accent bg-accent-light' : 'border-black/15 bg-[#fcfbf8] hover:border-accent/60'
              } ${running ? 'opacity-70 pointer-events-none' : ''}`}
            >
              <input {...getInputProps()} />
              <div className="mx-auto w-14 h-14 rounded-2xl bg-white border border-black/[0.08] flex items-center justify-center mb-4 shadow-sm">
                <CloudUpload size={24} className="text-muted" />
              </div>
              <h3 className="text-[18px] font-semibold mb-1">
                {isDragActive ? 'Drop files to add them to the queue' : 'Drag and drop PDF, DOCX, or TXT files'}
              </h3>
              <p className="text-[13px] text-muted mb-5">
                Supported formats: PDF, DOCX, and TXT up to 50MB each.
              </p>
              <button
                type="button"
                className="btn-primary px-5 py-2.5"
                onClick={(event) => {
                  event.stopPropagation();
                  open();
                }}
              >
                Choose files
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[16px] font-semibold">Analysis focus</h3>
                <p className="text-[13px] text-muted">Choose the primary lens for the combined batch insight.</p>
              </div>
              <span className="badge bg-surface2 text-ink">{items.length} file{items.length === 1 ? '' : 's'} queued</span>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              {ANALYSIS_TYPES.map((option) => {
                const Icon = option.icon;
                const active = analysisType === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setAnalysisType(option.key)}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      active ? 'border-accent bg-accent-light shadow-sm' : 'border-black/10 bg-white hover:border-accent/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${active ? 'bg-accent text-white' : 'bg-surface2 text-muted'}`}>
                        <Icon size={16} />
                      </span>
                      <span className="text-[14px] font-semibold">{option.title}</span>
                    </div>
                    <p className="text-[12px] text-muted leading-5">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
            <div className="sticky top-24 z-10 -mx-5 md:-mx-6 px-5 md:px-6 pb-4 pt-1 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-black/[0.06]">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-[16px] font-semibold">Queue</h3>
                  <p className="text-[13px] text-muted">Compact cards first. Open a drawer for the full analysis.</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost" onClick={clearAll} disabled={running || items.length === 0}>
                    Clear all
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.3fr_160px_160px]">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wide text-muted mb-2 block">Search</span>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      className="input pl-9"
                      placeholder="Search by file name, type, keyword, or summary"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-[11px] uppercase tracking-wide text-muted mb-2 block">Status</span>
                  <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All files</option>
                    <option value="pending">Waiting</option>
                    <option value="uploading">Uploading</option>
                    <option value="processing">Analyzing</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] uppercase tracking-wide text-muted mb-2 block">Sort</span>
                  <select className="input" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="status">Status</option>
                    <option value="name">File name</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="pt-4">
              {items.length === 0 ? (
                <EmptyList />
              ) : visibleItems.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {visibleItems.map((item) => (
                    <FileRow
                      key={item.id}
                      item={item}
                      selected={item.id === selectedItem?.id}
                      onSelect={() => openItemDetails(item.id)}
                      onRetry={() => retryItem(item.id)}
                      onRemove={() => removeItem(item.id)}
                      onOpen={() => openItemDetails(item.id)}
                      disabled={running}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-black/15 bg-[#fcfbf8] px-6 py-8 text-center">
                  <p className="text-[14px] font-medium mb-1">No files match your filters</p>
                  <p className="text-[13px] text-muted">Try a different search term or clear the status filter.</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
            <button type="button" className="btn-ghost w-full justify-between px-0" onClick={() => setShowInsights((value) => !value)}>
              <span className="flex items-center gap-2">
                {showInsights ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showInsights ? 'Hide combined insights' : 'Show combined insights'}
              </span>
              <span className="text-[12px] text-muted">{visibleItems.length} visible</span>
            </button>

            {showInsights && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[16px] font-semibold">Batch insights</h3>
                    <p className="text-[13px] text-muted">Combined signals from the completed portion of the batch.</p>
                  </div>
                  {insightsLoading && <Loader2 size={16} className="animate-spin text-muted" />}
                </div>

                {insights ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl bg-[#fbfaf7] border border-black/[0.06] p-4 lg:col-span-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted mb-2">Combined insight</p>
                      <p className="text-[13px] leading-6 text-ink">{insights.summary}</p>
                    </div>
                    <InsightList title="Common themes" items={insights.commonThemes} emptyText="No repeated themes were identified yet." />
                    <InsightList title="Highlights" items={insights.highlights} emptyText="No highlights are available yet." />
                    <InsightList title="Recommendations" items={insights.recommendations} emptyText="No recommendations are available yet." />
                    <InsightList title="Key differences" items={buildKeyDifferences(items)} emptyText="No document-level differences are available yet." />
                    <div className="rounded-2xl bg-surface2 px-4 py-3 lg:col-span-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted mb-1">Dominant sentiment</p>
                      <p className={`text-[14px] font-semibold ${sentimentToneClass(insights.dominantSentiment)}`}>
                        {sentenceCase(insights.dominantSentiment || 'neutral')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <EmptyResults allDone={allDone} failedCount={stats.failed} completedCount={stats.completed} />
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6 xl:sticky xl:top-24 self-start">
          <div className="rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
            <h3 className="text-[16px] font-semibold mb-4">Batch summary</h3>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Total" value={stats.total} tone="bg-surface2 text-ink" />
              <Metric label="Completed" value={stats.completed} tone="bg-green-50 text-green-700" />
              <Metric label="Failed" value={stats.failed} tone="bg-red-50 text-red-700" />
              <Metric label="Waiting" value={stats.waiting} tone="bg-surface2 text-muted" />
              <Metric label="Active" value={stats.processing + stats.uploading} tone="bg-amber-50 text-amber-700" />
            </div>

            <div className="mt-5 space-y-4">
              <ProgressBlock label="Upload progress" value={stats.uploadProgress} />
              <ProgressBlock label="Processing progress" value={stats.processingProgress} />
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[16px] font-semibold">Quick navigation</h3>
                <p className="text-[13px] text-muted">Jump into any uploaded document.</p>
              </div>
              <FileText size={16} className="text-muted" />
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {visibleItems.slice(0, 10).map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItemDetails(item.id)}
                  className={`w-full text-left rounded-2xl border p-3 transition-all ${
                    item.id === selectedItem?.id ? 'border-accent bg-accent-light/30' : 'border-black/[0.06] bg-[#fbfaf7] hover:border-accent/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold truncate">{index + 1}. {item.file.name}</p>
                      <p className="text-[11px] text-muted mt-1">{statusLabel(item.status)} • {getFileExtension(item.file.name).toUpperCase()}</p>
                    </div>
                    <span className={`badge ${statusToneClass(item.status)} shrink-0`}>{statusLabel(item.status)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[16px] font-semibold">Audit trail</h3>
                <p className="text-[13px] text-muted">A chronological log of queue and processing actions.</p>
              </div>
              <Clock3 size={16} className="text-muted" />
            </div>

            {auditTrail.length ? (
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {auditTrail.slice(0, 8).map((entry) => (
                  <AuditEntry key={entry.id} entry={entry} />
                ))}
              </div>
            ) : (
              <EmptyAudit />
            )}
          </div>

          <div className="rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[16px] font-semibold">Upload history</h3>
                <p className="text-[13px] text-muted">Recent batch sessions from this browser.</p>
              </div>
              <ShieldAlert size={16} className="text-muted" />
            </div>
            {history.length ? (
              <div className="space-y-3">
                {history.slice(0, 4).map((entry) => (
                  <HistoryCard key={entry.id} entry={entry} />
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted leading-6">Your batch history will appear here after the first completed run.</p>
            )}
          </div>
        </aside>
      </div>

      {isDetailOpen && selectedItem && (
        <DocumentDrawer
          item={selectedItem}
          analysis={selectedAnalysis}
          auditEntries={selectedItemAudit}
          activeTab={detailTab}
          onTabChange={setDetailTab}
          onClose={closeItemDetails}
          onRetry={() => retryItem(selectedItem.id)}
          onRemove={() => removeItem(selectedItem.id)}
          onDownload={() => downloadAnalysisReport(selectedItem, selectedAnalysis)}
          running={running}
        />
      )}
    </>
  );
}

function FileRow({ item, selected, onSelect, onOpen, onRetry, onRemove, disabled }) {
  const statusTone = statusToneClass(item.status);
  const StatusIcon = statusIcon(item.status);
  const docType = inferDocumentType(item.analysis, item.file);
  const riskLevel = inferRiskLevel(item.analysis);
  const isComplete = item.status === 'completed' && item.analysis;

  return (
    <div
      className={`rounded-2xl border p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-all cursor-pointer ${
        selected ? 'border-accent bg-accent-light/30' : 'border-black/[0.07] bg-white hover:border-accent/40'
      }`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect();
      }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-surface2 border border-black/[0.06] flex items-center justify-center shrink-0">
            <FileText size={18} className="text-muted" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold truncate">{item.file.name}</p>
            <p className="text-[12px] text-muted mt-0.5">
              {formatFileSize(item.file.size)} - {getFileExtension(item.file.name).toUpperCase()}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="badge bg-surface2 text-muted text-[10px] uppercase">{docType}</span>
              <span className={`badge ${riskToneClass(riskLevel)} text-[10px] uppercase`}>{riskLevel} risk</span>
              {item.analysis?.translation && item.analysis.language && item.analysis.language !== 'en' && (
                <span className="badge bg-indigo-50 text-indigo-700 text-[10px] uppercase">Translated</span>
              )}
            </div>
            {item.error && (
              <p className="text-[12px] text-red-600 mt-2 flex items-center gap-1.5">
                <AlertCircle size={13} />
                {item.error}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`badge ${statusTone}`}>
            <StatusIcon size={12} className={item.status === 'processing' || item.status === 'uploading' ? 'animate-spin' : ''} />
            {statusLabel(item.status)}
          </span>
          {item.status === 'failed' && (
            <button type="button" className="btn-outline text-[12px] px-3 py-2" onClick={onRetry} disabled={disabled}>
              <RefreshCw size={13} />
              Retry
            </button>
          )}
          <button type="button" className="btn-outline text-[12px] px-3 py-2" onClick={onOpen} disabled={disabled}>
            Open
          </button>
          <button type="button" className="btn-ghost text-[12px] px-3 py-2" onClick={onRemove} disabled={disabled} aria-label={`Remove ${item.file.name} from batch`}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {!isComplete && (
        <div className="mt-4 space-y-2">
          {item.status !== 'completed' && <MiniProgress label="Upload" value={item.uploadProgress || 0} />}
          {item.status !== 'completed' && <MiniProgress label="Processing" value={item.processingProgress || 0} active={item.status === 'processing'} />}
        </div>
      )}

      {isComplete && <CompactSummaryStrip analysis={item.analysis} onOpen={onSelect} />}
    </div>
  );
}

function DocumentDrawer({ item, analysis, auditEntries, activeTab, onTabChange, onClose, onRetry, onRemove, onDownload, running }) {
  const contentRef = useRef(null);
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'translation', label: 'Translation' },
    { id: 'metadata', label: 'Metadata' },
  ];

  const documentType = inferDocumentType(analysis, item.file);
  const riskLevel = inferRiskLevel(analysis);
  const metadata = buildMetadata(item, analysis);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [item.id, activeTab]);

  return (
    <div className="fixed inset-0 z-[70]">
      <button type="button" className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} aria-label="Close document drawer" />
      <aside className="absolute right-0 top-0 h-[100dvh] max-h-[100dvh] w-full max-w-[760px] bg-white shadow-[-24px_0_70px_rgba(15,23,42,0.18)] border-l border-black/[0.08] overflow-hidden flex min-h-0 flex-col">
        <div className="px-6 py-5 border-b border-black/[0.06]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="section-eyebrow mb-2">Document analysis</p>
              <h3 className="text-[22px] font-semibold truncate">{item.file.name}</h3>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="badge bg-surface2 text-muted">{documentType}</span>
                <span className={`badge ${riskToneClass(riskLevel)}`}>{riskLevel} risk</span>
                <span className="badge bg-surface2 text-muted">{statusLabel(item.status)}</span>
                {analysis?.translation ? <span className="badge bg-indigo-50 text-indigo-700">Translation ready</span> : null}
              </div>
            </div>
            <button type="button" className="btn-ghost px-3 py-2" onClick={onClose}>
              Close
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`rounded-full px-4 py-2 text-[12px] font-medium border transition-all ${
                    active ? 'border-accent bg-accent text-white' : 'border-black/[0.08] bg-white text-ink hover:border-accent/40'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 pb-24 bg-[#fcfbf8]">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="space-y-4">
              {activeTab === 'overview' && (
                <>
                  <CompactCard title="AI summary" accent="summary">
                    <SummarySectionList summary={analysis?.summary} fileName={item.file.name} />
                  </CompactCard>
                  <CompactCard title="Key signals" accent="neutral">
                    <div className="flex flex-wrap gap-2">
                      {(analysis?.keywords || []).slice(0, 8).map((keyword) => (
                        <span key={keyword} className="badge rounded-full bg-white border border-black/[0.06] px-3 py-1 text-[11px] shadow-sm">
                          {keyword}
                        </span>
                      ))}
                      {!analysis?.keywords?.length && <span className="text-[13px] text-muted">No keywords returned.</span>}
                    </div>
                  </CompactCard>
                  <CompactCard title="Translation" accent="indigo">
                    <p className="text-[13px] leading-6 whitespace-pre-wrap">{analysis?.translation || 'Translation is not available for this file.'}</p>
                  </CompactCard>
                </>
              )}

              {activeTab === 'analysis' && (
                <>
                  <CompactCard title="Sentiment" accent="neutral">
                    <div className="grid grid-cols-3 gap-2">
                      <MiniStat label="Overall" value={sentenceCase(analysis?.sentiment?.overall || 'neutral')} />
                      <MiniStat label="Readability" value={analysis?.readability?.fleschKincaid !== null && analysis?.readability?.fleschKincaid !== undefined ? Number(analysis.readability.fleschKincaid).toFixed(1) : '-'} />
                      <MiniStat label="Words" value={analysis?.readability?.wordCount?.toLocaleString() || '-'} />
                    </div>
                  </CompactCard>
                  <CompactCard title="Entities" accent="neutral">
                    <p className="text-[13px] leading-6 text-ink whitespace-pre-wrap">{formatEntities(analysis?.entities) || 'No important entities returned.'}</p>
                  </CompactCard>
                  <CompactCard title="Smart categorization" accent="neutral">
                    <div className="flex flex-wrap gap-2">
                      {analysis?.categories?.length ? analysis.categories.map((category) => (
                        <span key={category} className="badge bg-white border border-black/[0.06] text-[11px]">
                          {category}
                        </span>
                      )) : <span className="text-[13px] text-muted">No smart categories returned.</span>}
                    </div>
                  </CompactCard>
                </>
              )}

              {activeTab === 'translation' && (
                <>
                  <CompactCard title="Translated output" accent="indigo">
                    <p className="text-[13px] leading-6 whitespace-pre-wrap">{analysis?.translation || 'No translated output for this file.'}</p>
                  </CompactCard>
                  <CompactCard title="Translation note" accent="neutral">
                    <p className="text-[13px] leading-6 text-muted">
                      Translation follows your selected profile language. If the translation provider is unavailable, the app will fall back gracefully.
                    </p>
                  </CompactCard>
                </>
              )}

              {activeTab === 'metadata' && (
                <>
                  <CompactCard title="Upload metadata" accent="neutral">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <MiniStat label="File type" value={item.file.type || getFileExtension(item.file.name).toUpperCase()} />
                      <MiniStat label="Size" value={formatFileSize(item.file.size || 0)} />
                      <MiniStat label="Language" value={(analysis?.language || 'en').toUpperCase()} />
                      <MiniStat label="Status" value={statusLabel(item.status)} />
                    </div>
                  </CompactCard>
                  <CompactCard title="Processing metadata" accent="neutral">
                    <p className="text-[13px] leading-6 whitespace-pre-wrap">{metadata.uploadedLabel}</p>
                    <p className="text-[13px] leading-6 whitespace-pre-wrap mt-2 text-muted">{metadata.auditLabel}</p>
                  </CompactCard>
                  <CompactCard title="Audit trail" accent="neutral">
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {auditEntries.length ? auditEntries.slice(0, 6).map((entry) => (
                        <div key={entry.id} className="rounded-xl border border-black/[0.06] bg-white p-3">
                          <p className="text-[12px] font-semibold text-ink">{auditTitle(entry.type)}</p>
                          <p className="text-[12px] text-muted mt-1">{entry.message}</p>
                        </div>
                      )) : <p className="text-[13px] text-muted">No audit entries for this file yet.</p>}
                    </div>
                  </CompactCard>
                </>
              )}
            </div>

            <div className="space-y-4">
              <CompactCard title="Actions" accent="neutral">
                <div className="space-y-2">
                  <button type="button" className="btn-primary w-full justify-center" onClick={onRetry} disabled={running}>
                    <RefreshCw size={14} />
                    Retry analysis
                  </button>
                  <button type="button" className="btn-outline w-full justify-center" onClick={onDownload}>
                    <Download size={14} />
                    Download report
                  </button>
                  <button type="button" className="btn-ghost w-full justify-center" onClick={onRemove} disabled={running}>
                    <Trash2 size={14} />
                    Remove file
                  </button>
                </div>
              </CompactCard>
              <CompactCard title="Snapshot" accent="neutral">
                <div className="space-y-2">
                  <MiniStat label="Document type" value={documentType} />
                  <MiniStat label="Risk" value={`${riskLevel} risk`} />
                  <MiniStat label="Language" value={(analysis?.language || 'en').toUpperCase()} />
                  <MiniStat label="File" value={formatFileSize(item.file.size || 0)} />
                </div>
              </CompactCard>
            </div>
          </div>
          <div aria-hidden="true" className="h-6" />
        </div>
      </aside>
    </div>
  );
}

function CompactCard({ title, children, accent = 'neutral' }) {
  const accentClass =
    accent === 'indigo'
      ? 'border-indigo-200 bg-indigo-50/70'
      : accent === 'summary'
        ? 'border-black/[0.06] bg-white'
        : 'border-black/[0.06] bg-white';

  return (
    <div className={`rounded-2xl border p-4 ${accentClass}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted mb-3">{title}</p>
      {children}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-[#fcfbf8] p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-[13px] font-semibold text-ink mt-1 break-words">{value}</p>
    </div>
  );
}

function SelectedDocumentPanel({ item, analysis }) {
  const documentType = inferDocumentType(analysis, item.file);
  const riskLevel = inferRiskLevel(analysis);
  const metadata = buildMetadata(item, analysis);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#fbfaf7] border border-black/[0.06] p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted mb-2">Selected file</p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="badge bg-surface2 text-muted">{documentType}</span>
          <span className={`badge ${riskToneClass(riskLevel)}`}>{riskLevel} risk</span>
          <span className="badge bg-surface2 text-muted">{analysis?.language ? `Language: ${analysis.language.toUpperCase()}` : 'Language: en'}</span>
        </div>
        <p className="text-[14px] font-semibold text-ink">{item.file.name}</p>
        <p className="text-[12px] text-muted mt-1">{metadata.uploadedLabel}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <InfoCard label="Summary" value={getSummaryHighlight(analysis?.summary, item.file?.name)} />
        <InfoCard label="Translation" value={analysis?.translation || 'No translated output for this file.'} accent={analysis?.translation ? 'indigo' : 'muted'} />
        <InfoCard label="Keywords" value={(analysis?.keywords || []).slice(0, 8).join(', ') || 'No keywords returned.'} />
        <InfoCard label="Entities" value={formatEntities(analysis?.entities) || 'No important entities returned.'} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Readability" value={analysis?.readability?.fleschKincaid !== null && analysis?.readability?.fleschKincaid !== undefined ? Number(analysis.readability.fleschKincaid).toFixed(1) : '-'} />
        <MetricCard label="Words" value={analysis?.readability?.wordCount?.toLocaleString() || item.file.size ? Math.max(0, Math.round((analysis?.readability?.wordCount || 0))).toLocaleString() : '-'} />
        <MetricCard label="Sentiment" value={sentenceCase(analysis?.sentiment?.overall || 'neutral')} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <MetaGroupCard title="Document metadata" rows={metadata.document} />
        <MetaGroupCard title="Analysis metadata" rows={metadata.analysis} />
      </div>

      {analysis?.categories?.length ? (
        <div className="rounded-2xl bg-[#fbfaf7] border border-black/[0.06] p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted mb-2">Smart categorization</p>
          <div className="flex flex-wrap gap-2">
            {analysis.categories.map((category) => (
              <span key={category} className="badge bg-white border border-black/[0.06] text-[11px]">
                {category}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {analysis?.translation ? (
        <div className="rounded-2xl bg-[#fbfaf7] border border-black/[0.06] p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted mb-2">Full translation</p>
          <p className="text-[13px] leading-6 text-ink whitespace-pre-wrap">{analysis.translation}</p>
        </div>
      ) : null}

      <div className="rounded-2xl bg-white border border-black/[0.06] p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted mb-2">Detailed analysis</p>
        <div className="grid gap-3 md:grid-cols-2">
          <DetailPill label="Document type" value={documentType} />
          <DetailPill label="Risk level" value={riskLevel} tone={riskToneClass(riskLevel)} />
          <DetailPill label="File type" value={item.file.type || getFileExtension(item.file.name).toUpperCase()} />
          <DetailPill label="Status" value={statusLabel(item.status)} />
        </div>
      </div>
    </div>
  );
}

function SummaryPreview({ analysis }) {
  const highlight = getSummaryHighlight(analysis?.summary, analysis?.document?.originalName || '');
  return (
    <div className="grid gap-3 md:grid-cols-[1.4fr_0.9fr]">
      <div className="rounded-2xl bg-[#fbfaf7] border border-black/[0.06] p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted mb-2">Summary highlight</p>
        <p className="text-[13px] text-ink leading-6 line-clamp-4">{highlight}</p>
      </div>
      <div className="rounded-2xl bg-[#fbfaf7] border border-black/[0.06] p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted mb-2">Signals</p>
        <div className="flex flex-wrap gap-2">
          {(analysis.keywords || []).slice(0, 4).map((keyword) => (
            <span key={keyword} className="badge bg-white border border-black/[0.06] text-[11px]">
              {keyword}
            </span>
          ))}
          {analysis.translation ? <span className="badge bg-indigo-50 text-indigo-700 text-[11px]">Translation ready</span> : null}
        </div>
      </div>
    </div>
  );
}

function CompactSummaryStrip({ analysis, onOpen }) {
  return (
    <div className="mt-4 rounded-2xl border border-black/[0.06] bg-[#faf8f3] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[11px] uppercase tracking-wide text-muted">Quick summary</p>
        <button type="button" className="text-[12px] font-medium text-accent" onClick={onOpen}>
          Open details
        </button>
      </div>
      <p className="text-[13px] leading-6 text-ink line-clamp-3">{getSummaryHighlight(analysis?.summary)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(analysis?.keywords || []).slice(0, 3).map((keyword) => (
          <span key={keyword} className="badge bg-white border border-black/[0.06] text-[11px]">
            {keyword}
          </span>
        ))}
      </div>
    </div>
  );
}

function getSummaryHighlight(summary, fileName = '') {
  const text = String(summary || '').trim();
  if (!text) return 'No summary available.';

  const sectionMatch = text.match(/1\.\s*What this file is about\s*([\s\S]*?)(?:\n\s*2\.\s*Simple explanation|$)/i);
  let highlight = String(sectionMatch?.[1] || text).trim();
  if (!highlight) highlight = text;

  if (fileName) {
    highlight = highlight.replace(new RegExp(`^${escapeRegex(fileName)}\\s*\\(PDF\\):\\s*`, 'i'), '');
    highlight = highlight.replace(new RegExp(`^${escapeRegex(fileName)}\\s*:\\s*`, 'i'), '');
  }

  return highlight.length > 260 ? `${highlight.slice(0, 257).replace(/\s+\S*$/, '')}...` : highlight;
}

function SummarySectionList({ summary, fileName = '' }) {
  const sections = parseSummarySections(summary, fileName);
  const text = String(summary || '').trim();

  if (!text) {
    return <p className="text-[13px] leading-6 text-ink">No summary available.</p>;
  }

  if (!sections.length) {
    return <p className="text-[13px] leading-6 text-ink whitespace-pre-wrap">{stripFilePrefix(text, fileName)}</p>;
  }

  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <details key={`${section.title}-${index}`} open className="group rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
          <summary className="list-none cursor-pointer px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink leading-5">{section.title}</p>
              <p className="text-[11px] uppercase tracking-wide text-muted mt-1">Section {index + 1}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="border-t border-black/[0.06] px-4 py-4">
            <p className="text-[13px] leading-6 text-ink whitespace-pre-wrap">{section.body}</p>
          </div>
        </details>
      ))}
    </div>
  );
}

function parseSummarySections(summary, fileName = '') {
  const text = stripFilePrefix(String(summary || '').trim(), fileName);
  if (!text) return [];

  const headingRegex = /(?:^|\n)\s*(\d+)\.\s*([^\n]+?)(?=\n|$)/g;
  const matches = [...text.matchAll(headingRegex)];
  if (!matches.length) return [];

  return matches
    .map((match, index) => {
      const next = matches[index + 1];
      const start = match.index + match[0].length;
      const end = next ? next.index : text.length;
      const title = String(match[2] || '').trim().replace(/\s*:\s*$/, '');
      const body = stripFilePrefix(text.slice(start, end).trim(), fileName);
      return {
        title: title || `Section ${match[1]}`,
        body,
      };
    })
    .filter((section) => section.body);
}

function stripFilePrefix(value = '', fileName = '') {
  let text = String(value || '').trim();
  if (!text) return '';

  const escapedName = escapeRegex(fileName);
  const patterns = [
    new RegExp(`^${escapedName}\\s*\\((?:PDF|DOCX|TXT)\\):\\s*`, 'i'),
    new RegExp(`^${escapedName}\\s*:\\s*`, 'i'),
    /^Document Explanation\s*/i,
  ];

  patterns.forEach((pattern) => {
    text = text.replace(pattern, '').trim();
  });

  return text;
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function downloadAnalysisReport(item, analysis) {
  if (typeof window === 'undefined') return;

  const documentName = item?.file?.name || 'Document';
  const lines = [
    'DocuWise Analysis Report',
    '',
    `Document: ${documentName}`,
    `File type: ${item?.file?.type || getFileExtension(documentName).toUpperCase()}`,
    `Document type: ${inferDocumentType(analysis, item?.file)}`,
    `Risk level: ${inferRiskLevel(analysis)}`,
    `Language: ${(analysis?.language || 'en').toUpperCase()}`,
    '',
    'Summary',
    getSummaryHighlight(analysis?.summary, documentName),
    '',
    'Keywords',
    (analysis?.keywords || []).length ? (analysis.keywords || []).join(', ') : 'None',
    '',
    'Sentiment',
    sentenceCase(analysis?.sentiment?.overall || 'neutral'),
    '',
    'Readability',
    analysis?.readability?.fleschKincaid !== null && analysis?.readability?.fleschKincaid !== undefined
      ? `Flesch-Kincaid: ${Number(analysis.readability.fleschKincaid).toFixed(1)}`
      : 'Not available',
    '',
    'Entities',
    formatEntities(analysis?.entities) || 'None',
    '',
    'Translation',
    analysis?.translation || 'Not available',
    '',
    'Generated by DocuWise',
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${documentName.replace(/\.[^.]+$/, '') || 'docuwise'}_analysis.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast.success('Analysis report downloaded');
}

function InfoCard({ label, value, accent = 'muted' }) {
  const accentClass = accent === 'indigo' ? 'border-indigo-200 bg-indigo-50 text-indigo-900' : 'border-black/[0.06] bg-[#fbfaf7] text-ink';
  return (
    <div className={`rounded-2xl border p-4 ${accentClass}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted mb-2">{label}</p>
      <p className="text-[13px] leading-6 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function MetaGroupCard({ title, rows }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-[#fbfaf7] p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted mb-3">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(rows || []).map((row) => (
          <div key={row.label} className="rounded-xl border border-black/[0.06] bg-white p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted">{row.label}</p>
            <p className="text-[13px] font-semibold text-ink mt-1 break-words">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone = '' }) {
  return (
    <div className={`rounded-2xl border border-black/[0.06] bg-white p-4 ${tone}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted mb-2">{label}</p>
      <p className="text-[15px] font-semibold text-ink">{value}</p>
    </div>
  );
}

function DetailPill({ label, value, tone = '' }) {
  return (
    <div className={`rounded-xl border border-black/[0.06] bg-[#fbfaf7] p-3 ${tone}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-[13px] font-semibold text-ink mt-1">{value}</p>
    </div>
  );
}

function AuditEntry({ entry }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-[#fbfaf7] p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[12px] font-semibold text-ink">{auditTitle(entry.type)}</p>
        <span className="text-[11px] text-muted">{formatAuditTime(entry.createdAt)}</span>
      </div>
      <p className="text-[12px] leading-5 text-muted">{entry.message}</p>
      {entry.fileName && <p className="text-[11px] text-muted mt-2 truncate">{entry.fileName}</p>}
    </div>
  );
}

function EmptyAudit() {
  return <p className="text-[13px] text-muted leading-6">Audit events will appear here as files move through the queue.</p>;
}

function HistoryCard({ entry }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-[#fbfaf7] p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[13px] font-semibold text-ink">{entry.analysisType || 'Batch'}</p>
        <span className="text-[11px] text-muted">{formatAuditTime(entry.createdAt)}</span>
      </div>
      <p className="text-[12px] text-muted leading-5">{entry.summary}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        <span className="badge bg-surface2 text-muted text-[10px]">Total {entry.total}</span>
        <span className="badge bg-green-50 text-green-700 text-[10px]">Completed {entry.completed}</span>
        <span className="badge bg-red-50 text-red-700 text-[10px]">Failed {entry.failed}</span>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${tone}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-[24px] font-semibold leading-none mt-2">{value}</p>
    </div>
  );
}

function ProgressBlock({ label, value }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] text-muted">{label}</span>
        <span className="text-[12px] font-medium text-ink">{value}%</span>
      </div>
      <div className="h-2 bg-surface2 rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function MiniProgress({ label, value, active = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-[12px] text-muted shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-surface2 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${active ? 'bg-accent progress-pulse' : 'bg-accent'}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-12 text-[12px] text-right text-ink shrink-0">{value}%</span>
    </div>
  );
}

function BehaviorNote({ icon, title, text }) {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-[#fbfaf7] px-4 py-3">
      <div className="flex gap-3">
        <div className="mt-0.5 h-8 w-8 rounded-lg bg-white border border-black/[0.06] text-accent flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-ink">{title}</p>
          <p className="text-[12px] leading-5 text-muted mt-0.5">{text}</p>
        </div>
      </div>
    </div>
  );
}

function InsightList({ title, items, emptyText }) {
  return (
    <div className="rounded-2xl bg-[#fbfaf7] border border-black/[0.06] p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted mb-2">{title}</p>
      {items?.length ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="text-[13px] text-ink leading-6 flex gap-2">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-60" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted leading-6">{emptyText}</p>
      )}
    </div>
  );
}

function EmptyList() {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-[#fcfbf8] px-6 py-10 text-center">
      <p className="text-[15px] font-medium mb-2">No files in the batch yet</p>
      <p className="text-[13px] text-muted">Add a few documents to see per-file progress and batch-level analysis.</p>
    </div>
  );
}

function EmptyResults({ allDone, failedCount, completedCount }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-[#fcfbf8] px-6 py-10 text-center">
      <p className="text-[15px] font-medium mb-2">{allDone ? 'Batch finished' : 'Results will appear here'}</p>
      <p className="text-[13px] text-muted">
        {allDone && completedCount === 0
          ? `No combined insight was generated because ${failedCount || 'the'} file${failedCount === 1 ? '' : 's'} failed. Review the file errors and retry.`
          : allDone
            ? 'The batch completed, but no combined insight was generated yet. Batch insights may fall back to local heuristics if external AI is unavailable.'
            : 'Run the batch to generate summaries, sentiment, keywords, translations, and a combined insight panel.'}
      </p>
    </div>
  );
}

function DocumentStatusList({ items }) {
  const visible = items.filter((item) => item.status === 'completed' || item.status === 'failed');
  if (!visible.length) return null;

  return (
    <div className="rounded-2xl bg-[#fbfaf7] border border-black/[0.06] p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted mb-3">Document-level status</p>
      <div className="space-y-2">
        {visible.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate text-ink">{item.document?.originalName || item.file.name}</span>
            <span className={`badge ${statusToneClass(item.status)} shrink-0`}>{statusLabel(item.status)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FailedFilesList({ items }) {
  const failed = items.filter((item) => item.status === 'failed');
  if (!failed.length) return null;

  return (
    <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
      <p className="text-[11px] uppercase tracking-wide text-red-700 mb-3">Failed files</p>
      <div className="space-y-2">
        {failed.map((item) => (
          <div key={item.id} className="text-[13px] text-red-700">
            <p className="font-semibold">{item.file.name}</p>
            <p className="text-[12px] leading-5">{item.error || 'Processing failed.'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusToneClass(status) {
  if (status === 'completed') return 'bg-green-50 text-green-700';
  if (status === 'failed') return 'bg-red-50 text-red-700';
  if (status === 'processing') return 'bg-amber-50 text-amber-700';
  if (status === 'uploading') return 'bg-blue-50 text-blue-700';
  return 'bg-surface2 text-muted';
}

function statusIcon(status) {
  if (status === 'completed') return CheckCircle2;
  if (status === 'failed') return XCircle;
  if (status === 'processing' || status === 'uploading') return Loader2;
  return FileText;
}

function statusLabel(status) {
  if (status === 'pending') return 'waiting';
  if (status === 'processing') return 'analyzing';
  return status;
}

function buildKeyDifferences(items) {
  const completed = items.filter((item) => item.status === 'completed' && item.analysis);
  if (completed.length < 2) return [];

  return completed.slice(0, 4).map((item) => {
    const keywords = (item.analysis.keywords || []).slice(0, 3).join(', ');
    const sentiment = item.analysis.sentiment?.overall;
    const documentType = inferDocumentType(item.analysis, item.file);
    const parts = [];
    if (documentType) parts.push(`type: ${documentType}`);
    if (keywords) parts.push(`keywords: ${keywords}`);
    if (sentiment) parts.push(`sentiment: ${sentiment}`);
    if (item.analysis.translation) parts.push('translation available');
    return `${item.document?.originalName || item.file.name}: ${parts.join('; ') || 'completed with limited extracted signals'}`;
  });
}

function sentenceCase(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sentimentToneClass(value) {
  if (value === 'positive') return 'text-green-700';
  if (value === 'negative') return 'text-red-700';
  return 'text-muted';
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeDocumentId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function collectInsightFiles(items, latestResults = []) {
  const files = [];
  const seen = new Set();

  const pushFile = (entry) => {
    if (!entry) return;
    const key = normalizeDocumentId(entry.documentId) || `${entry.name || ''}-${entry.summary || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push({
      name: entry.name || 'Document',
      summary: entry.summary || '',
      sentiment: entry.sentiment || null,
      keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
      translation: entry.translation || '',
      entities: Array.isArray(entry.entities) ? entry.entities : [],
      documentType: entry.documentType || '',
      riskLevel: entry.riskLevel || '',
      readability: entry.readability || null,
      fileType: entry.fileType || '',
      documentId: entry.documentId || null,
    });
  };

  items
    .filter((item) => item.status === 'completed' && item.analysis)
    .forEach((item) =>
      pushFile({
        documentId: normalizeDocumentId(item.document?._id || item.analysis?.document || item.id),
        name: item.document?.originalName || item.file?.name || 'Document',
        summary: item.analysis.summary || '',
        sentiment: item.analysis.sentiment || null,
        keywords: item.analysis.keywords || [],
        translation: item.analysis.translation || '',
        entities: item.analysis.entities || [],
        documentType: inferDocumentType(item.analysis, item.file),
        riskLevel: inferRiskLevel(item.analysis),
        fileType: item.document?.fileType || getFileExtension(item.file?.name),
        readability: item.analysis.readability || null,
      })
    );

  latestResults.forEach((result) =>
    pushFile({
      documentId: normalizeDocumentId(result.document?._id || result.documentId || result.analysis?.document || result.analysis?._id || result.analysisId || result.itemId),
      name: result.document?.originalName || result.document?.name || result.document?.originalFilename || result.fileName || result.name || 'Document',
      summary: result.analysis?.summary || result.summary || '',
      sentiment: result.analysis?.sentiment || result.sentiment || null,
      keywords: result.analysis?.keywords || result.keywords || [],
      translation: result.analysis?.translation || result.translation || '',
      entities: result.analysis?.entities || result.entities || [],
      documentType: inferDocumentType(result.analysis, result.file),
      riskLevel: inferRiskLevel(result.analysis),
      fileType: result.document?.fileType || result.fileType || '',
      readability: result.analysis?.readability || result.readability || null,
    })
  );

  return files;
}

function loadJson(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function persistJson(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best effort
  }
}

function pushAudit(setAuditTrail, entry) {
  setAuditTrail((current) => [
    {
      id: makeId(),
      createdAt: new Date().toISOString(),
      ...entry,
    },
    ...current,
  ].slice(0, 120));
}

function filterItems(items, searchQuery, statusFilter, sortBy) {
  const query = String(searchQuery || '').trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (!query) return true;

    const analysis = item.analysis || {};
    const haystack = [
      item.file?.name,
      item.document?.originalName,
      analysis.summary,
      analysis.translation,
      (analysis.keywords || []).join(' '),
      (analysis.entities || []).map((entity) => `${entity.value} ${entity.type}`).join(' '),
      inferDocumentType(analysis, item.file),
      inferRiskLevel(analysis),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

  return filtered.sort((a, b) => {
    if (sortBy === 'name') {
      return String(a.file?.name || '').localeCompare(String(b.file?.name || ''));
    }
    if (sortBy === 'status') {
      return statusRank(a.status) - statusRank(b.status) || dateRank(b) - dateRank(a);
    }
    if (sortBy === 'oldest') {
      return dateRank(a) - dateRank(b);
    }
    return dateRank(b) - dateRank(a);
  });
}

function dateRank(item) {
  return new Date(item.document?.createdAt || item.file?.lastModified || Date.now()).getTime();
}

function statusRank(status) {
  return { failed: 0, processing: 1, uploading: 2, pending: 3, completed: 4 }[status] ?? 5;
}

function inferDocumentType(analysis, file) {
  const categories = (analysis?.categories || []).map((entry) => String(entry).toLowerCase());
  const keywords = (analysis?.keywords || []).map((entry) => String(entry).toLowerCase());
  const summary = String(analysis?.summary || '').toLowerCase();
  const fileName = String(file?.name || '').toLowerCase();
  const blob = `${categories.join(' ')} ${keywords.join(' ')} ${summary} ${fileName}`;

  if (/\b(policy|contract|agreement|confidential|legal|compliance|privacy|terms)\b/.test(blob)) return 'Policy / Legal';
  if (/\b(report|budget|revenue|sales|customer|project|quarter|finance|operations|roadmap)\b/.test(blob)) return 'Business / Project';
  if (/\b(technical|model|algorithm|research|evaluation|architecture|system|design|database|integration)\b/.test(blob)) return 'Technical / Academic';
  return 'General';
}

function inferRiskLevel(analysis) {
  const sentiment = String(analysis?.sentiment?.overall || '').toLowerCase();
  const categories = (analysis?.categories || []).join(' ').toLowerCase();
  const summary = String(analysis?.summary || '').toLowerCase();

  if (/\b(confidential|deadline|payment|payment terms|termination|policy violation|compliance)\b/.test(`${categories} ${summary}`)) return 'high';
  if (sentiment === 'negative') return 'medium';
  if (analysis?.readability?.fleschKincaid && analysis.readability.fleschKincaid > 16) return 'medium';
  return 'low';
}

function riskToneClass(level) {
  if (level === 'high') return 'bg-red-50 text-red-700';
  if (level === 'medium') return 'bg-amber-50 text-amber-700';
  return 'bg-green-50 text-green-700';
}

function getFileExtension(name = '') {
  const match = String(name).toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1].slice(1) : 'file';
}

function buildMetadata(item, analysis) {
  const file = item.file || {};
  const uploadedAt = item.document?.createdAt || file.lastModified || Date.now();
  const analyzedAt = analysis?.updatedAt || analysis?.createdAt || item.document?.updatedAt || null;
  const documentType = inferDocumentType(analysis, file);
  const riskLevel = inferRiskLevel(analysis);
  const processingTime = analysis?.processingTimeMs ? `${(analysis.processingTimeMs / 1000).toFixed(1)}s` : 'Pending';
  const wordCount = analysis?.readability?.wordCount || item.document?.wordCount || 0;
  return {
    document: [
      { label: 'File name', value: file.name || item.file?.name || 'Document' },
      { label: 'File type', value: file.type || getFileExtension(file.name).toUpperCase() },
      { label: 'File size', value: formatFileSize(file.size || 0) },
      { label: 'Word count', value: wordCount ? wordCount.toLocaleString() : 'Not available' },
      { label: 'Uploaded', value: formatDate(uploadedAt) },
    ],
    analysis: [
      { label: 'Document type', value: documentType },
      { label: 'Language', value: (analysis?.language || 'en').toUpperCase() },
      { label: 'Sentiment', value: sentenceCase(analysis?.sentiment?.overall || 'neutral') },
      { label: 'Risk', value: `${riskLevel} risk` },
      { label: 'Translation', value: analysis?.translation ? 'Available' : 'Unavailable' },
      { label: 'Processing time', value: processingTime },
      { label: 'Analyzed', value: analyzedAt ? formatDate(analyzedAt) : 'Pending' },
    ],
  };
}

function formatEntities(entities) {
  if (!Array.isArray(entities) || entities.length === 0) return '';
  return entities.slice(0, 6).map((entry) => entry?.value || entry?.text || entry?.term).filter(Boolean).join(', ');
}

function formatAuditTime(value) {
  return new Date(value || Date.now()).toLocaleString();
}

function auditTitle(type) {
  return {
    queued: 'Queued',
    uploaded: 'Uploaded',
    completed: 'Completed',
    failed: 'Failed',
    retry: 'Retry',
    cleared: 'Cleared',
    batch_start: 'Batch started',
    batch_complete: 'Batch completed',
    removed: 'Removed',
  }[type] || 'Event';
}

function analysisLabel(key) {
  return {
    summarization: 'summary',
    sentiment: 'sentiment',
    keywords: 'key-term',
  }[key] || key;
}

function getDropzoneErrorMessage(fileRejections) {
  const codes = fileRejections.flatMap((rejection) => (rejection.errors || []).map((error) => error.code));

  if (codes.includes('too-many-files')) return 'Please upload fewer files at a time.';
  if (codes.includes('file-too-large')) return 'One or more files are too large. Please upload smaller documents.';
  if (codes.includes('file-invalid-type')) return 'Unsupported file type. Please upload PDF, DOCX, or TXT files.';
  if (codes.includes('file-too-small')) return 'Upload failed. Please choose a valid PDF, DOCX, or TXT file.';
  return 'Upload failed. Please choose valid PDF, DOCX, or TXT files.';
}
