import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4" role="presentation">
      <div className="bg-white rounded-2xl p-6 shadow-2xl relative max-w-full border border-white/40" role="dialog" aria-modal="true">
        <button 
          type="button"
          onClick={onClose} 
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface2 text-gray-500 hover:text-ink hover:bg-surface3 transition-colors inline-flex items-center justify-center"
          aria-label="Close modal"
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
};

export default Modal;
