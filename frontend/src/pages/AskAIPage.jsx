import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  BookOpen,
  CheckCircle,
  FileText,
  Highlighter,
  Languages,
  ListChecks,
  Loader2,
  MessageCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import QAChat from '../components/Analysis/QAChat';
import Modal from '../components/UI/Modal';
import { useDocumentStore } from '../store/documentStore';
import { useAuthStore } from '../store/authStore';
import { analysisService } from '../services/analysisService';
import { formatDate, formatFileSize } from '../utils/formatters';
import toast from 'react-hot-toast';

const SUGGESTED_QUESTIONS = [
  'What is this document mainly about?',
  'What are the key takeaways?',
  'Explain this in simple language.',
  'What should I pay attention to?',
  'What questions should I ask about this document?',
];

const LEGEND_ITEMS = [
  { key: 'neutral', label: 'Highlights on', tone: 'bg-surface2 text-muted border border-black/10' },
  { key: 'positive', label: 'Positive', tone: 'bg-green-50 text-green-700' },
  { key: 'negative', label: 'Negative', tone: 'bg-red-50 text-red-700' },
  { key: 'keyword', label: 'Key phrase', tone: 'bg-blue-50 text-blue-700' },
  { key: 'entity', label: 'Entity', tone: 'bg-amber-50 text-amber-700' },
];

const POSITIVE_PHRASES = ['strong', 'growth', 'improved', 'increase', 'record', 'positive', 'confidence', 'momentum', 'retention', 'all-time high', 'exceptional'];
const NEGATIVE_PHRASES = ['decline', 'pressure', 'pressures', 'risk', 'headwind', 'headwinds', 'loss', 'negative', 'fluctuation', 'concern', 'macroeconomic'];

export default function AskAIPage() {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { currentDoc, currentAnalysis, fetchAnalysis, loading } = useDocumentStore();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState(null);
  const [aiGuide, setAiGuide] = useState(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [selection, setSelection] = useState('');
  const [selectionTranslation, setSelectionTranslation] = useState('');
  const [selectionLoading, setSelectionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (currentAnalysis?._id === analysisId) {
      setPageLoading(false);
      return undefined;
    }

    if (analysisId) {
      setPageLoading(true);
      fetchAnalysis(analysisId).finally(() => {
        if (!cancelled) setPageLoading(false);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [analysisId, currentAnalysis?._id, fetchAnalysis]);

  useEffect(() => {
    let cancelled = false;
    if (!analysisId) return undefined;

    setGuideLoading(true);
    setGuideError('');
    analysisService.aiGuide(analysisId)
      .then((res) => {
        if (!cancelled) setAiGuide(res.data.data || null);
      })
      .catch(() => {
        if (!cancelled) {
          setGuideError('AI helper tools are unavailable right now. Chat still works.');
          setAiGuide(null);
        }
      })
      .finally(() => {
        if (!cancelled) setGuideLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  const analysisMatchesRoute = currentAnalysis?._id === analysisId;
  const analysis = analysisMatchesRoute ? currentAnalysis : null;
  const storedDocMatchesAnalysis = currentDoc?._id && currentDoc._id === analysis?.document?._id;
  const doc = storedDocMatchesAnalysis ? { ...analysis?.document, ...currentDoc } : analysis?.document;
  const previewText = doc?.extractedText || '';
  const highlightTerms = useMemo(() => buildHighlightTerms(analysis), [analysis]);
  const suggestedQuestions = aiGuide?.suggestedQuestions?.length
    ? [...new Set([...aiGuide.suggestedQuestions, ...SUGGESTED_QUESTIONS])].slice(0, 7)
    : SUGGESTED_QUESTIONS;

  const handleSuggestedQuestion = (question) => {
    setDraftQuestion({ text: question, nonce: Date.now() });
  };

  const handleSelection = () => {
    const selected = window.getSelection()?.toString()?.trim() || '';
    setSelection(selected.length >= 2 ? selected.slice(0, 300) : '');
  };

  const translateSelection = async () => {
    if (!analysis?._id || !selection) return;
    setSelectionLoading(true);
    try {
      const res = await analysisService.selectionAction(analysis._id, {
        text: selection,
        action: 'translate',
        language: analysis.language || user?.defaultLanguage || 'en',
      });
      setSelectionTranslation(res.data.data.translation || '');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Selection translation failed.');
    } finally {
      setSelectionLoading(false);
    }
  };

  const webSearchSelection = async () => {
    if (!analysis?._id || !selection) return;
    try {
      const res = await analysisService.selectionAction(analysis._id, {
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

  if ((loading || pageLoading) && !analysis) {
    return (
      <AskShell>
        <div className="rounded-2xl border border-black/[0.08] bg-white px-6 py-12 text-center shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
          <Loader2 size={38} className="text-accent animate-spin mx-auto mb-5" />
          <h1 className="font-serif text-[28px] leading-tight">Loading Ask AI</h1>
          <p className="text-[14px] text-muted mt-2">Fetching the document context for this chat.</p>
        </div>
      </AskShell>
    );
  }

  if (!analysis) {
    return (
      <AskShell>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
          <h1 className="font-serif text-[28px] leading-tight text-ink">Analysis not found</h1>
          <p className="text-[14px] text-red-700 mt-2">
            This analysis could not be loaded. It may have been deleted or is unavailable to this account.
          </p>
          <button type="button" onClick={() => navigate('/dashboard')} className="btn-accent mt-5">
            Back to Dashboard
          </button>
        </div>
      </AskShell>
    );
  }

  if (analysis.status === 'failed') {
    return (
      <AskShell>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
          <h1 className="font-serif text-[28px] leading-tight text-ink">Ask AI is unavailable</h1>
          <p className="text-[14px] text-red-700 mt-2">
            This analysis failed, so there is no document context available for questions.
          </p>
          <button type="button" onClick={() => navigate(`/analyse/${analysisId}`)} className="btn-accent mt-5">
            Back to Review
          </button>
        </div>
      </AskShell>
    );
  }

  if (analysis.status === 'processing') {
    return (
      <AskShell>
        <div className="rounded-2xl border border-black/[0.08] bg-white px-6 py-12 text-center shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
          <Loader2 size={38} className="text-accent animate-spin mx-auto mb-5" />
          <h1 className="font-serif text-[28px] leading-tight">Analysis is still running</h1>
          <p className="text-[14px] text-muted mt-2">The chat will be available once the review is complete.</p>
        </div>
      </AskShell>
    );
  }

  return (
    <AskShell>
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between mb-6">
        <div>
          <p className="section-eyebrow mb-2">Ask AI</p>
          <h1 className="font-serif text-[36px] leading-tight">Document Q&A workspace</h1>
          <p className="text-[14px] text-muted mt-2 max-w-2xl">
            Ask focused questions against the completed analysis and document text.
          </p>
        </div>
        <button type="button" onClick={() => navigate(`/analyse/${analysisId}`)} className="btn-outline text-[13px] px-4 py-2.5">
          <ArrowLeft size={14} />
          Back to Review
        </button>
      </div>

      <section className="rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-accent-light text-accent flex items-center justify-center shrink-0">
              <FileText size={22} />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-green-50 text-green-700 border border-green-100 px-3 py-1.5 text-[12px] font-semibold mb-2">
                <CheckCircle size={13} />
                Analysis complete
              </div>
              <h2 className="text-[20px] font-semibold text-ink truncate" title={doc?.originalName || 'Uploaded document'}>
                {doc?.originalName || 'Uploaded document'}
              </h2>
              <p className="text-[12px] text-muted mt-1">
                {doc?.fileType?.toUpperCase() || 'Unknown type'} - {formatFileSize(doc?.fileSize)} - Uploaded {formatDate(doc?.createdAt || analysis.createdAt)}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setPreviewOpen(true)} className="btn-outline text-[13px] px-4 py-2.5 justify-center">
            <FileText size={14} />
            View Uploaded File
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start mt-6">
        <aside className="space-y-4 lg:sticky lg:top-6">
          <section className="rounded-2xl border border-black/[0.08] bg-[#fbfaf7] p-5 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-accent" />
                <h2 className="text-[15px] font-semibold text-ink">Suggested questions</h2>
              </div>
              {aiGuide?.provider && (
                <span className="rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] font-semibold uppercase text-muted">
                  {aiGuide.provider}
                </span>
              )}
            </div>
            {guideLoading && (
              <div className="mb-3 flex items-center gap-2 text-[12px] text-muted">
                <Loader2 size={13} className="animate-spin" />
                Loading AI helper tools...
              </div>
            )}
            {guideError && (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-700">
                {guideError}
              </p>
            )}
            <div className="grid gap-2">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => handleSuggestedQuestion(question)}
                  className="rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-left text-[13px] leading-5 text-ink hover:border-accent/40 hover:bg-accent-light/50 transition-all"
                >
                  {question}
                </button>
              ))}
            </div>
          </section>

          <StudyGuideCard guide={aiGuide} loading={guideLoading} />
          <TakeawaysCard items={aiGuide?.keyTakeaways || []} />
          <GlossaryCard items={aiGuide?.glossary || []} />

          <section className="rounded-2xl border border-black/[0.08] bg-white p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Bot size={15} className="text-accent" />
              Chat context
            </div>
            <p className="text-[12px] leading-5 text-muted mt-2">
              Answers use the saved analysis and document extraction already available in DocuWise.
            </p>
          </section>
        </aside>

        <main className="min-w-0">
          <div className="mb-4 rounded-2xl border border-accent/15 bg-accent-light/60 p-4 flex gap-3">
            <MessageCircle size={18} className="text-accent mt-0.5 shrink-0" />
            <p className="text-[13px] leading-6 text-muted">
              Choose a suggested question to fill the chat box, or type your own question below.
            </p>
          </div>
          <QAChat
            analysisId={analysis._id}
            initialHistory={analysis.qaHistory || []}
            draftQuestion={draftQuestion}
            showQuickQuestions={false}
          />
        </main>
      </div>

      <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)}>
        <div className="w-[min(900px,calc(100vw-32px))] max-h-[calc(100vh-80px)] overflow-hidden">
          <div className="pr-8 mb-5">
            <p className="section-eyebrow mb-2">Uploaded file</p>
            <h2 className="font-serif text-[26px] leading-tight">{doc?.originalName || 'Document preview'}</h2>
            <p className="text-[13px] text-muted mt-2">
              {doc?.fileType?.toUpperCase() || 'Unknown type'} - {formatFileSize(doc?.fileSize)} - Uploaded {formatDate(doc?.createdAt || analysis.createdAt)}
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
    </AskShell>
  );
}

function StudyGuideCard({ guide, loading }) {
  const studyGuide = guide?.studyGuide || {};
  const keyPoints = Array.isArray(studyGuide.keyPoints) ? studyGuide.keyPoints : [];
  const thingsToRemember = Array.isArray(studyGuide.thingsToRemember) ? studyGuide.thingsToRemember : [];

  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen size={16} className="text-accent" />
        <h2 className="text-[15px] font-semibold text-ink">Study Guide</h2>
      </div>
      {loading && !guide ? (
        <p className="text-[12px] leading-5 text-muted">Preparing a document guide...</p>
      ) : (
        <>
          <p className="text-[13px] leading-6 text-ink">
            {studyGuide.overview || 'A study guide will appear here when helper tools are available.'}
          </p>
          {keyPoints.length > 0 && (
            <>
              <p className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Key points</p>
              <BulletList items={keyPoints} />
            </>
          )}
          {thingsToRemember.length > 0 && (
            <>
              <p className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Things to remember</p>
              <BulletList items={thingsToRemember} />
            </>
          )}
        </>
      )}
    </section>
  );
}

function TakeawaysCard({ items }) {
  if (!items.length) return null;
  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks size={16} className="text-accent" />
        <h2 className="text-[15px] font-semibold text-ink">Key Takeaways</h2>
      </div>
      <BulletList items={items} />
    </section>
  );
}

function GlossaryCard({ items }) {
  if (!items.length) return null;
  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-5">
      <h2 className="text-[15px] font-semibold text-ink mb-3">Glossary</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.term} className="rounded-xl bg-[#fbfaf7] border border-black/[0.06] px-3 py-2.5">
            <p className="text-[13px] font-semibold text-ink">{item.term}</p>
            <p className="text-[12px] leading-5 text-muted mt-1">{item.meaning}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BulletList({ items }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-[12px] leading-5 text-muted">
          <span className="mt-[8px] h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function AskShell({ children }) {
  return (
    <div className="fade-up min-h-[calc(100vh-60px)] bg-bg">
      <div className="max-w-[1180px] mx-auto p-6 md:p-8">
        {children}
      </div>
    </div>
  );
}

function buildHighlightTerms(analysis) {
  if (!analysis) return [];
  const keywordTerms = (analysis.keywords || []).map((value) => ({ value, kind: 'keyword', priority: 3 }));
  const entityTerms = (analysis.entities || []).map((entity) => ({ value: entity.value, kind: 'entity', priority: 4 }));
  const positiveTerms = POSITIVE_PHRASES.map((value) => ({ value, kind: 'positive', priority: 2 }));
  const negativeTerms = NEGATIVE_PHRASES.map((value) => ({ value, kind: 'negative', priority: 2 }));

  const merged = [...entityTerms, ...keywordTerms, ...positiveTerms, ...negativeTerms]
    .filter((term) => term.value && term.value.trim().length >= 3)
    .sort((a, b) => b.value.length - a.value.length || b.priority - a.priority);

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
  if (kind === 'entity') return `bg-amber-100 text-amber-900 ${base}`;
  if (kind === 'keyword') return `bg-blue-100 text-blue-900 ${base}`;
  return `bg-surface2 text-ink ${base}`;
}
