import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useActivityStore } from '../../store/activityStore';
import { formatDate, modeLabel, truncate } from '../../utils/formatters';

export default function ActivityBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = useActivityStore((state) => state.items);
  const loading = useActivityStore((state) => state.loading);
  const sseConnected = useActivityStore((state) => state.sseConnected);
  const fetchActivity = useActivityStore((state) => state.fetchActivity);
  const connectSSE = useActivityStore((state) => state.connectSSE);
  const disconnectSSE = useActivityStore((state) => state.disconnectSSE);

  useEffect(() => {
    fetchActivity(1);
    connectSSE();
    return () => {
      disconnectSSE();
    };
  }, [connectSSE, disconnectSSE, fetchActivity]);

  const liveCount = useMemo(
    () => items.filter((item) => item.status === 'processing' || item.status === 'pending').length,
    [items]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative w-9 h-9 rounded-full border border-black/10 bg-white text-muted hover:text-ink hover:bg-surface2 transition-all"
      >
        <Bell size={16} className="mx-auto" />
        <span className={`absolute top-1.5 left-1.5 text-[10px] leading-none ${sseConnected ? 'text-green-500' : 'text-slate-400'}`}>
          ●
        </span>
        {liveCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-accent text-white text-[10px] font-semibold flex items-center justify-center px-1">
            {liveCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-[340px] rounded-2xl border border-black/10 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)] p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[13px] font-semibold text-ink">Live notifications</p>
              <p className="text-[11px] text-muted">Current jobs and recent history</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] ${sseConnected ? 'text-green-600' : 'text-muted'}`}>
                ●
              </span>
              {loading && <Loader2 size={14} className="animate-spin text-muted" />}
            </div>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {!items.length && !loading && (
              <div className="rounded-xl bg-surface2 px-4 py-3 text-[12px] text-muted">
                No activity yet. Start an analysis to see live updates here.
              </div>
            )}

            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-black/[0.06] bg-[#fbfaf7] px-4 py-3">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-[12px] font-semibold text-ink">{truncate(item.documentName, 28)}</p>
                  <span className={`badge text-[10px] ${statusTone(item.status)}`}>{item.status}</span>
                </div>
                <p className="text-[11px] text-muted mb-1">{modeLabel(item.mode)}</p>
                <p className="text-[12px] text-ink leading-5">{item.message}</p>
                <p className="text-[10px] text-muted mt-2">{formatDate(item.updatedAt || item.createdAt)}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="mt-3 text-[12px] font-medium text-accent hover:underline"
            onClick={() => {
              setOpen(false);
              navigate('/dashboard?view=activity');
            }}
          >
            View all activity
          </button>
        </div>
      )}
    </div>
  );
}

function statusTone(status) {
  if (status === 'completed') return 'bg-green-50 text-green-700';
  if (status === 'failed') return 'bg-red-50 text-red-700';
  return 'bg-amber-50 text-amber-700';
}
