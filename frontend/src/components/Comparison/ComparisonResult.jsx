import React from 'react';
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle2, FileText, Sparkles } from 'lucide-react';
import { modeLabel, truncate } from '../../utils/formatters';

export default function ComparisonResult({ comparison }) {
  if (!comparison) return null;

  const { results, documentA, documentB } = comparison;

  if (comparison.status === 'failed') {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-5 mb-5">
        <div className="flex gap-3">
          <AlertTriangle size={20} className="text-red-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-[16px] font-semibold text-ink">Comparison failed</h2>
            <p className="text-[13px] text-red-700 mt-1">
              {comparison.errorMessage || 'The comparison could not be completed. Try again with two readable documents.'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!results) {
    return (
      <section className="rounded-2xl border border-black/[0.08] bg-white p-5 mb-5 text-[13px] text-muted">
        Comparison results are not available yet.
      </section>
    );
  }

  const score = clampScore(results.similarityScore);
  const documentTypes = results.documentTypes || {};
  const typeMatch = documentTypes.match !== false;
  const keyChanges = normalizeChangeList(results.keyChanges);
  const criticalAlerts = normalizeAlertList(results.criticalAlerts);
  const sideBySide = normalizeChangeList(results.sideBySideDiff);
  const executiveSummary = results.executiveSummary || results.summaryDiff || 'No executive summary was returned for this comparison.';
  const riskLevel = results.riskLevel || inferRiskLevel(criticalAlerts);
  const riskSummary = results.riskSummary || inferRiskSummary(riskLevel, typeMatch);
  const recommendationText = recommendation(score, riskLevel, typeMatch, keyChanges);

  return (
    <section className="mb-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <article className="space-y-5">
          <header className="rounded-3xl border border-black/[0.08] bg-white p-5 md:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-accent-light text-accent px-3 py-1.5 text-[12px] font-semibold mb-4">
                  <BarChart3 size={13} />
                  {modeLabel(comparison.mode)} comparison
                </div>
                <h2 className="font-serif text-[28px] leading-tight">Comparison result</h2>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                  <DocName name={documentA?.originalName} fallback="Document A" />
                  <span className="text-accent font-semibold">vs</span>
                  <DocName name={documentB?.originalName} fallback="Document B" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <TypeChip label={documentTypes.documentA?.label || documentA?.fileType || 'Document A'} tone={typeMatch ? 'neutral' : 'warn'} />
                  <TypeChip label={documentTypes.documentB?.label || documentB?.fileType || 'Document B'} tone={typeMatch ? 'neutral' : 'warn'} />
                  {!typeMatch && <TypeChip label="Document types differ" tone="danger" />}
                </div>
              </div>

              <div className="rounded-2xl border border-black/[0.08] bg-[#fbfaf7] p-4 min-w-[250px]">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-[12px] font-semibold text-muted">Similarity</p>
                  <span className={`badge ${scoreTone(score)} text-[16px] px-3 py-1.5`}>{score}%</span>
                </div>
                <div className="h-2 rounded-full bg-white border border-black/[0.06] overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${score}%` }} />
                </div>
                <p className="text-[12px] leading-5 text-muted mt-3">{interpretSimilarity(score, typeMatch)}</p>
              </div>
            </div>
          </header>

          {!typeMatch && documentTypes.warning ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800 flex gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <p>{documentTypes.warning}</p>
            </div>
          ) : null}

          <section className="rounded-3xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <SectionHeading
              icon={<Sparkles size={15} className="text-accent" />}
              title="Executive summary"
              subtitle="Concise enterprise-style overview of what changed and why it matters."
            />
            <p className="text-[14px] leading-7 text-ink">{executiveSummary}</p>
          </section>

          <section className="rounded-3xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <SectionHeading
              icon={<CheckCircle2 size={15} className="text-green-600" />}
              title="Key changes"
              subtitle="Only material changes are shown here."
            />
            {keyChanges.length ? (
              <div className="space-y-3">
                {keyChanges.map((change) => (
                  <ChangeCard key={`${change.category}-${change.label}-${change.summary}`} change={change} />
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted leading-6">No material differences were detected in the supported comparison categories.</p>
            )}
          </section>

          <section className="rounded-3xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <SectionHeading
              icon={<ArrowRight size={15} className="text-sky-600" />}
              title="Side-by-side highlighted diff"
              subtitle="Green means added, red means removed, yellow means modified."
            />
            {sideBySide.length ? (
              <div className="space-y-3">
                {sideBySide.map((change) => (
                  <SideBySideRow key={`${change.category}-${change.label}-${change.summary}`} change={change} />
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted leading-6">There were no highlighted differences to display.</p>
            )}
          </section>

          <section className="rounded-3xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <SectionHeading
              icon={<AlertTriangle size={15} className="text-red-600" />}
              title="Critical alerts"
              subtitle="Only high-priority issues are listed here."
            />
            {criticalAlerts.length ? (
              <div className="space-y-3">
                {criticalAlerts.map((alert) => (
                  <div key={`${alert.category}-${alert.summary}`} className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="badge bg-red-100 text-red-700">{formatAlertCategory(alert.category)}</span>
                      <span className="badge bg-red-100 text-red-700 uppercase text-[10px]">{alert.severity || 'high'} risk</span>
                    </div>
                    <p className="text-[13px] leading-6 text-red-800">{alert.summary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-800">
                No critical alerts were detected.
              </div>
            )}
          </section>
        </article>

        <aside className="lg:sticky lg:top-6 space-y-4">
          <section className="rounded-3xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <SectionHeading
              icon={<FileText size={15} className="text-muted" />}
              title="Summary panel"
              subtitle="Sticky snapshot for quick review."
            />
            <div className="space-y-4">
              <MetricRow label="Risk level" value={capitalize(riskLevel)} />
              <MetricRow label="Document type" value={typeMatch ? 'Matched' : 'Different'} />
              <MetricRow label="Key changes" value={String(keyChanges.length)} />
              <MetricRow label="Critical alerts" value={String(criticalAlerts.length)} />
              <div className="rounded-2xl bg-[#fbfaf7] border border-black/[0.06] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Executive summary</p>
                <p className="text-[13px] leading-6 text-ink mt-2">{truncate(executiveSummary, 220)}</p>
              </div>
              <div className={`rounded-2xl px-4 py-3 text-[13px] leading-6 ${
                riskLevel === 'high'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : riskLevel === 'medium'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-green-50 text-green-800 border border-green-200'
              }`}>
                {riskSummary}
              </div>
              <div className="rounded-2xl bg-surface2 border border-black/[0.06] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Recommendation</p>
                <p className="text-[13px] leading-6 text-ink mt-2">{recommendationText}</p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function SectionHeading({ icon, title, subtitle }) {
  return (
    <div className="mb-4">
      <h3 className="text-[13px] font-semibold text-ink flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <p className="text-[12px] text-muted mt-1 leading-5">{subtitle}</p>
    </div>
  );
}

function ChangeCard({ change }) {
  return (
    <div className={`rounded-2xl border p-4 ${
      change.status === 'added'
        ? 'border-green-200 bg-green-50'
        : change.status === 'removed'
          ? 'border-red-200 bg-red-50'
          : 'border-amber-200 bg-amber-50'
    }`}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`badge ${statusTone(change.status)}`}>{statusLabel(change.status)}</span>
        <span className="badge bg-surface2 text-muted">{formatAlertCategory(change.category)}</span>
        <span className="badge bg-surface2 text-muted uppercase text-[10px]">{change.severity || 'low'} risk</span>
      </div>
      <p className="text-[13px] leading-6 text-ink">{change.summary || 'A meaningful difference was detected.'}</p>
      {(change.left || change.right) && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <MiniDiff label="Before" value={change.left} tone="removed" />
          <MiniDiff label="After" value={change.right} tone="added" />
        </div>
      )}
    </div>
  );
}

function SideBySideRow({ change }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-2xl bg-surface2 border border-black/[0.06] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{formatAlertCategory(change.category)}</p>
        <p className="text-[13px] font-semibold text-ink mt-1">{change.label}</p>
        <span className={`badge mt-3 ${statusTone(change.status)}`}>{statusLabel(change.status)}</span>
      </div>
      <DiffPanel label="Document A" value={change.left} status={change.status} side="left" />
      <DiffPanel label="Document B" value={change.right} status={change.status} side="right" />
    </div>
  );
}

function DiffPanel({ label, value, status, side }) {
  const tone = status === 'added' && side === 'right'
    ? 'border-green-200 bg-green-50 text-green-800'
    : status === 'removed' && side === 'left'
      ? 'border-red-200 bg-red-50 text-red-800'
      : status === 'modified'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-black/[0.06] bg-[#fbfaf7] text-ink';

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-[13px] leading-6 mt-2">{value || 'No comparable text extracted.'}</p>
    </div>
  );
}

function MiniDiff({ label, value, tone }) {
  const cls = tone === 'added'
    ? 'border-green-200 bg-green-50 text-green-800'
    : tone === 'removed'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-amber-200 bg-amber-50 text-amber-800';

  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-[13px] leading-6 mt-1">{value || 'No comparable text extracted.'}</p>
    </div>
  );
}

function TypeChip({ label, tone = 'neutral' }) {
  const cls = {
    neutral: 'bg-surface2 text-muted',
    warn: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
  }[tone] || 'bg-surface2 text-muted';

  return <span className={`badge ${cls}`}>{label}</span>;
}

function DocName({ name, fallback }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <FileText size={13} className="text-muted shrink-0" />
      <span className="truncate max-w-[260px]">{name || fallback}</span>
    </span>
  );
}

function normalizeChangeList(items) {
  return Array.isArray(items)
    ? items
        .filter(Boolean)
        .map((item) => ({
          category: String(item.category || ''),
          label: String(item.label || ''),
          status: String(item.status || 'modified'),
          severity: String(item.severity || 'low'),
          summary: String(item.summary || ''),
          left: String(item.left || ''),
          right: String(item.right || ''),
        }))
        .filter((item) => item.summary || item.left || item.right)
    : [];
}

function normalizeAlertList(items) {
  return Array.isArray(items)
    ? items
        .filter(Boolean)
        .map((item) => ({
          category: String(item.category || ''),
          severity: String(item.severity || 'high'),
          summary: String(item.summary || ''),
        }))
        .filter((item) => item.summary)
    : [];
}

function clampScore(value) {
  const score = Number(value || 0);
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreTone(score) {
  if (score >= 75) return 'bg-green-50 text-green-700';
  if (score >= 45) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

function interpretSimilarity(score, typeMatch) {
  if (!typeMatch) return 'Different document types are being compared, so this score emphasizes material change rather than simple overlap.';
  if (score >= 75) return 'These documents are closely aligned with only limited business changes.';
  if (score >= 45) return 'These documents share some structure, but there are meaningful changes to review.';
  return 'These documents are materially different and should be reviewed independently.';
}

function recommendation(score, riskLevel, typeMatch, keyChanges) {
  if (!typeMatch) {
    return 'Treat this as a cross-type review. Verify the business purpose before merging conclusions.';
  }

  if (riskLevel === 'high') {
    return 'Escalate the changed clauses, timing, or financial terms before approving the updated version.';
  }

  if (score >= 75 && keyChanges.length === 0) {
    return 'The documents are highly aligned. Confirm the summary, then move on to the tracked change list.';
  }

  if (score >= 45) {
    return 'Review the highlighted differences in order of risk, starting with payments, deadlines, and responsibilities.';
  }

  return 'Prioritize side-by-side review because the documents diverge in purpose or business terms.';
}

function inferRiskLevel(criticalAlerts) {
  if (criticalAlerts.length) return 'high';
  return 'low';
}

function inferRiskSummary(riskLevel, typeMatch) {
  if (!typeMatch) return 'Medium risk because the documents serve different purposes.';
  if (riskLevel === 'high') return 'High risk because one or more material terms changed.';
  return 'Low risk. No critical alerts were detected.';
}

function formatAlertCategory(category) {
  const map = {
    documentType: 'Document type',
    payments: 'Payment',
    dates: 'Dates',
    clauses: 'Clauses',
    responsibilities: 'Responsibilities',
    financialValues: 'Financial values',
    skills: 'Skills',
    policies: 'Policies',
  };

  return map[category] || (category ? capitalize(category) : 'Change');
}

function statusTone(status) {
  if (status === 'added') return 'bg-green-50 text-green-700';
  if (status === 'removed') return 'bg-red-50 text-red-700';
  return 'bg-amber-50 text-amber-700';
}

function statusLabel(status) {
  if (status === 'added') return 'Added';
  if (status === 'removed') return 'Removed';
  return 'Modified';
}

function capitalize(value) {
  const str = String(value || '').trim();
  if (!str) return '-';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
