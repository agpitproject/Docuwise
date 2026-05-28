import React from 'react';

const BARS = [
  { key: 'positive', label: 'Positive', color: 'bg-green-500',  text: 'text-green-600'  },
  { key: 'neutral',  label: 'Neutral',  color: 'bg-gray-400',   text: 'text-gray-500'   },
  { key: 'negative', label: 'Negative', color: 'bg-red-500',    text: 'text-red-600'    },
];

export default function SentimentBars({ sentiment }) {
  if (!sentiment) return null;
  return (
    <div className="space-y-2.5">
      {BARS.map(({ key, label, color, text }) => (
        <div key={key} className="flex items-center gap-3">
          <span className={`text-[12px] font-medium w-16 shrink-0 ${text}`}>{label}</span>
          <div className="flex-1 h-2 bg-surface3 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${color} transition-all duration-700`}
              style={{ width: `${Math.round(sentiment[key] || 0)}%` }}
            />
          </div>
          <span className={`text-[12px] font-semibold w-8 text-right ${text}`}>
            {Math.round(sentiment[key] || 0)}%
          </span>
        </div>
      ))}
    </div>
  );
}
