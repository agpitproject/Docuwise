import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, GitCompareArrows, Loader2 } from 'lucide-react';
import { fileTypeColor, formatDate, formatFileSize } from '../../utils/formatters';

const modes = [
  { id: 'full', label: 'Full', desc: 'Similarity, summary, sentiment, keywords, and structure' },
  { id: 'summary', label: 'Summary only', desc: 'Focus on the narrative and key differences' },
  { id: 'sentiment', label: 'Sentiment only', desc: 'Compare tone and positive/negative signals' },
  { id: 'structure', label: 'Structure only', desc: 'Compare length, categories, and readability' },
];

export default function ComparisonSetup({ documents, onCompare, comparing }) {
  const [documentAId, setDocumentAId] = useState('');
  const [documentBId, setDocumentBId] = useState('');
  const [mode, setMode] = useState('full');
  const documentA = useMemo(() => documents.find((doc) => doc._id === documentAId), [documents, documentAId]);
  const documentB = useMemo(() => documents.find((doc) => doc._id === documentBId), [documents, documentBId]);
  const sameDocument = Boolean(documentAId && documentBId && documentAId === documentBId);
  const hasEnoughDocuments = documents.length >= 2;

  const canCompare = useMemo(
    () => Boolean(hasEnoughDocuments && documentAId && documentBId && !sameDocument && !comparing),
    [hasEnoughDocuments, documentAId, documentBId, sameDocument, comparing]
  );

  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)] mb-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-5">
        <div>
          <p className="section-eyebrow mb-2">Comparison setup</p>
          <h2 className="font-serif text-[28px] leading-tight">Compare two documents</h2>
          <p className="text-[13px] text-muted mt-2 max-w-2xl">
            Select two readable documents and compare their document type, key business terms, and critical changes.
          </p>
        </div>
        <span className="badge bg-surface2 text-muted">{documents.length} available</span>
      </div>

      {!hasEnoughDocuments ? (
        <div className="rounded-xl border border-dashed border-black/15 bg-[#fbfaf7] px-5 py-8 text-center">
          <FileText size={24} className="mx-auto text-muted mb-3" />
          <p className="text-[15px] font-semibold text-ink">Upload at least two documents</p>
          <p className="text-[13px] text-muted mt-1">Comparison needs two source documents with extracted text.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2 mb-5">
            <DocumentPickCard
              label="Document A"
              value={documentAId}
              documents={documents}
              selectedDoc={documentA}
              onChange={setDocumentAId}
              blockedId={documentBId}
            />
            <DocumentPickCard
              label="Document B"
              value={documentBId}
              documents={documents}
              selectedDoc={documentB}
              onChange={setDocumentBId}
              blockedId={documentAId}
            />
          </div>

          {sameDocument && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 mb-4 flex gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              Choose two different documents before running a comparison.
            </div>
          )}

          <div className="mb-5">
            <p className="text-[12px] font-semibold text-ink mb-2">Comparison mode</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {modes.map((option) => (
          <button
            key={option.id}
            type="button"
                  className={`rounded-xl border p-4 text-left transition-all ${
                    mode === option.id
                      ? 'border-accent bg-accent-light text-accent shadow-[0_0_0_3px_rgba(37,99,235,.10)]'
                      : 'border-black/10 bg-white text-ink hover:border-black/20'
                  }`}
            onClick={() => setMode(option.id)}
          >
                  <span className="text-[13px] font-semibold">{option.label}</span>
                  <span className="block text-[11px] leading-5 text-muted mt-1">{option.desc}</span>
          </button>
        ))}
            </div>
      </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-xl border border-black/[0.08] bg-[#fbfaf7] p-4">
            <div>
              <p className="text-[13px] font-semibold text-ink">Ready to compare</p>
              <p className="text-[12px] text-muted mt-0.5">
                {canCompare ? 'Both documents are selected and ready.' : 'Select two different documents to continue.'}
              </p>
            </div>
            <button
              type="button"
              className="btn-primary justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canCompare}
              onClick={() => onCompare(documentAId, documentBId, mode)}
            >
              {comparing ? <Loader2 size={14} className="animate-spin" /> : <GitCompareArrows size={14} />}
              Compare documents
            </button>
          </div>
        </>
      )}

      {comparing && (
        <div className="mt-4 rounded-xl bg-accent-light border border-accent/15 px-4 py-3 text-[13px] text-accent">
          <div className="flex items-center gap-2 font-semibold">
            <Loader2 size={14} className="animate-spin" />
            Comparing documents...
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white overflow-hidden border border-accent/10">
            <div className="h-full w-1/2 rounded-full bg-accent progress-pulse" />
          </div>
          <p className="text-[12px] text-muted mt-2">This usually takes a few seconds while the documents are analysed together.</p>
        </div>
      )}
    </section>
  );
}

function DocumentPickCard({ label, value, documents, selectedDoc, onChange, blockedId }) {
  const color = fileTypeColor(selectedDoc?.fileType);

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-[#fbfaf7] p-4">
      <label className="block">
        <span className="text-[12px] font-semibold text-ink block mb-2">{label}</span>
        <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose document</option>
          {documents.map((doc) => (
            <option key={doc._id} value={doc._id} disabled={doc._id === blockedId}>
              {doc.originalName}
            </option>
          ))}
        </select>
      </label>

      {selectedDoc ? (
        <div className="mt-4 rounded-xl border border-black/[0.07] bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color.bg }}>
              <FileText size={18} style={{ color: color.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink truncate" title={selectedDoc.originalName}>{selectedDoc.originalName}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="badge bg-surface2 text-muted uppercase text-[10px]">{selectedDoc.fileType}</span>
                <span className="badge bg-surface2 text-muted text-[10px]">{selectedDoc.wordCount ? `${Number(selectedDoc.wordCount).toLocaleString()} words` : 'Words unavailable'}</span>
              </div>
              <p className="text-[11px] text-muted mt-2">
                {formatFileSize(selectedDoc.fileSize)} - Uploaded {formatDate(selectedDoc.createdAt)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-green-700">
            <CheckCircle2 size={13} />
            Ready for comparison
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-black/10 bg-white px-4 py-8 text-center text-[13px] text-muted">
          Select {label.toLowerCase()} to preview its details.
        </div>
      )}
    </div>
  );
}
