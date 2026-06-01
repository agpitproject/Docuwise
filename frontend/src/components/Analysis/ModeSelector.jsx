import React, { useState } from 'react';
import { Grid2x2, AlignLeft, Smile, Sparkles } from 'lucide-react';

const MODES = [
  {
    id: 'categorization',
    label: 'Categorization',
    desc: 'Auto-tag and classify document by topic, type, and domain',
    icon: <Grid2x2 size={22} />,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
  },
  {
    id: 'summarization',
    label: 'Summarization',
    desc: 'Get a concise, accurate summary of the document\'s key points',
    icon: <AlignLeft size={22} />,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    id: 'sentiment',
    label: 'Sentiment analysis',
    desc: 'Detect tone, emotion, and positive / negative / neutral signals',
    icon: <Smile size={22} />,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
  },
  {
    id: 'all',
    label: 'Full analysis',
    desc: 'Run all modes together plus entity extraction, keywords, and readability',
    icon: <Sparkles size={22} />,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
];

export default function ModeSelector({ selected, onChange }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted text-center mb-4">
        Choose analysis mode
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" role="radiogroup" aria-label="Analysis mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            role="radio"
            aria-checked={selected === m.id}
            className={`relative text-left p-5 rounded-xl border-[1.5px] transition-all duration-150
              ${selected === m.id
                ? 'border-accent bg-accent-light shadow-[0_0_0_3px_rgba(37,99,235,.10)]'
                : 'border-black/10 bg-white hover:border-black/20 hover:shadow-sm'}`}
          >
            {/* Checkmark */}
            {selected === m.id && (
              <span className="absolute top-3 right-3 w-4 h-4 bg-accent rounded-full flex items-center justify-center">
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5l2.5 3L8.5 1.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
            <div className={`w-10 h-10 rounded-lg ${m.iconBg} ${m.iconColor} flex items-center justify-center mb-3`}>
              {m.icon}
            </div>
            <h4 className={`text-[13px] font-600 mb-1 ${selected === m.id ? 'text-accent' : 'text-ink'}`}>
              {m.label}
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">{m.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
