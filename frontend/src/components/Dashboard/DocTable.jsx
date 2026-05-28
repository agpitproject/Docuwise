import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Eye } from 'lucide-react';
import { useDocumentStore } from '../../store/documentStore';
import { formatDate, formatFileSize, fileTypeColor, modeBadgeClass, modeLabel } from '../../utils/formatters';
import toast from 'react-hot-toast';

const FILTERS = ['All', 'PDF', 'DOCX', 'TXT'];

export default function DocTable({ analyses }) {
  const [filter, setFilter]   = useState('All');
  const { deleteDocument }    = useDocumentStore();
  const navigate = useNavigate();

  const filtered = !analyses ? [] : analyses.filter((a) => {
    if (!a.document) return false;
    if (filter === 'All') return true;
    return a.document?.fileType?.toUpperCase() === filter;
  });

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    const res = await deleteDocument(docId);
    if (res.success) toast.success('Document deleted');
    else toast.error(res.message);
  };

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.09]">
        <h3 className="text-[14px] font-semibold">Recent analyses</h3>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-full border transition-all
                ${filter === f
                  ? 'bg-ink text-bg border-ink'
                  : 'border-black/15 text-muted hover:border-black/30 bg-transparent'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface2">
              {['Document', 'Type', 'Mode', 'Date', 'Actions'].map((h) => (
                <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wider
                                       text-muted px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-[13px] text-muted py-10">
                  No documents yet - start by uploading one!
                </td>
              </tr>
            ) : filtered.map((a) => {
              const doc   = a.document;
              const color = fileTypeColor(doc?.fileType);
              return (
                <tr key={a._id} className="border-b border-black/[0.06] hover:bg-surface2 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                           style={{ background: color.bg }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                             stroke={color.color} strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium max-w-[180px] truncate">
                        {doc?.originalName || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="badge bg-surface2 text-muted uppercase text-[10px] tracking-wide">
                      {doc?.fileType?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${modeBadgeClass(a.mode)}`}>
                      {modeLabel(a.mode)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-muted">
                    {formatDate(a.createdAt)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/analyse/${a._id}`)}
                        className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5
                                   border border-black/15 rounded-lg hover:bg-surface2 transition-all bg-transparent text-ink cursor-pointer">
                        <Eye size={12}/> View
                      </button>
                      {doc?._id && (
                        <button onClick={() => handleDelete(doc._id)}
                          className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5
                                     border border-black/15 rounded-lg hover:bg-red-50 hover:text-red-600
                                     hover:border-red-200 transition-all bg-transparent text-muted cursor-pointer">
                          <Trash2 size={12}/>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
