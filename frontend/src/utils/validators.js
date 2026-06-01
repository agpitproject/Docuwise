const ALLOWED_EXTS = new Set(['.txt', '.pdf', '.docx']);
const MAX_MB = 50;

export const validateFile = (file) => {
  if (!file) return 'Please select a file';

  const fileName = String(file.name || '').trim();
  const ext = getExtension(fileName);

  if (!fileName || !ext || !ALLOWED_EXTS.has(ext)) {
    return 'Unsupported file type. Please upload a TXT, PDF, or DOCX file.';
  }

  if (file.size > MAX_MB * 1024 * 1024) {
    return 'File is too large. Please upload a smaller document.';
  }

  return null; // valid
};

export const validateEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : 'Enter a valid email';

export const validatePassword = (pw) =>
  pw && pw.length >= 6 ? null : 'Password must be at least 6 characters';

function getExtension(filename) {
  const match = String(filename || '').toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : '';
}
