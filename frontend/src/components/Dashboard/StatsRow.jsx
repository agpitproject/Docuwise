import React from 'react';

export default function StatsRow({ analyses, documents, user }) {
  const totalDocs     = documents?.length || 0;
  const totalAnalyses = analyses?.length  || 0;
  const freeLeft      = Math.max((user?.plan === 'free' ? 5 : Infinity) - (user?.monthlyUsage || 0), 0);
  const avgTime       = analyses?.length
    ? (analyses.reduce((s, a) => s + (a.processingTimeMs || 0), 0) / analyses.length / 1000).toFixed(1)
    : '-';

  const stats = [
    { num: totalDocs,     label: 'Documents uploaded',    delta: null },
    { num: totalAnalyses, label: 'Analyses completed',    delta: null },
    { num: freeLeft === Infinity ? 'Unlimited' : freeLeft, label: 'Analyses remaining', delta: null },
    { num: avgTime === '-' ? '-' : `${avgTime}s`, label: 'Avg. processing time', delta: null },
  ];

  return (
    <div className="grid grid-cols-4 gap-3.5 mb-6">
      {stats.map((s, i) => (
        <div key={i} className="card p-5">
          <div className="text-[30px] font-light leading-none mb-1">{s.num}</div>
          <div className="text-[12px] text-muted font-medium">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
