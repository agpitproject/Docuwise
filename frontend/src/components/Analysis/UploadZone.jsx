import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertCircle, FileText, Upload } from 'lucide-react';
import { useDocumentStore } from '../../store/documentStore';
import { validateFile } from '../../utils/validators';
import toast from 'react-hot-toast';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export default function UploadZone({ onUploaded }) {
  const { uploadDocument, uploading, uploadProgress } = useDocumentStore();
  const [uploadError, setUploadError] = useState('');

  const showUploadError = useCallback((message) => {
    setUploadError(message);
    toast.error(message);
  }, []);

  const onDrop = useCallback(async (accepted, fileRejections = []) => {
    if (fileRejections.length > 0) {
      showUploadError(getDropzoneErrorMessage(fileRejections));
      return;
    }

    const file = accepted[0];
    if (!file) return;

    const err = validateFile(file);
    if (err) {
      showUploadError(err);
      return;
    }

    setUploadError('');
    const result = await uploadDocument(file);
    if (result.success) {
      toast.success(`${file.name} uploaded!`);
      onUploaded?.(result.document);
    } else {
      showUploadError(result.message);
    }
  }, [uploadDocument, onUploaded, showUploadError]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/octet-stream': ['.txt', '.pdf', '.docx'],
    },
    multiple: false,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE_BYTES,
    disabled: uploading,
    noClick: true,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer
                  transition-all duration-200 select-none
                  ${isDragActive ? 'border-accent bg-accent-light' : 'border-black/15 bg-[#fbfaf7] hover:border-accent/60 hover:bg-accent-light/30'}
                  ${uploading ? 'pointer-events-none opacity-70' : ''}`}
      aria-busy={uploading}
    >
      <input {...getInputProps({ 'aria-label': 'Upload document' })} />

      <div className="w-14 h-14 rounded-xl bg-surface2 border border-black/[0.09] flex items-center
                      justify-center mx-auto mb-4">
        {uploading
          ? <FileText size={24} className="text-muted animate-pulse" />
          : <Upload size={24} className="text-muted" />}
      </div>

      <h3 className="text-base font-semibold mb-1.5">
        {uploading ? 'Uploading document' : isDragActive ? 'Drop it here' : 'Drag and drop your document'}
      </h3>
      <p className="text-[13px] text-muted mb-5">
        {uploading ? `Uploading... ${uploadProgress}%` : 'or click to browse. TXT, PDF, or DOCX up to 50MB.'}
      </p>

      {uploadError && (
        <div role="alert" className="max-w-md mx-auto mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-[13px] leading-5 text-red-700">
          <div className="flex gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-800">Upload needs attention</p>
              <p>{uploadError}</p>
              {uploadError.toLowerCase().includes('readable text') || uploadError.toLowerCase().includes('extract') ? (
                <p className="mt-1">Try a document with selectable text. Scanned PDFs need OCR before upload.</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-center mb-6">
        {[
          { label: '.txt', cls: 'bg-teal-50 text-teal-700' },
          { label: '.pdf', cls: 'bg-red-50 text-red-700' },
          { label: '.docx', cls: 'bg-blue-50 text-blue-700' },
        ].map(({ label, cls }) => (
          <span key={label} className={`badge ${cls} text-[11px]`}>{label}</span>
        ))}
      </div>

      {!uploading && (
        <button type="button"
          className="btn-primary px-6 py-2.5 text-[13px]"
          aria-label="Choose document file"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}>
          Choose file
        </button>
      )}

      {/* Progress bar */}
      {uploading && (
        <div className="mt-4 max-w-xs mx-auto" aria-label={`Upload progress ${uploadProgress}%`}>
          <div className="h-1.5 bg-white rounded-full overflow-hidden border border-black/[0.06]">
          <div className="h-full bg-accent rounded-full transition-all duration-300 progress-pulse"
               style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-muted">Keep this page open while the file uploads.</p>
        </div>
      )}
    </div>
  );
}

function getDropzoneErrorMessage(fileRejections) {
  const codes = fileRejections.flatMap((rejection) =>
    (rejection.errors || []).map((error) => error.code)
  );

  if (codes.includes('too-many-files')) {
    return 'Please upload one document at a time.';
  }

  if (codes.includes('file-too-large')) {
    return 'File is too large. Please upload a smaller document.';
  }

  if (codes.includes('file-invalid-type')) {
    return 'Unsupported file type. Please upload a TXT, PDF, or DOCX file.';
  }

  if (codes.includes('file-too-small')) {
    return 'Upload failed. Please choose a valid TXT, PDF, or DOCX file.';
  }

  return 'Upload failed. Please choose a valid TXT, PDF, or DOCX file.';
}
