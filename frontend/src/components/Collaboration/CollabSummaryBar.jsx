import React from 'react';
import { Lightbulb } from 'lucide-react';

export default function CollabSummaryBar({ summary }) {
  if (!summary) {
    return (
      <div className="card p-4 mb-4">
        <div className="space-y-2">
          <div className="h-4 w-2/3 bg-slate-200 animate-pulse rounded" />
          <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded" />
          <div className="h-4 w-3/4 bg-slate-200 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  const insights = Array.isArray(summary.aiInsights) ? summary.aiInsights.slice(0, 3) : [];

  return (
    <div className="mb-4">
      <div className="grid grid-cols-4 gap-3 mb-3">
        <StatChip label="Total comments" value={summary.totalComments || 0} />
        <StatChip label="Unresolved" value={summary.unresolvedComments || 0} />
        <StatChip label="Collaborators" value={summary.collaboratorCount || 0} />
        <StatChip label="Events" value={summary.totalEvents || 0} />
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-center gap-2 mb-2 text-blue-800">
          <Lightbulb size={14} />
          <p className="text-[12px] font-semibold">AI collaboration insights</p>
        </div>
        {insights.length > 0 ? (
          <ul className="list-disc pl-5 text-[12px] text-blue-900 space-y-1">
            {insights.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
          </ul>
        ) : (
          <p className="text-[12px] text-blue-900">No insights available yet.</p>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <div className="card px-3 py-2">
      <p className="text-[16px] font-semibold text-ink">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
