import React from 'react';
import {
  AlignLeft,
  Grid2x2,
  Smile,
  Tag,
  User,
  BookOpen,
  Download,
  Copy,
  Share2,
  Languages,
} from 'lucide-react';
import SentimentBars from './SentimentBars';
import EntityList from './EntityList';
import toast from 'react-hot-toast';

const LANGUAGE_LABELS = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  hi: 'Hindi',
  zh: 'Chinese',
  ar: 'Arabic',
  pt: 'Portuguese',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  ru: 'Russian',
  unknown: 'Unknown',
};

export default function ResultPanel({ analysis, document }) {
  if (!analysis) return null;
  const summarySections = parseSummary(analysis.summary);

  const copyText = async (text, message = 'Copied to clipboard!') => {
    if (!text?.trim()) {
      toast.error('Nothing to copy yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  const shareResult = async () => {
    const shareData = {
      title: `${document?.originalName || 'Document'} analysis`,
      text: analysis.summary || 'DocuWise analysis result',
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success('Share sheet opened.');
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied!');
      }
    } catch {
      toast.error('Share action was cancelled or unavailable.');
    }
  };

  const downloadReport = () => {
    const reportHtml = buildPrintableReport(analysis, document);
    const printWindow = window.open('', '_blank', 'width=900,height=1000');

    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to export the report.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);

    toast.success('Print dialog opened. Choose "Save as PDF" to download.');
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-black/[0.07] bg-white p-5 md:p-7 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div className="flex flex-col gap-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-50 text-amber-700 px-3 py-1.5 text-[12px] font-semibold">
              <AlignLeft size={13} />
              Human Explanation
            </div>
            <h2 className="font-serif text-[30px] leading-tight text-ink">Document explanation</h2>
            <p className="text-[13px] text-muted max-w-2xl">
              DocuWise explains the meaning, practical implications, and points worth checking before you ask follow-up questions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => copyText(analysis.summary || '', 'Summary copied!')}
            className="btn-outline text-[13px] px-4 py-2.5 md:mt-1"
          >
            <Copy size={14} />
            Copy summary
          </button>
        </div>

        {analysis.summary ? (
          <SummaryGrid sections={summarySections} />
        ) : (
          <EmptyState text="Summary is not available for this analysis yet." />
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Analysis details">
        <ResultBlock icon={<Smile size={14} className="text-rose-500" />} title="Sentiment">
        {analysis.sentiment?.overall ? (
          <>
            <SentimentBars sentiment={analysis.sentiment} />
            <p className="text-[12px] text-muted mt-3">
              Overall:{' '}
              <strong className={sentimentToneClass(analysis.sentiment.overall)}>
                {sentenceCase(analysis.sentiment.overall)}
              </strong>
            </p>
          </>
        ) : (
          <EmptyState text="Sentiment scores are not available for this analysis yet." />
        )}
        </ResultBlock>

        <ResultBlock icon={<Grid2x2 size={14} className="text-emerald-500" />} title="Categories">
        {analysis.categories?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {analysis.categories.map((cat) => (
              <span key={cat} className="badge bg-surface2 text-ink text-[12px] px-3 py-1.5">
                {cat}
              </span>
            ))}
          </div>
        ) : (
          <EmptyState text="No categories were returned for this analysis." />
        )}
        </ResultBlock>

        <ResultBlock icon={<User size={14} className="text-violet-500" />} title="Key entities">
        {analysis.entities?.length > 0 ? (
          <EntityList entities={analysis.entities} />
        ) : (
          <EmptyState text="No key entities were found for this analysis." />
        )}
        </ResultBlock>

        <ResultBlock icon={<Tag size={14} className="text-accent" />} title="Top keywords">
        {analysis.keywords?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {analysis.keywords.map((kw) => (
              <span key={kw} className="badge bg-surface2 text-ink text-[12px] px-3 py-1.5">
                {kw}
              </span>
            ))}
          </div>
        ) : (
          <EmptyState text="Top keywords are not available for this analysis yet." />
        )}
        </ResultBlock>

      {analysis.translation && analysis.language && analysis.language !== analysis.sourceLanguage && (
        <ResultBlock icon={<Languages size={14} className="text-indigo-500" />} title="Translation">
          <p className="text-[12px] text-muted mb-3">
            Output language: <strong className="text-ink">{LANGUAGE_LABELS[analysis.language] || analysis.language.toUpperCase()}</strong>
          </p>
          <p className="text-[13px] leading-7 text-ink whitespace-pre-wrap">{analysis.translation}</p>
          </ResultBlock>
        )}

        {analysis.readability?.wordCount && (
          <ResultBlock icon={<BookOpen size={14} className="text-sky-500" />} title="Readability">
          <div className="space-y-2">
            {analysis.readability.fleschKincaid !== null && (
              <Row
                label="Flesch-Kincaid grade"
                value={Number(analysis.readability.fleschKincaid).toFixed(1)}
              />
            )}
            <Row label="Word count" value={analysis.readability.wordCount?.toLocaleString()} />
          </div>
          </ResultBlock>
        )}
      </section>

      {analysis.processingTimeMs && (
        <p className="text-[11px] text-muted text-center">
          Completed in {(analysis.processingTimeMs / 1000).toFixed(1)}s
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-2 border-t border-black/[0.09]">
        <button
          onClick={() => copyText(analysis.summary || analysis.translation || '', 'Summary copied!')}
          className="btn-primary justify-center text-[13px] py-2.5"
        >
          <Copy size={14} />
          Copy summary
        </button>
        <button
          onClick={downloadReport}
          className="btn-outline justify-center text-[13px] py-2.5"
        >
          <Download size={14} />
          Download PDF report
        </button>
        <button
          onClick={shareResult}
          className="btn-ghost justify-center text-[13px]"
        >
          <Share2 size={14} />
          Share link
        </button>
      </div>
    </div>
  );
}

function ResultBlock({ icon, title, children }) {
  return (
    <div className="bg-[#fbfaf7] rounded-2xl p-5 border border-black/[0.08] shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <h3 className="text-[13px] font-semibold flex items-center gap-2 mb-4">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function SummaryGrid({ sections }) {
  const primary = sections.find((section) => section.key === 'documentExplanation') || sections[0];
  const secondary = sections.filter((section) => section !== primary);
  const primarySection = primary?.key === 'about'
    ? { ...primary, title: 'Document Explanation' }
    : primary;

  return (
    <div className="grid gap-4">
      {primarySection && <SummaryCard section={primarySection} featured />}
      {secondary.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-2">
          {secondary.map((section) => (
            <SummaryCard key={section.key || section.title} section={section} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ section, featured = false }) {
  const lines = normalizeSummaryLines(section.content);
  const isBulletSection = /takeaways|concepts|pay attention/i.test(section.title);
  const mainPoints = section.key === 'mainPointsExplained' ? parseMainPoints(section.content) : [];

  return (
    <article
      className={`rounded-2xl border p-5 md:p-6 ${
        featured
          ? 'bg-gradient-to-br from-[#fffaf0] to-white border-amber-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
          : 'bg-white border-black/[0.08] shadow-[0_1px_0_rgba(0,0,0,0.02)]'
      }`}
    >
      <h3 className={`${featured ? 'text-[18px]' : 'text-[14px]'} font-semibold text-ink mb-3`}>
        {section.title}
      </h3>
      {mainPoints.length > 0 ? (
        <div className="space-y-3">
          {mainPoints.map((point) => (
            <div key={point.title} className="rounded-xl border border-black/[0.07] bg-[#fbfaf7] p-4">
              <h4 className="text-[13px] font-semibold text-ink mb-1">{point.title}</h4>
              <p className="text-[13px] leading-6 text-ink">{point.explanation}</p>
            </div>
          ))}
        </div>
      ) : isBulletSection && lines.length > 1 ? (
        <ul className="space-y-2">
          {lines.map((line) => (
            <li key={line} className="flex gap-2 text-[14px] leading-7 text-ink">
              <span className="mt-[11px] h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={`${featured ? 'text-[15px]' : 'text-[14px]'} leading-8 text-ink space-y-3`}>
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </article>
  );
}

function parseSummary(summary) {
  const text = String(summary || '').trim();
  if (!text) return [];

  const pointerSections = parsePointerSummary(text);
  if (pointerSections.length > 0) return pointerSections;

  const definitions = [
    { key: 'documentExplanation', title: 'Document Explanation', marker: 'Document Explanation:' },
    { key: 'mainIdea', title: 'Main Idea', marker: 'Main Idea:' },
    { key: 'whatThisMeans', title: 'What This Means', marker: 'What This Means:' },
    { key: 'keyTakeaways', title: 'Key Takeaways', marker: 'Key Takeaways:' },
    { key: 'whyThisMatters', title: 'Why This Matters', marker: 'Why This Matters:' },
    { key: 'whatToPayAttentionTo', title: 'What To Pay Attention To', marker: 'What To Pay Attention To:' },
    { key: 'simpleExplanation', title: 'Simple Explanation', marker: 'Simple Explanation:' },
    { key: 'importantConcepts', title: 'Important Concepts', marker: 'Important Concepts:' },
    { key: 'limitations', title: 'Limitations', marker: 'Limitations:' },
  ];

  const matches = definitions
    .map((definition) => ({ ...definition, index: text.indexOf(definition.marker) }))
    .filter((definition) => definition.index >= 0)
    .sort((a, b) => a.index - b.index);

  if (matches.length === 0) {
    return [{ key: 'plainSummary', title: 'Summary', content: text }];
  }

  return matches.map((match, index) => {
    const start = match.index + match.marker.length;
    const end = matches[index + 1]?.index ?? text.length;
    return {
      key: match.key,
      title: match.title,
      content: text.slice(start, end).trim(),
    };
  }).filter((section) => section.content);
}

function parsePointerSummary(text) {
  const definitions = [
    { key: 'about', title: 'What this file is about', marker: '1. What this file is about' },
    { key: 'simpleExplanation', title: 'Simple explanation', marker: '2. Simple explanation' },
    { key: 'mainPointsExplained', title: 'Main points explained', marker: '3. Main points explained' },
    { key: 'realLifeMeaning', title: 'What this means in real life', marker: '4. What this means in real life' },
    { key: 'whatToPayAttentionTo', title: 'What you should pay attention to', marker: '5. What you should pay attention to' },
    { key: 'importantConcepts', title: 'Important terms explained', marker: '6. Important terms explained' },
    { key: 'finalTakeaway', title: 'Final takeaway', marker: '7. Final takeaway' },
  ];

  const matches = definitions
    .map((definition) => ({ ...definition, index: text.indexOf(definition.marker) }))
    .filter((definition) => definition.index >= 0)
    .sort((a, b) => a.index - b.index);

  if (matches.length < 3) return [];

  return matches.map((match, index) => {
    const start = match.index + match.marker.length;
    const end = matches[index + 1]?.index ?? text.length;
    return {
      key: match.key,
      title: match.title,
      content: text.slice(start, end).replace(/^[:\s]+/, '').trim(),
    };
  }).filter((section) => section.content);
}

function parseMainPoints(content) {
  const text = String(content || '').trim();
  if (!text) return [];

  return text
    .split(/\n(?=\*\s*Point\s+\d+:)/)
    .map((block) => block.trim())
    .map((block) => {
      const titleMatch = block.match(/^\*\s*Point\s+\d+:\s*(.+)$/m);
      const explanationMatch = block.match(/Explanation:\s*([\s\S]*)/i);
      const title = titleMatch?.[1]?.trim();
      const explanation = explanationMatch?.[1]?.replace(/\n+/g, ' ').trim();
      return title && explanation ? { title, explanation } : null;
    })
    .filter(Boolean);
}

function normalizeSummaryLines(content) {
  return String(content || '')
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 text-[13px]">
      <span className="text-muted">{label}</span>
      <strong className="text-right">{value}</strong>
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="text-[13px] text-muted leading-6">{text}</p>;
}

function sentenceCase(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function sentimentToneClass(value) {
  if (value === 'positive') return 'text-green-600';
  if (value === 'negative') return 'text-red-600';
  return 'text-muted';
}

function buildPrintableReport(analysis, document) {
  const title = document?.originalName || 'Document';
  const categories = (analysis.categories || []).join(', ') || 'Not available';
  const entities = (analysis.entities || [])
    .map((entity) => `${entity.type}: ${entity.value}`)
    .join('<br/>') || 'Not available';
  const keywords = (analysis.keywords || []).join(', ') || 'Not available';
  const translation = analysis.translation
    ? `<h3>Translation (${LANGUAGE_LABELS[analysis.language] || analysis.language})</h3><p>${escapeHtml(analysis.translation)}</p>`
    : '';

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)} - DocuWise Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #111827; line-height: 1.6; }
        h1, h2, h3 { margin: 0 0 12px; }
        h1 { font-size: 28px; }
        h2 { font-size: 18px; margin-top: 28px; }
        h3 { font-size: 15px; margin-top: 20px; }
        .muted { color: #6b7280; font-size: 13px; }
        .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px; margin-top: 16px; }
        .row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
        .bar { height: 10px; background: #eef2f7; border-radius: 999px; overflow: hidden; margin: 6px 0 12px; }
        .fill { height: 100%; border-radius: 999px; }
      </style>
    </head>
    <body>
      <h1>DocuWise Analysis Report</h1>
      <p class="muted">${escapeHtml(title)}</p>

      <div class="card">
        <h2>Human Explanation</h2>
        <p>${escapeHtml(analysis.summary || 'Not available')}</p>
      </div>

      <div class="card">
        <h2>Sentiment</h2>
        <div class="row"><span>Positive</span><strong>${analysis.sentiment?.positive ?? 0}%</strong></div>
        <div class="bar"><div class="fill" style="width:${analysis.sentiment?.positive ?? 0}%; background:#22c55e;"></div></div>
        <div class="row"><span>Neutral</span><strong>${analysis.sentiment?.neutral ?? 0}%</strong></div>
        <div class="bar"><div class="fill" style="width:${analysis.sentiment?.neutral ?? 0}%; background:#9ca3af;"></div></div>
        <div class="row"><span>Negative</span><strong>${analysis.sentiment?.negative ?? 0}%</strong></div>
        <div class="bar"><div class="fill" style="width:${analysis.sentiment?.negative ?? 0}%; background:#ef4444;"></div></div>
      </div>

      <div class="card"><h2>Categories</h2><p>${escapeHtml(categories)}</p></div>
      <div class="card"><h2>Key Entities</h2><p>${entities}</p></div>
      <div class="card"><h2>Top Keywords</h2><p>${escapeHtml(keywords)}</p></div>
      ${translation ? `<div class="card">${translation}</div>` : ''}
    </body>
  </html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br/>');
}
