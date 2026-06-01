import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  Users,
  CheckCircle2,
  Clock3,
  Activity,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  FileText,
  Eye,
  Trash2,
  BarChart3,
  ArrowUpDown,
  GitCompareArrows,
  AlertTriangle,
  UploadCloud,
  FolderOpen,
  MessageSquareText,
} from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import { useDocumentStore } from '../store/documentStore';
import { useAuthStore } from '../store/authStore';
import { useActivityStore } from '../store/activityStore';
import { useComparisonStore } from '../store/comparisonStore';
import { useCollabStore } from '../store/collabStore';
import BatchUploadWorkspace from '../components/Batch/BatchUploadWorkspace';
import { formatDate, formatFileSize, fileTypeColor, modeBadgeClass, modeLabel, truncate } from '../utils/formatters';
import { validateEmail } from '../utils/validators';
import { documentService } from '../services/documentService';
import toast from 'react-hot-toast';
import ToolGuideModal from '../components/Dashboard/ToolGuideModel';
import ComparisonSetup from '../components/Comparison/ComparisonSetup';
import ComparisonResult from '../components/Comparison/ComparisonResult';
import ComparisonHistory from '../components/Comparison/ComparisonHistory';
import CollabSummaryBar from '../components/Collaboration/CollabSummaryBar';
import CommentThread from '../components/Collaboration/CommentThread';
import CommentInput from '../components/Collaboration/CommentInput';
import CollabEventFeed from '../components/Collaboration/CollabEventFeed';
import RolePermissionsInfo from '../components/Collaboration/RolePermissionsInfo';
import Modal from '../components/UI/Modal';

export default function DashboardPage() {
  const [view, setView] = useState('overview');
  const [activeGuide, setActiveGuide] = useState(null);
  const [showComparisonHistory, setShowComparisonHistory] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [collabUploadFile, setCollabUploadFile] = useState(null);
  const [collabUploadDragging, setCollabUploadDragging] = useState(false);
  const [partners, setPartners] = useState([createPartner()]);
  const [collaborationData, setCollaborationData] = useState(null);
  const [collaborationLoading, setCollaborationLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState({});
  const [aiSummary, setAiSummary] = useState('');
  const [improveInput, setImproveInput] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [aiLoading, setAiLoading] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryType, setLibraryType] = useState('all');
  const [libraryStatus, setLibraryStatus] = useState('all');
  const [librarySort, setLibrarySort] = useState('newest');
  const [libraryDetailDoc, setLibraryDetailDoc] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const {
    analyses,
    documents,
    fetchAnalyses,
    fetchDocuments,
    loading,
    deleteDocument,
    setCurrentDoc,
    uploadDocument,
    uploading: collabUploading,
    uploadProgress: collabUploadProgress,
  } = useDocumentStore();
  const {
    comments,
    events: collabEvents,
    summary: collabSummary,
    loading: collabLoading,
    submitting: collabSubmitting,
    sseConnected: collabSseConnected,
    filters: collabFilters,
    init: initCollab,
    cleanup: cleanupCollab,
    addComment,
    editComment,
    resolveComment,
    removeComment,
    addReaction,
    setFilter: setCollabFilter,
  } = useCollabStore();
  const {
    comparisons,
    currentComparison,
    comparing,
    error: comparisonError,
    createComparison,
    fetchComparisons,
    fetchComparison,
    removeComparison,
  } = useComparisonStore();
  const {
    items: activityItems,
    stats: activityStats,
    page: activityPage,
    hasMore,
    loading: activityLoading,
    statsLoading,
    filters,
    sseConnected,
    fetchActivity,
    fetchMore,
    fetchStats,
    setFilter,
    clearFilters,
    connectSSE,
    disconnectSSE,
  } = useActivityStore();

  useEffect(() => {
    fetchAnalyses();
    fetchDocuments();
    fetchComparisons();
  }, [fetchAnalyses, fetchComparisons, fetchDocuments]);

  useEffect(() => {
    const queryView = new URLSearchParams(location.search).get('view');
    if (queryView) setView(queryView);
  }, [location.search]);

  useEffect(() => {
    if (view !== 'activity') {
      disconnectSSE();
      return;
    }

    fetchStats();
    fetchActivity(1);
    connectSSE();
    return () => {
      disconnectSSE();
    };
  }, [view, connectSSE, disconnectSSE, fetchActivity, fetchStats]);

  useEffect(() => {
    if (view !== 'collaboration' || !selectedDocId) return undefined;
    initCollab(selectedDocId);
    return () => cleanupCollab();
  }, [view, selectedDocId, initCollab, cleanupCollab]);

  useEffect(() => {
    if (view === 'collaboration') return undefined;
    cleanupCollab();
    return undefined;
  }, [view, cleanupCollab]);

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc._id === selectedDocId),
    [documents, selectedDocId]
  );
  const collaborationDoc = collaborationData?.document || selectedDocument;
  const permissions = collaborationData?.permissions || {};
  const userRole = collaborationData?.role || 'owner';
  const libraryRows = useMemo(
    () => buildLibraryRows(documents, analyses, librarySearch, libraryType, libraryStatus, librarySort),
    [documents, analyses, librarySearch, libraryType, libraryStatus, librarySort]
  );
  const overviewRows = useMemo(
    () => buildLibraryRows(documents, analyses, '', 'all', 'all', 'newest'),
    [documents, analyses]
  );
  const overviewStats = useMemo(
    () => buildOverviewStats(documents, analyses),
    [documents, analyses]
  );
  const recentDocuments = overviewRows.slice(0, 5);
  const recentAnalysisItems = useMemo(
    () => buildRecentAnalysisItems(analyses),
    [analyses]
  );

  useEffect(() => {
    if (selectedDocument?.collaborators?.length) {
      setPartners(selectedDocument.collaborators.map((partner) => ({
        id: partner._id || partner.email || createPartner().id,
        name: partner.name || '',
        email: partner.email || '',
        role: partner.role || 'editor',
      })));
      return;
    }

    setPartners([createPartner()]);
  }, [selectedDocument]);

  useEffect(() => {
    setCollaborationData(null);
    setAiSummary('');
    setAiSuggestion('');
    setCommentText('');
    setReplyText({});
  }, [selectedDocId]);

  useEffect(() => {
    if (!selectedDocId) return undefined;

    loadCollaboration(true);
    const poll = window.setInterval(() => loadCollaboration(true), 8000);
    const presence = window.setInterval(() => updatePresence(), 15000);
    updatePresence();

    return () => {
      window.clearInterval(poll);
      window.clearInterval(presence);
    };
  }, [selectedDocId]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const addPartner = () => {
    if (partners.length >= 3) {
      toast.error('You can add up to 3 collaborators.');
      return;
    }

    setPartners((current) => [...current, createPartner()]);
  };

  const updatePartner = (index, key, value) => {
    setPartners((current) => current.map((partner, partnerIndex) => (
      partnerIndex === index ? { ...partner, [key]: value } : partner
    )));
  };

  const removePartner = (index) => {
    setPartners((current) => current.filter((_, partnerIndex) => partnerIndex !== index));
  };

  const loadCollaboration = async (silent = false) => {
    if (!selectedDocId) return;
    if (!silent) setCollaborationLoading(true);

    try {
      const res = await documentService.collaboration(selectedDocId);
      setCollaborationData(res.data.data);
    } catch (error) {
      if (!silent) {
        toast.error(error.response?.data?.message || 'Could not load collaboration details.');
      }
    } finally {
      if (!silent) setCollaborationLoading(false);
    }
  };

  const updatePresence = async (status = 'online') => {
    if (!selectedDocId) return;
    try {
      await documentService.presence(selectedDocId, status);
    } catch {
      // Presence is best-effort and should not interrupt work.
    }
  };

  const savePartners = async () => {
    if (!selectedDocId) {
      toast.error('Choose a document first.');
      return;
    }

    const validPartners = partners
      .map((partner) => {
        const email = partner.email.trim();
        const fallbackName = email.split('@')[0] || 'Collaborator';

        return {
          name: partner.name.trim() || fallbackName,
          email,
          role: partner.role,
        };
      })
      .filter((partner) => partner.email);

    const invalidPartner = validPartners.find((partner) => validateEmail(partner.email));
    if (invalidPartner) {
      toast.error(validateEmail(invalidPartner.email));
      return;
    }

    if (!validPartners.length) {
      toast.error('Add at least one collaborator email.');
      return;
    }

    try {
      const res = await documentService.updateCollaborators(selectedDocId, validPartners);
      await fetchDocuments();
      await loadCollaboration(true);
      const email = res.data.data.email || {};
      const failedEmails = email.failed || [];
      const skippedEmails = email.skipped || [];
      if (failedEmails.length || skippedEmails.length) {
        const notSentEmails = [...failedEmails, ...skippedEmails];
        toast.error(`Saved, but invite email was not sent to ${notSentEmails.join(', ')}.`);
      } else {
        toast.success('Invites saved.');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save collaborators.');
    }
  };

  const handleCompare = async (documentAId, documentBId, mode) => {
    const result = await createComparison(documentAId, documentBId, mode);
    if (!result.success) {
      toast.error(result.message || 'Comparison failed');
      return;
    }
    toast.success('Comparison completed');
    fetchComparisons();
  };

  const handleAnalyzeDocument = (doc) => {
    setCurrentDoc(doc);
    navigate('/analyse');
  };

  const handleCollabFilePick = (event) => {
    const file = event.target.files?.[0] || null;
    setCollabUploadFile(file);
  };

  const handleCollabFileDrop = (event) => {
    event.preventDefault();
    setCollabUploadDragging(false);
    const file = event.dataTransfer.files?.[0] || null;
    setCollabUploadFile(file);
  };

  const handleCollabUpload = async () => {
    if (!collabUploadFile) {
      toast.error('Choose a file first.');
      return;
    }

    const result = await uploadDocument(collabUploadFile);
    if (!result.success) {
      toast.error(result.message || 'Upload failed');
      return;
    }

    setSelectedDocId(result.document._id);
    setCurrentDoc(result.document);
    setCollabUploadFile(null);
    toast.success('File uploaded');
    await fetchDocuments();
    await loadCollaboration(true);
  };

  const handleDeleteDocument = async () => {
    if (!deleteTarget?._id) return;
    const res = await deleteDocument(deleteTarget._id);
    if (res.success) {
      toast.success('Document deleted');
      setDeleteTarget(null);
      return;
    }
    toast.error(res.message || 'Delete failed');
  };

  return (
    <div className="flex" style={{ minHeight: 'calc(100vh - 60px)' }}>
      <Sidebar activeView={view} onViewChange={setView} onToolClick={setActiveGuide} />

      <main className="flex-1 p-8 bg-bg overflow-y-auto">
        {view === 'overview' && (
          <div className="fade-up">
            <div className="rounded-2xl border border-black/[0.08] bg-white p-6 md:p-7 shadow-[0_14px_40px_rgba(15,23,42,0.05)] mb-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="section-eyebrow mb-2">Overview</p>
                  <h1 className="font-serif text-[34px] leading-tight">{greeting()}{user?.firstName ? `, ${user.firstName}` : ''}</h1>
                  <p className="text-[14px] text-muted mt-2 max-w-2xl">
                    Track uploaded documents, analysis progress, and the next useful action from one workspace.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => navigate('/analyse')} className="btn-primary gap-2">
                    <UploadCloud size={15} />
                    Upload Document
                  </button>
                  <button type="button" onClick={() => setView('library')} className="btn-outline gap-2">
                    <FolderOpen size={15} />
                    View Library
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-6">
              <OverviewStatCard
                icon={<FileText size={18} />}
                label="Total documents"
                value={overviewStats.totalDocuments}
                detail={overviewStats.fileBreakdown}
              />
              <OverviewStatCard
                icon={<CheckCircle2 size={18} />}
                label="Completed analyses"
                value={overviewStats.completedAnalyses}
                detail={`${overviewStats.totalAnalyses} total runs`}
              />
              <OverviewStatCard
                icon={<AlertTriangle size={18} />}
                label="Needs attention"
                value={overviewStats.processingOrFailed}
                detail={`${overviewStats.processingAnalyses} processing, ${overviewStats.failedAnalyses} failed`}
              />
              <OverviewStatCard
                icon={<BarChart3 size={18} />}
                label="Words processed"
                value={overviewStats.totalWords.toLocaleString()}
                detail="From uploaded document text"
              />
            </div>

            {documents.length === 0 ? (
              <GettingStartedPanel onUpload={() => navigate('/analyse')} />
            ) : (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
                <RecentDocumentsPanel
                  rows={recentDocuments}
                  onView={(row) => setLibraryDetailDoc(row)}
                  onOpenResult={(row) => navigate(`/analyse/${row.analysis._id}`)}
                  onAnalyze={(row) => handleAnalyzeDocument(row.doc)}
                  onLibrary={() => setView('library')}
                />
                <RecentActivityPanel
                  items={recentAnalysisItems}
                  onOpen={(item) => navigate(`/analyse/${item.analysis._id}`)}
                  onActivity={() => setView('activity')}
                />
              </div>
            )}
          </div>
        )}

        {view === 'library' && (
          <div className="fade-up">
            <div className="flex items-start justify-between gap-4 mb-7">
              <div>
                <h1 className="font-serif text-[28px]">Document library</h1>
                <p className="text-[13px] text-muted mt-1">Search, filter, sort, and manage every uploaded document.</p>
              </div>
              <button onClick={() => navigate('/analyse')} className="btn-primary">
                <Plus size={15} />
                New analysis
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4">
              <LibraryStat label="Documents" value={documents.length} />
              <LibraryStat label="Analysed" value={libraryRows.filter((row) => row.status === 'completed').length} />
              <LibraryStat label="Processing" value={libraryRows.filter((row) => row.status === 'processing').length} />
              <LibraryStat label="Total storage" value={formatLibrarySize(documents)} />
            </div>

            <div className="card p-4 mb-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <label className="relative flex-1 min-w-[260px]">
                  <span className="sr-only">Search documents by name</span>
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    className="input pl-9"
                    value={librarySearch}
                    onChange={(event) => setLibrarySearch(event.target.value)}
                    placeholder="Search documents by name..."
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <select className="input w-[145px]" value={libraryType} onChange={(event) => setLibraryType(event.target.value)} aria-label="Filter by file type">
                    <option value="all">All types</option>
                    <option value="txt">TXT</option>
                    <option value="pdf">PDF</option>
                    <option value="docx">DOCX</option>
                  </select>
                  <select className="input w-[165px]" value={libraryStatus} onChange={(event) => setLibraryStatus(event.target.value)} aria-label="Filter by status">
                    <option value="all">All status</option>
                    <option value="uploaded">Uploaded</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                  <select className="input w-[165px]" value={librarySort} onChange={(event) => setLibrarySort(event.target.value)} aria-label="Sort documents">
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="name">Name A-Z</option>
                    <option value="largest">Largest file</option>
                  </select>
                  {(librarySearch || libraryType !== 'all' || libraryStatus !== 'all' || librarySort !== 'newest') && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setLibrarySearch('');
                        setLibraryType('all');
                        setLibraryStatus('all');
                        setLibrarySort('newest');
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="card py-16 text-center text-muted text-[13px]">Loading document library...</div>
            ) : documents.length === 0 ? (
              <div className="card py-16 text-center">
                <FileText size={28} className="mx-auto text-muted mb-3" />
                <p className="text-[15px] font-medium mb-2">No documents yet</p>
                <p className="text-[13px] text-muted mb-6">Upload your first TXT, PDF, or DOCX file to build your library.</p>
                <button onClick={() => navigate('/analyse')} className="btn-accent">Upload document</button>
              </div>
            ) : libraryRows.length === 0 ? (
              <div className="card py-16 text-center">
                <Search size={26} className="mx-auto text-muted mb-3" />
                <p className="text-[15px] font-medium mb-2">No documents match your filters</p>
                <p className="text-[13px] text-muted mb-6">Try a different search, file type, status, or sort order.</p>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    setLibrarySearch('');
                    setLibraryType('all');
                    setLibraryStatus('all');
                    setLibrarySort('newest');
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/[0.09]">
                  <div>
                    <h2 className="text-[14px] font-semibold">Documents</h2>
                    <p className="text-[12px] text-muted mt-0.5">{libraryRows.length} shown from {documents.length} uploaded</p>
                  </div>
                  <span className="badge bg-surface2 text-muted">
                    <ArrowUpDown size={12} />
                    {sortLabel(librarySort)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-surface2">
                        {['Document', 'Type', 'Words', 'Uploaded', 'Status', 'Actions'].map((heading) => (
                          <th key={heading} className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted px-5 py-3">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {libraryRows.map((row) => (
                        <LibraryRow
                          key={row.doc._id}
                          row={row}
                          onView={() => setLibraryDetailDoc(row)}
                          onOpenResult={() => navigate(`/analyse/${row.analysis._id}`)}
                          onAnalyze={() => handleAnalyzeDocument(row.doc)}
                          onCompare={() => {
                            setSelectedDocId(row.doc._id);
                            setView('compare');
                          }}
                          onDelete={() => setDeleteTarget(row.doc)}
                          canCompare={documents.length > 1}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'compare' && (
          <div className="fade-up">
            <div className="rounded-2xl border border-black/[0.08] bg-white p-6 md:p-7 shadow-[0_14px_40px_rgba(15,23,42,0.05)] mb-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="section-eyebrow mb-2">Compare</p>
                  <h1 className="font-serif text-[34px] leading-tight">Compare documents</h1>
                  <p className="text-[14px] text-muted mt-2 max-w-2xl">
                    Run a semantic side-by-side comparison across two uploaded files to see material changes, type warnings, and critical alerts.
                  </p>
                </div>
                <button type="button" className="btn-outline" onClick={() => setView('library')}>
                  <FolderOpen size={15} />
                  View Library
                </button>
              </div>
            </div>

            {comparisonError && !comparing && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 mb-5 flex gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-red-800">Comparison could not be completed</p>
                  <p>{comparisonError}</p>
                </div>
              </div>
            )}

            <ComparisonSetup
              documents={documents}
              comparing={comparing}
              onCompare={handleCompare}
            />

            {currentComparison && currentComparison.status !== 'processing' && (
              <ComparisonResult comparison={currentComparison} />
            )}

            {currentComparison?.status === 'processing' && (
              <div className="rounded-2xl border border-accent/15 bg-accent-light px-5 py-4 mb-5 text-[13px] text-accent">
                <div className="flex items-center gap-2 font-semibold">
                  <RefreshCw size={14} className="animate-spin" />
                  Comparison is processing
                </div>
                <p className="text-[12px] text-muted mt-1">The result will appear here once both documents have been processed.</p>
              </div>
            )}

            <div className="mb-3">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowComparisonHistory((value) => !value)}
              >
                {showComparisonHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showComparisonHistory ? 'Hide history' : 'Show history'}
              </button>
            </div>

            {showComparisonHistory && (
              <ComparisonHistory
                comparisons={comparisons}
                onSelect={fetchComparison}
                onDelete={async (id) => {
                  const result = await removeComparison(id);
                  if (!result.success) {
                    toast.error(result.message || 'Delete failed');
                    return;
                  }
                  toast.success('Comparison removed');
                }}
              />
            )}
          </div>
        )}

        {view === 'batch' && (
          <div className="fade-up">
            <div className="mb-7">
              <h1 className="font-serif text-[28px]">Batch upload</h1>
              <p className="text-[13px] text-muted mt-1">Upload a queue of files, process them together, and review a combined AI report.</p>
            </div>
            <BatchUploadWorkspace />
          </div>
        )}

        {view === 'collaboration' && (
          <div className="fade-up">
            <div className="flex items-start justify-between gap-4 mb-7">
              <div>
                <h1 className="font-serif text-[28px]">Collaboration</h1>
                <p className="text-[13px] text-muted mt-1">Invite collaborators, discuss changes, track activity, and use AI suggestions in one workspace.</p>
              </div>
              <button type="button" className="btn-outline" onClick={() => loadCollaboration()} disabled={!selectedDocId || collaborationLoading}>
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            <div className="card p-6 mb-5">
              <div
                className={`rounded-2xl border border-dashed p-5 mb-4 transition-colors ${
                  collabUploadDragging ? 'border-accent bg-accent-light/30' : 'border-black/10 bg-surface2/40'
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setCollabUploadDragging(true);
                }}
                onDragLeave={() => setCollabUploadDragging(false)}
                onDrop={handleCollabFileDrop}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-ink">Upload a local file</p>
                    <p className="text-[12px] text-muted mt-1">
                      Click to choose a TXT, PDF, or DOCX file, or drop one here to add it to collaboration.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="btn-outline cursor-pointer">
                      <input
                        type="file"
                        accept=".txt,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        className="hidden"
                        onChange={handleCollabFilePick}
                      />
                      Choose file
                    </label>
                    <button
                      type="button"
                      className="btn-accent"
                      onClick={handleCollabUpload}
                      disabled={collabUploading || !collabUploadFile}
                    >
                      {collabUploading ? `Uploading ${collabUploadProgress}%` : 'Upload file'}
                    </button>
                  </div>
                </div>
                {collabUploadFile ? (
                  <p className="text-[12px] text-muted mt-3">
                    Selected: <strong className="text-ink">{collabUploadFile.name}</strong>
                  </p>
                ) : null}
              </div>

              <label className="text-[13px] font-medium block mb-2">Select a document</label>
              <div className="relative">
                <FileText size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <select
                  className="input pl-11 pr-4 py-3 rounded-2xl"
                  value={selectedDocId}
                  onChange={(event) => setSelectedDocId(event.target.value)}
                >
                  <option value="">Choose a document</option>
                  {documents.map((doc) => (
                    <option key={doc._id} value={doc._id}>{doc.originalName}</option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedDocId ? (
              <div className="card p-8">
                <div className="max-w-sm mx-auto rounded-2xl border border-dashed border-black/15 bg-[#fbfaf7] px-8 py-10 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-light text-accent">
                    <Users size={22} />
                  </div>
                  <h3 className="text-[18px] font-semibold text-ink">Start Collaborating</h3>
                  <p className="text-[13px] text-muted mt-2 leading-6">
                    Pick a document to invite teammates, leave comments, and track activity together.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="space-y-4">
                  <div className="card p-4">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-[14px] font-semibold">Collaborators</h3>
                        <p className="text-[12px] text-muted mt-1">Invite teammates and set their roles for this document.</p>
                      </div>
                      <button type="button" className="btn-outline text-[12px] px-3 py-2" onClick={addPartner}>
                        <Plus size={14} />
                        Add
                      </button>
                    </div>

                    <div className="space-y-3">
                      {partners.map((partner, index) => (
                        <div key={`${partner.email}-${index}`} className="rounded-2xl border border-black/[0.06] bg-[#fbfaf7] p-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-accent-light text-accent font-semibold">
                              {avatarLetters(partner.name || partner.email || `P${index + 1}`)}
                            </div>
                            <div className="flex-1 space-y-3">
                              <Field label={`Partner ${index + 1} name`}>
                                <input className="input" value={partner.name} onChange={(event) => updatePartner(index, 'name', event.target.value)} placeholder="Full name" />
                              </Field>
                              <Field label="Email">
                                <input className="input" value={partner.email} onChange={(event) => updatePartner(index, 'email', event.target.value)} placeholder="name@example.com" />
                              </Field>
                              <Field label="Role">
                                <select className="input" value={partner.role} onChange={(event) => updatePartner(index, 'role', event.target.value)}>
                                  <option value="editor">Editor</option>
                                  <option value="reviewer">Reviewer</option>
                                  <option value="approver">Approver</option>
                                </select>
                              </Field>
                              <RolePermissionsInfo role={partner.role} />
                              <div className="flex gap-2">
                                <button type="button" className="btn-ghost justify-center w-full" onClick={() => removePartner(index)} disabled={partners.length === 1}>
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button type="button" className="btn-outline" onClick={addPartner}>
                        <Users size={14} />
                        Add partner
                      </button>
                      <button type="button" className="btn-accent" onClick={savePartners}>
                        Save
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <CollabSummaryBar summary={collabSummary} />

                  <div className="card p-4 mb-4 relative">
                    {collabLoading && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-10">
                        <div className="w-5 h-5 border-2 border-slate-300 border-t-accent rounded-full animate-spin" />
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex gap-2">
                        <button type="button" className={collabFilters.resolved === null ? 'btn-accent' : 'btn-outline'} onClick={() => setCollabFilter('resolved', null)}>All</button>
                        <button type="button" className={collabFilters.resolved === false ? 'btn-accent' : 'btn-outline'} onClick={() => setCollabFilter('resolved', false)}>Unresolved</button>
                        <button type="button" className={collabFilters.resolved === true ? 'btn-accent' : 'btn-outline'} onClick={() => setCollabFilter('resolved', true)}>Resolved</button>
                      </div>
                      <div className="flex items-center gap-2 text-[12px]">
                        <span className={`w-2 h-2 rounded-full ${collabSseConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                        <span className={collabSseConnected ? 'text-green-700' : 'text-muted'}>{collabSseConnected ? 'Live' : 'Offline'}</span>
                      </div>
                    </div>

                    <CommentInput
                      submitting={collabSubmitting}
                      placeholder="Share updates, ask questions, or leave feedback..."
                      onSubmit={async (content) => {
                        const result = await addComment(content);
                        if (!result?.success) {
                          toast.error(result?.message || 'Could not add comment');
                          return;
                        }
                        toast.success('Comment added');
                      }}
                    />

                    <div className="mt-4 max-h-[560px] overflow-y-auto space-y-3 pr-1">
                      {!comments.length && !collabLoading && (
                        <div className="rounded-xl border border-dashed border-black/10 bg-surface2 px-4 py-8 text-center text-[13px] text-muted">
                          No comments yet. Start the discussion.
                        </div>
                      )}
                      {comments.map((comment) => (
                        <CommentThread
                          key={comment._id}
                          comment={comment}
                          currentUserEmail={user?.email}
                          onResolve={async (id) => {
                            const result = await resolveComment(id);
                            if (!result?.success) return toast.error(result?.message || 'Could not resolve comment');
                            return toast.success('Comment resolved');
                          }}
                          onEdit={async (id, content) => {
                            const result = await editComment(id, content);
                            if (!result?.success) toast.error(result?.message || 'Could not edit comment');
                            else toast.success('Comment updated');
                            return result;
                          }}
                          onDelete={async (id) => {
                            const result = await removeComment(id);
                            if (!result?.success) return toast.error(result?.message || 'Could not delete comment');
                            return toast.success('Comment deleted');
                          }}
                          onReact={async (id, emoji) => {
                            const result = await addReaction(id, emoji);
                            if (!result?.success) toast.error(result?.message || 'Could not add reaction');
                            return result;
                          }}
                          onReply={async (parentId, content) => {
                            const result = await addComment(content, parentId);
                            if (!result?.success) toast.error(result?.message || 'Could not add reply');
                            else toast.success('Reply added');
                            return result;
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-black/10" />

                  <CollabEventFeed events={collabEvents} loading={collabLoading} />
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'activity' && (
          <div className="fade-up">
            <div className="flex items-start justify-between mb-7">
              <div>
                <h1 className="font-serif text-[28px]">Live activity</h1>
                <p className="text-[13px] text-muted mt-1">Track every analysis with filters, stats, and live updates.</p>
              </div>
              <span className={`badge ${sseConnected ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                {sseConnected ? 'Live' : 'Polling'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4">
              <StatPill label="Total analyses" value={statsLoading ? '-' : activityStats.totalAnalyses || 0} />
              <StatPill label="Completed today" value={statsLoading ? '-' : activityStats.completedToday || 0} />
              <StatPill label="Failed today" value={statsLoading ? '-' : activityStats.failedToday || 0} />
              <StatPill
                label="Avg processing time"
                value={statsLoading ? '-' : `${Number(activityStats.avgProcessingMs || 0) / 1000}s`}
              />
            </div>

            <div className="card p-4 mb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <select className="input w-[160px]" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
                    <option value="">All status</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                  </select>

                  <select className="input w-[180px]" value={filters.mode} onChange={(event) => setFilter('mode', event.target.value)}>
                    <option value="">All modes</option>
                    <option value="all">Full analysis</option>
                    <option value="summarization">Summarization</option>
                    <option value="sentiment">Sentiment</option>
                    <option value="categorization">Categorization</option>
                  </select>

                  <input type="date" className="input w-[165px]" value={filters.dateFrom} onChange={(event) => setFilter('dateFrom', event.target.value)} />
                  <input type="date" className="input w-[165px]" value={filters.dateTo} onChange={(event) => setFilter('dateTo', event.target.value)} />

                  {(filters.status || filters.mode || filters.dateFrom || filters.dateTo) && (
                    <button type="button" className="btn-ghost" onClick={clearFilters}>Clear filters</button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[12px]">
                  <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                  <span className={sseConnected ? 'text-green-700' : 'text-muted'}>{sseConnected ? 'Live' : 'Polling'}</span>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="max-h-[500px] overflow-y-auto space-y-3 pr-1">
                {!activityItems.length && !activityLoading && (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-surface2 py-12 text-center">
                    <Activity size={20} className="mx-auto text-muted mb-2" />
                    <p className="text-[13px] text-muted">No activity matches your filters</p>
                  </div>
                )}

                {activityItems.map((item) => (
                  <ActivityRow key={item.id} item={item} onOpen={() => navigate(`/analyse/${item.analysisId}`)} />
                ))}
              </div>

              {hasMore && (
                <div className="mt-4 flex justify-center">
                  <button type="button" className="btn-outline" onClick={fetchMore} disabled={activityLoading}>
                    {activityLoading && activityPage > 1 ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {activeGuide && (
        <ToolGuideModal toolKey={activeGuide} onClose={() => setActiveGuide(null)} />
      )}

      <LibraryDetailModal
        row={libraryDetailDoc}
        onClose={() => setLibraryDetailDoc(null)}
        onOpenResult={(analysisId) => {
          setLibraryDetailDoc(null);
          navigate(`/analyse/${analysisId}`);
        }}
      />

      <DeleteDocumentModal
        document={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteDocument}
      />
    </div>
  );
}

function RoleBadge({ role }) {
  const classes = {
    owner: 'bg-black text-white',
    editor: 'bg-blue-50 text-blue-700',
    reviewer: 'bg-amber-50 text-amber-700',
    approver: 'bg-green-50 text-green-700',
    viewer: 'bg-surface2 text-muted',
  };

  return <span className={`badge ${classes[role] || classes.viewer}`}>{role}</span>;
}

function OverviewStatCard({ icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-muted">{label}</p>
          <p className="mt-2 text-[30px] font-light leading-none text-ink">{value}</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-surface2 text-accent flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-[12px] leading-5 text-muted">{detail}</p>
    </div>
  );
}

function GettingStartedPanel({ onUpload }) {
  const steps = [
    { icon: <UploadCloud size={18} />, title: 'Upload document', text: 'Add a readable TXT, PDF, or DOCX file.' },
    { icon: <BarChart3 size={18} />, title: 'Run analysis', text: 'Choose the mode and generate structured results.' },
    { icon: <MessageSquareText size={18} />, title: 'Ask questions', text: 'Use document Q&A to clarify details and next steps.' },
  ];

  return (
    <section className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center">
      <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-accent-light text-accent flex items-center justify-center">
        <FileText size={22} />
      </div>
      <h2 className="font-serif text-[28px] leading-tight">Start your document workspace</h2>
      <p className="mx-auto mt-2 max-w-xl text-[14px] text-muted">
        Upload your first document to unlock summaries, extracted signals, document Q&A, collaboration, and comparisons.
      </p>

      <div className="grid gap-3 md:grid-cols-3 my-7 text-left">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-xl border border-black/[0.08] bg-[#fbfaf7] p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-accent border border-black/[0.06]">
                {step.icon}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Step {index + 1}</span>
            </div>
            <h3 className="text-[14px] font-semibold text-ink">{step.title}</h3>
            <p className="mt-1 text-[12px] leading-5 text-muted">{step.text}</p>
          </div>
        ))}
      </div>

      <button type="button" className="btn-accent" onClick={onUpload}>
        <UploadCloud size={15} />
        Upload Document
      </button>
    </section>
  );
}

function RecentDocumentsPanel({ rows, onView, onOpenResult, onAnalyze, onLibrary }) {
  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white shadow-[0_14px_40px_rgba(15,23,42,0.05)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/[0.08]">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Recent documents</h2>
          <p className="text-[12px] text-muted mt-0.5">Your five latest uploads and their current status.</p>
        </div>
        <button type="button" className="btn-ghost text-[12px]" onClick={onLibrary}>
          View all
        </button>
      </div>

      <div className="divide-y divide-black/[0.06]">
        {rows.map((row) => {
          const color = fileTypeColor(row.doc.fileType);
          const wordCount = row.doc.wordCount || row.analysis?.readability?.wordCount;
          return (
            <div key={row.doc._id} className="px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color.bg }}>
                    <FileText size={18} style={{ color: color.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate max-w-[360px]" title={row.doc.originalName}>
                      {row.doc.originalName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <span className="uppercase">{row.doc.fileType}</span>
                      <span>{formatDate(row.doc.createdAt)}</span>
                      <span>{wordCount ? `${Number(wordCount).toLocaleString()} words` : 'Words unavailable'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${statusBadgeClass(row.status)}`}>
                    {statusIcon(row.status)}
                    {statusLabel(row.status)}
                  </span>
                  <button type="button" className="btn-outline text-[12px] px-3 py-1.5" onClick={() => onView(row)}>
                    <Eye size={12} />
                    Details
                  </button>
                  {row.analysis?._id ? (
                    <button type="button" className="btn-primary text-[12px] px-3 py-1.5" onClick={() => onOpenResult(row)}>
                      <BarChart3 size={12} />
                      Open
                    </button>
                  ) : (
                    <button type="button" className="btn-accent text-[12px] px-3 py-1.5" onClick={() => onAnalyze(row)}>
                      Analyze
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentActivityPanel({ items, onOpen, onActivity }) {
  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white shadow-[0_14px_40px_rgba(15,23,42,0.05)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/[0.08]">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Recent activity</h2>
          <p className="text-[12px] text-muted mt-0.5">Latest analysis runs from this workspace.</p>
        </div>
        <button type="button" className="btn-ghost text-[12px]" onClick={onActivity}>
          Activity
        </button>
      </div>

      <div className="p-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 bg-surface2 px-4 py-8 text-center">
            <Activity size={20} className="mx-auto text-muted mb-2" />
            <p className="text-[13px] text-muted">No analysis activity yet.</p>
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.analysis._id}
              type="button"
              className="w-full rounded-xl border border-black/[0.06] bg-[#fbfaf7] px-4 py-3 text-left hover:border-black/15 transition-colors"
              onClick={() => onOpen(item)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">{item.documentName}</p>
                  <p className="text-[12px] text-muted mt-1">{item.message}</p>
                </div>
                <span className={`badge ${statusBadgeClass(item.status)} shrink-0`}>
                  {statusIcon(item.status)}
                  {statusLabel(item.status)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className={`badge ${modeBadgeClass(item.analysis.mode)} text-[10px]`}>{modeLabel(item.analysis.mode)}</span>
                <span className="text-[11px] text-muted">{formatDate(item.analysis.createdAt)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function LibraryStat({ label, value }) {
  return (
    <div className="card px-4 py-3">
      <p className="font-semibold text-[22px] text-ink leading-none">{value}</p>
      <p className="text-[11px] text-muted mt-1">{label}</p>
    </div>
  );
}

function LibraryRow({ row, onView, onOpenResult, onAnalyze, onCompare, onDelete, canCompare }) {
  const { doc, analysis, status } = row;
  const color = fileTypeColor(doc.fileType);
  const wordCount = doc.wordCount || analysis?.readability?.wordCount;

  return (
    <tr className="border-b border-black/[0.06] hover:bg-surface2 transition-colors">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3 min-w-[260px]">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: color.bg }}>
            <FileText size={17} style={{ color: color.color }} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink truncate max-w-[280px]" title={doc.originalName}>
              {doc.originalName || 'Untitled document'}
            </p>
            <p className="text-[11px] text-muted mt-0.5">{formatFileSize(doc.fileSize)}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="badge bg-surface2 text-muted uppercase text-[10px] tracking-wide">
          {doc.fileType || 'file'}
        </span>
      </td>
      <td className="px-5 py-4 text-[13px] text-muted">
        {wordCount ? Number(wordCount).toLocaleString() : '-'}
      </td>
      <td className="px-5 py-4 text-[13px] text-muted">
        {formatDate(doc.createdAt)}
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-col items-start gap-1.5">
          <span className={`badge ${statusBadgeClass(status)}`}>
            {statusIcon(status)}
            {statusLabel(status)}
          </span>
          {analysis?.mode && (
            <span className={`badge ${modeBadgeClass(analysis.mode)} text-[10px]`}>
              {modeLabel(analysis.mode)}
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-wrap gap-2 min-w-[320px]">
          <button type="button" onClick={onView} className="btn-outline text-[12px] px-3 py-1.5">
            <Eye size={12} />
            Details
          </button>
          {analysis?._id ? (
            <button type="button" onClick={onOpenResult} className="btn-primary text-[12px] px-3 py-1.5">
              <BarChart3 size={12} />
              View result
            </button>
          ) : (
            <button type="button" onClick={onAnalyze} className="btn-accent text-[12px] px-3 py-1.5">
              <BarChart3 size={12} />
              Analyze
            </button>
          )}
          {analysis?._id && (
            <button type="button" onClick={onAnalyze} className="btn-outline text-[12px] px-3 py-1.5">
              Re-analyze
            </button>
          )}
          {canCompare && (
            <button type="button" onClick={onCompare} className="btn-ghost text-[12px] px-3 py-1.5">
              <GitCompareArrows size={12} />
              Compare
            </button>
          )}
          <button type="button" onClick={onDelete} className="btn-ghost text-[12px] px-3 py-1.5 hover:bg-red-50 hover:text-red-600">
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function LibraryDetailModal({ row, onClose, onOpenResult }) {
  if (!row) return null;
  const { doc, analysis, status } = row;
  const color = fileTypeColor(doc.fileType);
  const wordCount = doc.wordCount || analysis?.readability?.wordCount;

  return (
    <Modal isOpen={Boolean(row)} onClose={onClose}>
      <div className="w-[min(620px,calc(100vw-32px))]">
        <div className="flex items-start gap-4 pr-8 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: color.bg }}>
            <FileText size={22} style={{ color: color.color }} />
          </div>
          <div className="min-w-0">
            <p className="section-eyebrow mb-2">Document details</p>
            <h2 className="font-serif text-[26px] leading-tight break-words">{doc.originalName}</h2>
            <p className="text-[13px] text-muted mt-2">
              Uploaded {formatDate(doc.createdAt)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 mb-6">
          <DetailMetric label="File type" value={(doc.fileType || 'unknown').toUpperCase()} />
          <DetailMetric label="File size" value={formatFileSize(doc.fileSize)} />
          <DetailMetric label="Word count" value={wordCount ? Number(wordCount).toLocaleString() : 'Not available'} />
          <DetailMetric label="Status" value={statusLabel(status)} />
        </div>

        {analysis ? (
          <div className="rounded-xl border border-black/[0.08] bg-[#fbfaf7] p-4 mb-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold">Latest analysis</p>
                <p className="text-[12px] text-muted mt-0.5">
                  {modeLabel(analysis.mode)} - {formatDate(analysis.createdAt)}
                </p>
              </div>
              <span className={`badge ${statusBadgeClass(analysis.status)}`}>{statusLabel(analysis.status)}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-5 text-[13px] text-amber-800">
            This document has not been analysed yet.
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {analysis?._id && (
            <button type="button" className="btn-primary" onClick={() => onOpenResult(analysis._id)}>
              <BarChart3 size={14} />
              View result
            </button>
          )}
          <button type="button" className="btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteDocumentModal({ document, onCancel, onConfirm }) {
  return (
    <Modal isOpen={Boolean(document)} onClose={onCancel}>
      <div className="w-[min(460px,calc(100vw-32px))] pr-8">
        <div className="flex gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-ink">Delete document?</h2>
            <p className="text-[13px] leading-6 text-muted mt-1">
              This removes the uploaded file and related analyses for <strong className="text-ink">{document?.originalName}</strong>.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-accent bg-red-600 hover:bg-red-700" onClick={onConfirm}>
            <Trash2 size={14} />
            Delete document
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DetailMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-[#fbfaf7] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-[14px] font-semibold text-ink mt-1">{value}</p>
    </div>
  );
}

function buildLibraryRows(documents, analyses, search, type, status, sort) {
  const latestAnalysisByDoc = new Map();
  (analyses || []).forEach((analysis) => {
    const docId = analysis.document?._id || analysis.document;
    if (!docId) return;
    const current = latestAnalysisByDoc.get(String(docId));
    if (!current || new Date(analysis.createdAt).getTime() > new Date(current.createdAt).getTime()) {
      latestAnalysisByDoc.set(String(docId), analysis);
    }
  });

  const query = search.trim().toLowerCase();
  return (documents || [])
    .map((doc) => {
      const analysis = latestAnalysisByDoc.get(String(doc._id));
      return {
        doc,
        analysis,
        status: normalizeLibraryStatus(analysis?.status || doc.status),
      };
    })
    .filter((row) => {
      if (query && !String(row.doc.originalName || '').toLowerCase().includes(query)) return false;
      if (type !== 'all' && row.doc.fileType !== type) return false;
      if (status !== 'all' && row.status !== status) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'oldest') return new Date(a.doc.createdAt).getTime() - new Date(b.doc.createdAt).getTime();
      if (sort === 'name') return String(a.doc.originalName || '').localeCompare(String(b.doc.originalName || ''));
      if (sort === 'largest') return Number(b.doc.fileSize || 0) - Number(a.doc.fileSize || 0);
      return new Date(b.doc.createdAt).getTime() - new Date(a.doc.createdAt).getTime();
    });
}

function buildOverviewStats(documents, analyses) {
  const completedAnalyses = (analyses || []).filter((analysis) => analysis.status === 'completed').length;
  const processingAnalyses = (analyses || []).filter((analysis) => ['pending', 'processing'].includes(analysis.status)).length;
  const failedAnalyses = (analyses || []).filter((analysis) => analysis.status === 'failed').length;
  const breakdown = ['txt', 'pdf', 'docx']
    .map((type) => `${type.toUpperCase()} ${(documents || []).filter((doc) => doc.fileType === type).length}`)
    .join(' / ');

  return {
    totalDocuments: documents?.length || 0,
    totalAnalyses: analyses?.length || 0,
    completedAnalyses,
    processingAnalyses,
    failedAnalyses,
    processingOrFailed: processingAnalyses + failedAnalyses,
    totalWords: totalWordsProcessed(documents, analyses),
    fileBreakdown: breakdown,
  };
}

function buildRecentAnalysisItems(analyses) {
  return (analyses || [])
    .filter((analysis) => analysis.document)
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, 5)
    .map((analysis) => ({
      analysis,
      status: normalizeLibraryStatus(analysis.status),
      documentName: analysis.document?.originalName || 'Document',
      message: activityMessage(analysis),
    }));
}

function activityMessage(analysis) {
  if (analysis.status === 'completed') {
    const seconds = analysis.processingTimeMs ? ` in ${(Number(analysis.processingTimeMs) / 1000).toFixed(1)}s` : '';
    return `${modeLabel(analysis.mode)} completed${seconds}.`;
  }
  if (analysis.status === 'failed') return analysis.errorMessage || `${modeLabel(analysis.mode)} failed.`;
  if (analysis.status === 'processing') return `${modeLabel(analysis.mode)} is processing.`;
  return `${modeLabel(analysis.mode)} is queued.`;
}

function totalWordsProcessed(documents, analyses) {
  const wordsFromDocuments = (documents || []).reduce((sum, doc) => sum + Number(doc.wordCount || 0), 0);
  if (wordsFromDocuments > 0) return wordsFromDocuments;

  const latestByDoc = new Map();
  (analyses || []).forEach((analysis) => {
    const docId = analysis.document?._id || analysis.document;
    const wordCount = Number(analysis.readability?.wordCount || 0);
    if (!docId || !wordCount) return;
    const current = latestByDoc.get(String(docId));
    if (!current || new Date(analysis.createdAt).getTime() > current.createdAt) {
      latestByDoc.set(String(docId), { wordCount, createdAt: new Date(analysis.createdAt).getTime() });
    }
  });

  return Array.from(latestByDoc.values()).reduce((sum, item) => sum + item.wordCount, 0);
}

function normalizeLibraryStatus(status) {
  if (status === 'done') return 'completed';
  if (status === 'error') return 'failed';
  if (status === 'pending') return 'processing';
  return status || 'uploaded';
}

function statusLabel(status) {
  const labels = {
    uploaded: 'Uploaded',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
  };
  return labels[normalizeLibraryStatus(status)] || 'Uploaded';
}

function statusBadgeClass(status) {
  const normalized = normalizeLibraryStatus(status);
  if (normalized === 'completed') return 'bg-green-50 text-green-700';
  if (normalized === 'processing') return 'bg-amber-50 text-amber-700';
  if (normalized === 'failed') return 'bg-red-50 text-red-700';
  return 'bg-surface2 text-muted';
}

function statusIcon(status) {
  const normalized = normalizeLibraryStatus(status);
  if (normalized === 'completed') return <CheckCircle2 size={12} />;
  if (normalized === 'processing') return <Clock3 size={12} />;
  if (normalized === 'failed') return <AlertTriangle size={12} />;
  return <FileText size={12} />;
}

function sortLabel(sort) {
  const labels = {
    newest: 'Newest first',
    oldest: 'Oldest first',
    name: 'Name A-Z',
    largest: 'Largest file',
  };
  return labels[sort] || labels.newest;
}

function formatLibrarySize(documents) {
  const total = (documents || []).reduce((sum, doc) => sum + Number(doc.fileSize || 0), 0);
  return formatFileSize(total);
}

function createPartner() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: '',
    email: '',
    role: 'editor',
  };
}

function avatarLetters(value = '') {
  const text = String(value || '').trim();
  if (!text) return 'P';

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function ActivityItem({ item }) {
  const color =
    item.type === 'invite'
      ? 'bg-blue-50 text-blue-700'
      : item.type === 'comment'
        ? 'bg-amber-50 text-amber-700'
        : item.type === 'ai'
          ? 'bg-purple-50 text-purple-700'
          : 'bg-surface2 text-muted';

  return (
    <div className="rounded-lg bg-[#fbfaf7] border border-black/[0.06] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className={`badge ${color}`}>{item.type}</span>
        <span className="text-[11px] text-muted">{formatDate(item.createdAt)}</span>
      </div>
      <p className="text-[13px] font-medium mt-2">{item.message}</p>
      <p className="text-[12px] text-muted">{item.actorName}</p>
    </div>
  );
}

function ToolPage({ icon, title, desc, note }) {
  return (
    <div className="fade-up">
      <div className="mb-7">
        <div className="inline-flex items-center gap-2 badge bg-accent-light text-accent mb-3">{icon}{title}</div>
        <h1 className="font-serif text-[28px]">{title}</h1>
        <p className="text-[13px] text-muted mt-1">{desc}</p>
      </div>
      <div className="card p-12 text-center border-dashed border-2 border-black/20">
        <div className="text-4xl mb-4">📄</div>
        <h3 className="text-[16px] font-semibold mb-2">Feature guidance</h3>
        <p className="text-[13px] text-muted max-w-[520px] mx-auto">{note}</p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-ink block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function ActivityRow({ item, onOpen }) {
  const statusClass = item.status === 'completed'
    ? 'bg-green-50 text-green-700'
    : item.status === 'failed'
      ? 'bg-red-50 text-red-700'
      : 'bg-amber-50 text-amber-700';
  const dotColor = fileTypeColor(item.documentName?.split('.').pop()).bg;
  const processingSeconds = item.processingTimeMs ? `${(Number(item.processingTimeMs) / 1000).toFixed(1)}s` : '-';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full rounded-xl bg-[#fbfaf7] border border-black/[0.06] px-4 py-3 text-left transition-all hover:border-black/15 ${item.status === 'processing' ? 'border-l-4 border-l-amber-300 animate-pulse' : ''}`}
    >
      <div className="grid grid-cols-[1.2fr_1fr_180px] items-center gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: dotColor }} />
            <p className="text-[13px] font-medium text-ink truncate">{truncate(item.documentName || 'Document', 40)}</p>
            <span className={`badge ${modeBadgeClass(item.mode)} text-[10px]`}>{modeLabel(item.mode)}</span>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`badge ${statusClass}`}>
              {item.status === 'completed' ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
              {item.status}
            </span>
          </div>
          <p className="text-[12px] text-muted truncate">{item.message}</p>
        </div>

        <div className="text-right">
          <p className="text-[12px] text-ink">{processingSeconds}</p>
          <p className="text-[11px] text-muted mt-1">{formatDate(item.createdAt)}</p>
        </div>
      </div>
    </button>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="card px-4 py-3">
      <p className="font-semibold text-[22px] text-ink leading-none">{value}</p>
      <p className="text-[11px] text-muted mt-1">{label}</p>
    </div>
  );
}
