import React, { useState } from 'react';
import { AlertTriangle, BarChart3, Eye, FileText, Trash2 } from 'lucide-react';
import { formatDate, modeLabel, truncate } from '../../utils/formatters';

export default function ComparisonHistory({ comparisons, onSelect, onDelete }) {
  const [confirmId, setConfirmId] = useState('');

  if (!comparisons.length) {
    return (
      <section className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center">
        <BarChart3 size={24} className="mx-auto text-muted mb-3" />
        <p className="text-[15px] font-semibold text-ink">No comparison history yet</p>
        <p className="text-[13px] text-muted mt-1">Run a comparison to keep recent document pairs here.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Recent comparisons</h2>
          <p className="text-[12px] text-muted mt-0.5">Review or remove previous comparison results.</p>
        </div>
        <span className="badge bg-surface2 text-muted">{comparisons.length} saved</span>
      </div>

      <div className="space-y-3">
        {comparisons.map((comparison) => {
          const score = clampScore(comparison?.results?.similarityScore);
          const status = comparison.status || 'completed';
          return (
            <article key={comparison._id} className="rounded-xl border border-black/[0.06] bg-[#fbfaf7] px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`badge ${statusTone(status)}`}>{statusLabel(status)}</span>
                    <span className="badge bg-surface2 text-muted">{modeLabel(comparison.mode)}</span>
                    <span className="text-[11px] text-muted">{formatDate(comparison.createdAt)}</span>
                  </div>
                  <p className="text-[13px] font-semibold text-ink truncate">
                    <DocLabel name={comparison.documentA?.originalName} fallback="Deleted document A" />
                    <span className="text-accent mx-1.5">vs</span>
                    <DocLabel name={comparison.documentB?.originalName} fallback="Deleted document B" />
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {status === 'completed' && <span className={`badge ${scoreTone(score)}`}>{score}% semantic match</span>}
                  <button type="button" className="btn-outline text-[12px] px-3 py-1.5" onClick={() => onSelect(comparison._id)}>
                    <Eye size={12} />
                    View result
                  </button>
                  <button type="button" className="btn-ghost text-[12px] px-3 py-1.5 hover:bg-red-50 hover:text-red-600" onClick={() => setConfirmId(comparison._id)}>
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>

              {confirmId === comparison._id && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex gap-2 text-[13px] text-red-700">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                      <span>Delete this comparison result? The source documents are not deleted.</span>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="btn-outline text-[12px] px-3 py-1.5" onClick={() => setConfirmId('')}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-accent bg-red-600 hover:bg-red-700 text-[12px] px-3 py-1.5"
                        onClick={async () => {
                          await onDelete(comparison._id);
                          setConfirmId('');
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DocLabel({ name, fallback }) {
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <FileText size={12} className="text-muted shrink-0" />
      <span>{truncate(name || fallback, 30)}</span>
    </span>
  );
}

function clampScore(value) {
  const score = Number(value || 0);
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreTone(score) {
  if (score > 70) return 'bg-green-50 text-green-700';
  if (score >= 40) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

function statusTone(status) {
  if (status === 'completed') return 'bg-green-50 text-green-700';
  if (status === 'failed') return 'bg-red-50 text-red-700';
  return 'bg-amber-50 text-amber-700';
}

function statusLabel(status) {
  if (status === 'completed') return 'Completed';
  if (status === 'failed') return 'Failed';
  if (status === 'processing') return 'Processing';
  return 'Pending';
}
