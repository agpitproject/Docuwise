export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const truncate = (str, n = 40) =>
  str && str.length > n ? str.slice(0, n) + '…' : str;

export const fileTypeColor = (type) => ({
  pdf:  { bg: '#FEF2F2', color: '#DC2626' },
  docx: { bg: '#EFF4FF', color: '#2563EB' },
  txt:  { bg: '#F0FDFA', color: '#0D9488' },
}[type] || { bg: '#F0EFE9', color: '#7A7870' });

export const modeLabel = (mode) => ({
  categorization: 'Categorization',
  summarization:  'Summarization',
  sentiment:      'Sentiment',
  keywords:       'Keywords',
  all:            'Full Analysis',
}[mode] || mode);

export const modeBadgeClass = (mode) => ({
  summarization:  'bg-amber-50 text-amber-700',
  sentiment:      'bg-red-50 text-red-700',
  categorization: 'bg-teal-50 text-teal-700',
  keywords:       'bg-blue-50 text-blue-700',
  all:            'bg-purple-50 text-purple-700',
}[mode] || 'bg-gray-100 text-gray-600');
