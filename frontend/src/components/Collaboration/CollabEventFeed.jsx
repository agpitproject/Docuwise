import React from 'react';
import {
  UserPlus,
  UserMinus,
  Shield,
  MessageSquare,
  CheckCircle2,
  Smile,
} from 'lucide-react';
import { formatDate, truncate } from '../../utils/formatters';

const EVENT_META = {
  collaborator_added: {
    icon: UserPlus,
    tone: 'text-green-700 bg-green-50',
    label: (event) => `added collaborator ${event.targetEmail || ''}`.trim(),
  },
  collaborator_removed: {
    icon: UserMinus,
    tone: 'text-red-700 bg-red-50',
    label: (event) => `removed collaborator ${event.targetEmail || ''}`.trim(),
  },
  role_changed: {
    icon: Shield,
    tone: 'text-amber-700 bg-amber-50',
    label: (event) => `changed role for ${event.targetEmail || 'collaborator'} to ${event.targetRole || 'updated role'}`,
  },
  comment_added: {
    icon: MessageSquare,
    tone: 'text-blue-700 bg-blue-50',
    label: () => 'added a comment',
  },
  comment_resolved: {
    icon: CheckCircle2,
    tone: 'text-green-700 bg-green-50',
    label: () => 'resolved a comment',
  },
  reaction_added: {
    icon: Smile,
    tone: 'text-purple-700 bg-purple-50',
    label: (event) => `reacted to a comment${event?.metadata?.emoji ? ` (${event.metadata.emoji})` : ''}`,
  },
};

export default function CollabEventFeed({ events, loading }) {
  if (loading) {
    return (
      <div className="card p-4">
        <div className="space-y-2">
          <div className="h-4 w-2/3 bg-slate-200 animate-pulse rounded" />
          <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded" />
          <div className="h-4 w-3/4 bg-slate-200 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!events?.length) {
    return (
      <div className="card p-4 text-[13px] text-muted">
        No events yet
      </div>
    );
  }

  return (
    <div className="card p-4 max-h-[340px] overflow-y-auto">
      <div className="space-y-2">
        {events.map((event) => {
          const meta = EVENT_META[event.action] || {
            icon: MessageSquare,
            tone: 'text-slate-700 bg-slate-100',
            label: () => event.action || 'updated collaboration',
          };
          const Icon = meta.icon;
          return (
            <div key={event._id} className="rounded-xl border border-black/[0.06] bg-[#fbfaf7] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full inline-flex items-center justify-center ${meta.tone}`}>
                  <Icon size={13} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] text-ink">
                    <span className="font-medium">{event.actorName || truncate(`${event.actor?.firstName || ''} ${event.actor?.lastName || ''}`.trim(), 24) || 'Someone'}</span>
                    {' '}
                    {meta.label(event)}
                  </p>
                  <p className="text-[11px] text-muted">{formatDate(event.createdAt)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
