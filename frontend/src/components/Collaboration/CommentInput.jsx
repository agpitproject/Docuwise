import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function CommentInput({ onSubmit, submitting, placeholder = 'Write a comment...' }) {
  const [content, setContent] = useState('');
  const textareaRef = useRef(null);
  const count = content.length;
  const disabled = submitting || !content.trim() || count > 2000;

  const submit = async () => {
    if (disabled) return;
    const result = await onSubmit(content.trim());
    if (result?.success === false) return;
    setContent('');
    if (textareaRef.current) textareaRef.current.focus();
  };

  return (
    <div className="card p-4">
      <textarea
        ref={textareaRef}
        className="input min-h-[80px] max-h-[200px] resize-y"
        placeholder={placeholder}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="mt-3 flex items-center justify-between">
        <span className={`text-[11px] ${count > 2000 ? 'text-red-600' : 'text-muted'}`}>{count}/2000</span>
        <button type="button" className="btn-accent" disabled={disabled} onClick={submit}>
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
