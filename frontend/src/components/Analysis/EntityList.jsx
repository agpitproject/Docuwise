import React from 'react';

const TYPE_COLORS = {
  person: 'text-blue-600',
  organization: 'text-teal-600',
  org: 'text-teal-600',
  location: 'text-amber-600',
  region: 'text-cyan-600',
  date: 'text-orange-500',
  metric: 'text-green-600',
  topic: 'text-purple-600',
};

export default function EntityList({ entities }) {
  if (!entities?.length) return <p className="text-[13px] text-muted">No entities found.</p>;

  return (
    <div className="space-y-2">
      {entities.map((ent, i) => {
        const rawType = ent.type || 'entity';
        const typeKey = String(rawType).toLowerCase();
        return (
          <div
            key={`${ent.value}-${i}`}
            className="flex items-center gap-3 bg-white border border-black/[0.08] rounded-xl px-3.5 py-2.5"
          >
            <span
              className={`text-[10px] font-bold uppercase tracking-wide w-20 shrink-0 ${
                TYPE_COLORS[typeKey] || 'text-muted'
              }`}
            >
              {humanizeType(rawType)}
            </span>
            <span className="text-[13px] font-medium text-ink">{ent.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function humanizeType(value) {
  return String(value).replace(/_/g, ' ');
}
