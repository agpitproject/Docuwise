import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, ChevronRight, Clock, Copy, Send, Bot, User } from 'lucide-react';
import { analysisService } from '../../services/analysisService';
import toast from 'react-hot-toast';

const DEFAULT_GREETING =
  "Hello! I've analysed your document. Ask me anything about it, key metrics, specific sections, or anything you're curious about.";

const QUICK_QUESTIONS = [
  'What are the main takeaways?',
  'Which entities stand out most?',
  'What risks or concerns are mentioned?',
];

export default function QAChat({
  analysisId,
  initialHistory = [],
  draftQuestion = null,
  quickQuestions = QUICK_QUESTIONS,
  showQuickQuestions = true,
}) {
  const [messages, setMessages] = useState(() => buildMessages(initialHistory));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    setMessages(buildMessages(initialHistory));
  }, [analysisId, initialHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (draftQuestion?.text) {
      setInput(draftQuestion.text);
    }
  }, [draftQuestion]);

  const send = async (prefilledQuestion) => {
    const question = (prefilledQuestion ?? input).trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);

    try {
      const res = await analysisService.askQA(analysisId, question);
      const payload = res.data.data || {};
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: payload.answer || '',
          sources: Array.isArray(payload.sources) ? payload.sources : [],
          followUpQuestions: Array.isArray(payload.followUpQuestions) ? payload.followUpQuestions : [],
          confidence: payload.confidence,
          provider: payload.provider,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      toast.error('Failed to get answer. Please try again.');
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: "Sorry, I couldn't process that question. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]" aria-label="Document Q&A">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold flex items-center gap-2">
          <Bot size={16} className="text-accent" />
          Ask a question about this document
        </h2>
        <p className="mt-1 text-[12px] text-muted">Use the analysis context to clarify details, risks, and takeaways.</p>
      </div>

      {showQuickQuestions && quickQuestions.length > 0 && (
      <div className="flex flex-wrap gap-2 mb-4">
        {quickQuestions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => send(question)}
            disabled={loading}
            className="px-3 py-1.5 rounded-full border border-black/10 bg-surface2 text-[12px] text-muted hover:text-ink hover:bg-surface3 transition-all disabled:opacity-50"
          >
            {question}
          </button>
        ))}
      </div>
      )}

      <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                msg.role === 'user' ? 'bg-ink text-bg' : 'bg-accent-light text-accent'
              }`}
            >
              {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
            </div>
            {msg.role === 'user' ? (
              <div className="max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed bg-accent text-white rounded-tr-sm">
                {msg.text}
              </div>
            ) : (
              <AnswerBubble message={msg} onFollowUp={(question) => setInput(question)} />
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-accent-light flex items-center justify-center">
              <Bot size={13} className="text-accent" />
            </div>
            <div className="bg-surface2 rounded-xl rounded-tl-sm px-4 py-3 border border-black/[0.05]">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Ask anything about this document..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={loading}
          aria-label="Question about this document"
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="btn-accent px-3.5 py-2 rounded-lg disabled:opacity-50"
          aria-label="Send question"
        >
          <Send size={15} />
        </button>
      </div>
    </section>
  );
}

function buildMessages(history) {
  const seeded = history.flatMap((item) => [
    { role: 'user', text: item.question },
    { role: 'ai', text: item.answer, timestamp: item.timestamp },
  ]);

  return seeded.length > 0 ? seeded : [{ role: 'ai', text: DEFAULT_GREETING }];
}

function AnswerBubble({ message, onFollowUp }) {
  const sources = Array.isArray(message.sources) ? message.sources : [];
  const followUpQuestions = Array.isArray(message.followUpQuestions) ? message.followUpQuestions : [];
  const [sourcesOpen, setSourcesOpen] = useState(sources.length > 0);
  const [copied, setCopied] = useState(false);

  const copyAnswer = async () => {
    if (!message.text?.trim()) return;

    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy answer.');
    }
  };

  return (
    <div className="max-w-[88%] rounded-xl rounded-tl-sm border border-black/[0.06] bg-white px-4 py-3 text-ink shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {message.confidence && (
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${confidenceClass(message.confidence)}`}>
              {message.confidence} confidence
            </span>
          )}
          {message.provider && (
            <span className="rounded-full border border-black/10 bg-surface2 px-2 py-1 text-[10px] font-semibold uppercase text-muted">
              {formatProvider(message.provider)}
            </span>
          )}
          {message.timestamp && (
            <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-surface2 px-2 py-1 text-[10px] font-semibold uppercase text-muted">
              <Clock size={10} />
              {formatTime(message.timestamp)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={copyAnswer}
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-black/10 bg-surface2 px-2.5 py-1.5 text-[11px] font-semibold text-muted hover:text-ink transition-all"
          aria-label="Copy answer"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p className="whitespace-pre-wrap text-[13px] leading-7">{message.text}</p>

      {message.provider === 'fallback' && (
        <p className="mt-3 rounded-lg bg-surface2 px-3 py-2 text-[12px] leading-5 text-muted">
          Fallback answer based on extracted text.
        </p>
      )}

      {(sources.length > 0 || message.confidence || message.provider) && (
        <div className="mt-3 border-t border-black/[0.07] pt-3">
          <button
            type="button"
            onClick={() => setSourcesOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 rounded-lg bg-surface2 px-3 py-2 text-left text-[12px] font-semibold text-ink hover:bg-surface3 transition-all"
          >
            <span>Evidence used</span>
            <span className="flex items-center gap-2 text-[11px] text-muted">
              {sources.length > 0 ? `${sources.length} snippet${sources.length === 1 ? '' : 's'}` : 'No snippets'}
              {sourcesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>

          {sourcesOpen && (
            <div className="mt-2 space-y-2">
              {sources.length > 0 ? (
                sources.map((source, index) => (
                  <div key={`${source.snippet}-${index}`} className="rounded-lg border border-black/[0.06] bg-[#fbfaf7] px-3 py-2.5">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-ink">Source snippet {index + 1}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${relevanceClass(source.relevance)}`}>
                        {source.relevance || 'low'} relevance
                      </span>
                    </div>
                    <p className="text-[12px] leading-5 text-ink">{source.snippet}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-lg bg-surface2 px-3 py-2 text-[12px] leading-5 text-muted">
                  No direct snippet was returned for this answer.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {followUpQuestions.length > 0 && (
        <div className="mt-3 border-t border-black/[0.07] pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">Follow-up questions</p>
          <div className="flex flex-wrap gap-2">
            {followUpQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onFollowUp(question)}
                className="rounded-full border border-black/10 bg-surface2 px-3 py-1.5 text-left text-[12px] leading-4 text-muted hover:border-accent/40 hover:text-ink transition-all"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function confidenceClass(confidence) {
  if (confidence === 'high') return 'bg-green-50 text-green-700';
  if (confidence === 'medium') return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

function relevanceClass(relevance) {
  if (relevance === 'high') return 'bg-green-50 text-green-700';
  if (relevance === 'medium') return 'bg-amber-50 text-amber-700';
  return 'bg-surface2 text-muted';
}

function formatProvider(provider) {
  if (provider === 'gemini') return 'Gemini';
  if (provider === 'openai') return 'OpenAI';
  return 'Fallback';
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
