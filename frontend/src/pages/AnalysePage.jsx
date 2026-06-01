import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Highlighter,
  MessageCircle,
  Search,
  Languages,
  FileText,
  RefreshCw,
} from 'lucide-react';
import UploadZone from '../components/Analysis/UploadZone';
import ModeSelector from '../components/Analysis/ModeSelector';
import ResultPanel from '../components/Analysis/ResultPanel';
import Modal from '../components/UI/Modal';
import { useDocumentStore } from '../store/documentStore';
import { useAuthStore } from '../store/authStore';
import { formatDate, formatFileSize } from '../utils/formatters';
import { analysisService } from '../services/analysisService';
import toast from 'react-hot-toast';

const LEGEND_ITEMS = [
  { key: 'neutral', label: 'Highlights on', tone: 'bg-surface2 text-muted border border-black/10' },
  { key: 'positive', label: 'Positive', tone: 'bg-green-50 text-green-700' },
  { key: 'negative', label: 'Negative', tone: 'bg-red-50 text-red-700' },
  { key: 'keyword', label: 'Key phrase', tone: 'bg-blue-50 text-blue-700' },
  { key: 'entity', label: 'Entity', tone: 'bg-amber-50 text-amber-700' },
];

const POSITIVE_PHRASES = ['strong', 'growth', 'improved', 'increase', 'record', 'positive', 'confidence', 'momentum', 'retention', 'all-time high', 'exceptional', 'अच्छा', 'सफल', 'बेहतर', 'वृद्धि', 'समृद्ध', 'गौरवशाली', 'सम्मान', 'प्रगति', 'उपलब्धि'];
const NEGATIVE_PHRASES = ['decline', 'pressure', 'pressures', 'risk', 'headwind', 'headwinds', 'loss', 'negative', 'fluctuation', 'concern', 'macroeconomic', 'नुकसान', 'जोखिम', 'कमजोर', 'गिरावट', 'चुनौती', 'समस्या', 'कठिन'];

export default function AnalysePage() {
  const { analysisId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    currentDoc,
    currentAnalysis,
    runAnalysis,
    fetchAnalysis,
    analysing,
    loading,
    error,
  } = useDocumentStore();
  const user = useAuthStore((state) => state.user);

  const [mode, setMode] = useState('all');
  const [step, setStep] = useState('upload');
  const [selection, setSelection] = useState('');
  const [selectionTranslation, setSelectionTranslation] = useState('');
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  useEffect(() => {
    if (analysisId) {
      fetchAnalysis(analysisId);
      setStep('result');
      return;
    }

    if (currentDoc) {
      setStep('mode');
      return;
    }

    setStep('upload');
  }, [analysisId, currentDoc, fetchAnalysis, location.key]);

  const handleUploaded = () => {
    setAnalysisError('');
    setStep('mode');
  };

  const handleAnalyse = async () => {
    if (!currentDoc) return;

    setAnalysisError('');
    const loadingToast = toast.loading("Analysing document...");

    try {
      const res = await runAnalysis(
        currentDoc._id,
        mode,
        user?.defaultLanguage || 'auto'
      );

      toast.dismiss(loadingToast);

      if (res.success) {
        toast.success("Analysis completed!");
        setStep('result');
        navigate(`/analyse/${res.analysis._id}`, { replace: true });
      } else {
        setAnalysisError(res.message || 'Analysis failed. Please try again.');
        toast.error(res.message);
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      setAnalysisError('Something went wrong while analysing this document. Please try again.');
      toast.error("Something went wrong!");
    }
  };

  const doc = currentAnalysis?.document || currentDoc;
  const previewText = doc?.extractedText || '';
  const highlightTerms = useMemo(() => buildHighlightTerms(currentAnalysis), [currentAnalysis]);
  const analysisStatus = currentAnalysis?.status || (analysing ? 'processing' : step === 'result' ? 'completed' : 'waiting');
  const wordCount = currentAnalysis?.readability?.wordCount || doc?.wordCount;

  const handleSelection = () => {
    const selected = window.getSelection()?.toString()?.trim() || '';
    setSelection(selected.length >= 2 ? selected.slice(0, 300) : '');
  };

  const translateSelection = async () => {
    if (!currentAnalysis?._id || !selection) return;
    setSelectionLoading(true);
    try {
      const res = await analysisService.selectionAction(currentAnalysis._id, {
        text: selection,
        action: 'translate',
        language: currentAnalysis.language || user?.defaultLanguage || 'en',
      });
      setSelectionTranslation(res.data.data.translation || '');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Selection translation failed.');
    } finally {
      setSelectionLoading(false);
    }
  };

  const webSearchSelection = async () => {
    if (!currentAnalysis?._id || !selection) return;
    try {
      const res = await analysisService.selectionAction(currentAnalysis._id, {
        text: selection,
        action: 'search',
      });
      const url = res.data.data.searchUrl;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Search link could not be created.');
    }
  };

  if (loading && analysisId && !currentAnalysis) {
    return (
      <AnalyseShell>
        <ProcessingState title="Loading analysis..." text="Fetching the saved analysis results." />
      </AnalyseShell>
    );
  }

  if ((analysing || currentAnalysis?.status === 'processing') && step === 'result') {
    return (
      <AnalyseShell>
        <StepIndicator active="Analyze" />
        <ProcessingState title="Analysing your document..." text="This usually takes 5-15 seconds." />
      </AnalyseShell>
    );
  }

  if (step === 'result' && currentAnalysis?.status === 'failed') {
    return (
      <AnalyseShell>
        <StepIndicator active="Analyze" />
        <StateCard
          tone="error"
          title="Analysis could not be completed"
          text={currentAnalysis.errorMessage || error || 'The document uploaded, but analysis failed. Try again, or upload a text-based TXT, PDF, or DOCX file.'}
          action={doc ? (
            <button type="button" onClick={handleAnalyse} className="btn-accent">
              <RefreshCw size={15} />
              Retry analysis
            </button>
          ) : null}
        />
      </AnalyseShell>
    );
  }

  if (step === 'result' && currentAnalysis) {
    return (
      <div className="fade-up min-h-[calc(100vh-60px)] bg-bg">
        <div className="max-w-[1120px] mx-auto p-6 md:p-8">
          <StepIndicator active="Review" />

          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between mb-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-green-50 text-green-700 border border-green-100 px-3 py-1.5 text-[12px] font-semibold mb-4">
                <CheckCircle size={13} />
                Analysis complete
              </div>
              <h1 className="font-serif text-[34px] leading-tight">Document analysis</h1>
              <p className="text-[14px] text-muted mt-2">
                Review the explanation, main idea, key takeaways, and extracted document signals.
              </p>
            </div>
          </div>

          <SummaryBar
            document={doc}
            status={analysisStatus}
            wordCount={wordCount}
            createdAt={doc?.createdAt || currentAnalysis.createdAt}
            onViewFile={() => setPreviewOpen(true)}
          />

          <div className="mt-5 rounded-2xl border border-accent/15 bg-accent-light/60 p-5 md:p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-ink">Ask follow-up questions separately</h2>
              <p className="text-[13px] text-muted mt-1">
                Ask questions about this document in a dedicated AI chat.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/analyse/${currentAnalysis._id}/ask`)}
              className="btn-accent px-5 py-3 rounded-xl justify-center"
            >
              <MessageCircle size={16} />
              Ask AI
            </button>
          </div>

          <div className="mt-7">
            <ResultPanel analysis={currentAnalysis} document={doc} />
          </div>
        </div>

        <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)}>
          <div className="w-[min(900px,calc(100vw-32px))] max-h-[calc(100vh-80px)] overflow-hidden">
            <div className="pr-8 mb-5">
              <p className="section-eyebrow mb-2">Uploaded file</p>
              <h2 className="font-serif text-[26px] leading-tight">{doc?.originalName || 'Document preview'}</h2>
              <p className="text-[13px] text-muted mt-2">
                {doc?.fileType?.toUpperCase() || 'Unknown type'} - {formatFileSize(doc?.fileSize)} - Uploaded {formatDate(doc?.createdAt || currentAnalysis.createdAt)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {LEGEND_ITEMS.map((item) => (
                <span key={item.key} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium ${item.tone}`}>
                  {item.key === 'neutral' ? <Highlighter size={12} /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                  {item.label}
                </span>
              ))}
            </div>

            {selection && (
              <div className="rounded-2xl bg-surface2 px-4 py-3 mb-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted mb-1">Selected text</p>
                    <p className="text-[13px] text-ink">{selection}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" className="btn-outline text-[12px] px-3 py-2" onClick={webSearchSelection}>
                      <Search size={13} />
                      Web search
                    </button>
                    <button type="button" className="btn-accent text-[12px] px-3 py-2" onClick={translateSelection} disabled={selectionLoading}>
                      <Languages size={13} />
                      {selectionLoading ? 'Translating...' : 'Translate'}
                    </button>
                  </div>
                </div>
                {selectionTranslation && (
                  <>
                    <p className="text-[11px] uppercase tracking-wide text-muted mt-3 mb-1">Translated output</p>
                    <p className="text-[13px] text-ink whitespace-pre-wrap">{selectionTranslation}</p>
                  </>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-black/[0.08] bg-[#fbfaf7] p-5 max-h-[52vh] overflow-y-auto text-[14px] leading-8 text-ink whitespace-pre-wrap" onMouseUp={handleSelection}>
              {previewText ? (
                <HighlightedText text={previewText} terms={highlightTerms} />
              ) : (
                <p className="text-muted">Document preview is not available for this analysis yet.</p>
              )}
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  if (analysing) {
    return (
      <AnalyseShell>
        <StepIndicator active="Analyze" />
        <ProcessingState title="Analysing your document..." text="This usually takes 5-15 seconds." />
      </AnalyseShell>
    );
  }

  return (
    <div className="max-w-[980px] mx-auto px-6 md:px-8 py-10 md:py-12 fade-up">
      <div className="mb-8">
        <p className="section-eyebrow mb-2">Analyse</p>
        <h1 className="font-serif text-[36px] leading-tight mb-3">Analyse a document</h1>
        <p className="text-[15px] text-muted max-w-2xl">
          Upload a text-based TXT, PDF, or DOCX file, choose the analysis depth, then review the summary and ask questions.
        </p>
      </div>

      <StepIndicator active={currentDoc ? 'Analyze' : 'Upload'} />

      {analysisError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-6 text-red-700">
          <div className="flex gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-800">Analysis failed</p>
              <p>{analysisError}</p>
              <p className="mt-1">Check that the file contains selectable text, then retry the analysis.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="section-eyebrow mb-2">Step 1 - Upload file</p>
              <h2 className="text-[18px] font-semibold text-ink">Start with a readable document</h2>
            </div>
            {currentDoc && (
              <span className="badge bg-green-50 text-green-700 border border-green-100">
                Ready
              </span>
            )}
          </div>

        {currentDoc ? (
          <div className="rounded-xl border border-green-200 bg-green-50/60 p-5 flex items-center gap-4">
            <CheckCircle size={20} className="text-green-500 shrink-0" />
            <div className="flex-1">
              <p className="text-[14px] font-semibold">{currentDoc.originalName}</p>
              <p className="text-[12px] text-muted">{formatFileSize(currentDoc.fileSize)} - {currentDoc.fileType?.toUpperCase()}</p>
            </div>
            <button type="button" onClick={() => { clearCurrent(); setStep('upload'); setAnalysisError(''); }} className="text-[12px] text-muted hover:text-ink bg-transparent border-none cursor-pointer">
              Change
            </button>
          </div>
        ) : (
          <>
            <EmptyUploadState />
            <UploadZone onUploaded={handleUploaded} />
          </>
        )}
        </div>

        <aside className="rounded-2xl border border-black/[0.08] bg-[#fbfaf7] p-5">
          <p className="section-eyebrow mb-3">Workflow</p>
          <div className="space-y-4">
            <MiniStep done={!!currentDoc} title="Upload" text="Add a supported document." />
            <MiniStep done={step === 'result'} active={!!currentDoc && step !== 'result'} title="Analyze" text="Choose the mode and run analysis." />
            <MiniStep done={step === 'result'} title="Review" text="Read the summary and signals." />
            <MiniStep active={step === 'result'} title="Ask" text="Use Q&A for follow-ups." />
          </div>
        </aside>
      </div>

      {(step === 'mode' || currentDoc) && (
        <div className="mt-6 rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)] fade-up">
          <div className="mb-5">
            <p className="section-eyebrow mb-2">Step 2 - Choose analysis mode</p>
            <h2 className="text-[18px] font-semibold text-ink">Select what DocuWise should focus on</h2>
          </div>
          <ModeSelector selected={mode} onChange={setMode} />
        </div>
      )}
      {currentDoc && (
        <div className="mt-6 rounded-2xl border border-accent/15 bg-accent-light/60 p-5 md:p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between fade-up">
          <div>
            <h2 className="text-[18px] font-semibold text-ink">Ready to analyze</h2>
            <p className="text-[13px] text-muted mt-1">The result will include summary cards, extracted signals, and document Q&A.</p>
          </div>
          <button type="button" onClick={handleAnalyse} className="btn-accent px-8 py-3 text-[15px] rounded-xl justify-center">
            Analyse document
          </button>
        </div>
      )}
    </div>
  );
}

// --- Helper Functions ---

function AnalyseShell({ children }) {
  return (
    <div className="fade-up min-h-[calc(100vh-60px)] bg-bg">
      <div className="max-w-[980px] mx-auto px-6 md:px-8 py-10 md:py-12">
        <div className="mb-8">
          <p className="section-eyebrow mb-2">Analyse</p>
          <h1 className="font-serif text-[36px] leading-tight mb-3">Analyse a document</h1>
          <p className="text-[15px] text-muted max-w-2xl">
            Upload, analyze, review, then ask questions about the document.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

function StepIndicator({ active }) {
  const steps = ['Upload', 'Analyze', 'Review', 'Ask'];
  const activeIndex = Math.max(0, steps.indexOf(active));

  return (
    <nav aria-label="Analysis progress" className="mb-8">
      <ol className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {steps.map((label, index) => {
          const complete = index < activeIndex;
          const current = index === activeIndex;
          return (
            <li key={label}>
              <div
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-[13px] ${
                  complete
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : current
                      ? 'border-accent/30 bg-accent-light text-accent'
                      : 'border-black/[0.08] bg-white text-muted'
                }`}
                aria-current={current ? 'step' : undefined}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  complete ? 'bg-green-600 text-white' : current ? 'bg-accent text-white' : 'bg-surface2 text-muted'
                }`}>
                  {complete ? <CheckCircle size={13} /> : index + 1}
                </span>
                <span className="font-semibold">{label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SummaryBar({ document, status, wordCount, createdAt, onViewFile }) {
  const items = [
    { label: 'File name', value: document?.originalName || 'Uploaded document' },
    { label: 'File type', value: document?.fileType?.toUpperCase() || 'Unknown' },
    { label: 'Words', value: wordCount ? Number(wordCount).toLocaleString() : 'Not available' },
    { label: 'Status', value: sentenceCase(status) },
  ];

  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-4 md:p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]" aria-label="Analysis summary">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:flex-1">
          {items.map((item) => (
            <div key={item.label} className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{item.label}</p>
              <p className="mt-1 truncate text-[13px] font-semibold text-ink" title={String(item.value)}>{item.value}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span className="text-[12px] text-muted">Uploaded {formatDate(createdAt)}</span>
          <button type="button" onClick={onViewFile} className="btn-outline text-[13px] px-4 py-2.5">
            <FileText size={14} />
            View Uploaded File
          </button>
        </div>
      </div>
    </section>
  );
}

function EmptyUploadState() {
  return (
    <div className="mb-5 rounded-xl border border-black/[0.06] bg-[#fbfaf7] px-4 py-3 text-[13px] leading-6 text-muted">
      No document selected yet. Choose a supported file with selectable text to unlock analysis modes.
    </div>
  );
}

function ProcessingState({ title, text }) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white px-6 py-12 text-center shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
      <Loader2 size={40} className="text-accent animate-spin mx-auto mb-5" />
      <h2 className="font-serif text-[26px] mb-2">{title}</h2>
      <p className="text-[14px] text-muted">{text}</p>
      <div className="mt-6 mx-auto h-2 max-w-xs overflow-hidden rounded-full bg-surface2">
        <div className="h-full w-1/2 rounded-full bg-accent progress-pulse" />
      </div>
    </div>
  );
}

function StateCard({ tone, title, text, action }) {
  const isError = tone === 'error';
  return (
    <div className={`rounded-2xl border p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)] ${
      isError ? 'border-red-200 bg-red-50' : 'border-black/[0.08] bg-white'
    }`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <AlertCircle size={20} className={isError ? 'text-red-600 mt-1 shrink-0' : 'text-accent mt-1 shrink-0'} />
          <div>
            <h2 className="text-[18px] font-semibold text-ink">{title}</h2>
            <p className="text-[13px] leading-6 text-muted mt-1 max-w-2xl">{text}</p>
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}

function MiniStep({ done = false, active = false, title, text }) {
  return (
    <div className="flex gap-3">
      <span className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
        done ? 'border-green-600 bg-green-600 text-white' : active ? 'border-accent bg-accent text-white' : 'border-black/10 bg-white text-muted'
      }`}>
        {done ? <CheckCircle size={13} /> : ''}
      </span>
      <div>
        <p className="text-[13px] font-semibold text-ink">{title}</p>
        <p className="text-[12px] leading-5 text-muted">{text}</p>
      </div>
    </div>
  );
}

function buildHighlightTerms(analysis) {
  if (!analysis) return [];
  const keywordTerms = (analysis.keywords || []).map((value) => ({ value, kind: 'keyword', priority: 3 }));
  const entityTerms = (analysis.entities || []).map((entity) => ({ value: entity.value, kind: 'entity', priority: 4 }));
  const sentimentHighlights = analysis.sentiment?.highlights || {};
  const positiveTerms = [...(sentimentHighlights.positive || []), ...POSITIVE_PHRASES]
    .map((value) => ({ value, kind: 'positive', priority: 5 }));
  const negativeTerms = [...(sentimentHighlights.negative || []), ...NEGATIVE_PHRASES]
    .map((value) => ({ value, kind: 'negative', priority: 5 }));
  const neutralTerms = (sentimentHighlights.neutral || [])
    .map((value) => ({ value, kind: 'neutral', priority: 1 }));

  const merged = [...entityTerms, ...keywordTerms, ...positiveTerms, ...negativeTerms, ...neutralTerms]
    .filter((term) => term.value && term.value.trim().length >= 3)
    .sort((a, b) => b.priority - a.priority || b.value.length - a.value.length);

  const seen = new Set();
  return merged.filter((term) => {
    const key = `${term.kind}:${term.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function HighlightedText({ text, terms }) {
  if (!text) return null;
  if (!terms.length) return <>{text}</>;
  const segments = [];
  let cursor = 0;
  const lowerText = text.toLowerCase();

  while (cursor < text.length) {
    let match = null;
    for (const term of terms) {
      const index = lowerText.indexOf(term.value.toLowerCase(), cursor);
      if (index === -1) continue;
      if (!match || index < match.index || (index === match.index && term.value.length > match.term.value.length)) {
        match = { index, term };
      }
    }
    if (!match) {
      segments.push({ text: text.slice(cursor), kind: 'plain' });
      break;
    }
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index), kind: 'plain' });
    const end = match.index + match.term.value.length;
    segments.push({ text: text.slice(match.index, end), kind: match.term.kind });
    cursor = end;
  }

  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === 'plain' ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <mark key={index} className={highlightClass(segment.kind)}>{segment.text}</mark>
        )
      )}
    </>
  );
}

function highlightClass(kind) {
  const base = 'rounded px-1 py-0.5';
  if (kind === 'positive') return `bg-green-100 text-green-900 ${base}`;
  if (kind === 'negative') return `bg-red-100 text-red-900 ${base}`;
  if (kind === 'neutral') return `bg-gray-100 text-gray-800 ${base}`;
  if (kind === 'entity') return `bg-amber-100 text-amber-900 ${base}`;
  if (kind === 'keyword') return `bg-blue-100 text-blue-900 ${base}`;
  return `bg-surface2 text-ink ${base}`;
}

function sentenceCase(value) {
  return value ? String(value).charAt(0).toUpperCase() + String(value).slice(1) : value;
}
