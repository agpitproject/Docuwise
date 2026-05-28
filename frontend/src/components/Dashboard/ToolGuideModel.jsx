import Modal from '../UI/Modal';

const toolContent = {
  'compare-docs': {
    title: 'Compare Docs',
    when: 'Use this when you need to review differences between two versions, vendors, or contracts.',
    how: 'Upload or select two files, then compare summaries, keywords, and sentiment side by side.',
    steps: [
      'Click "Compare Docs" in the sidebar',
      'Upload your first document (PDF, DOCX, or TXT)',
      'Upload your second document',
      'Choose your comparison mode',
      'View the side-by-side results'
    ]
  },
  'batch-upload': {
    title: 'Batch Upload',
    when: 'Use this for repeated work across many files with the same analysis mode.',
    how: 'Open the batch workspace, drop multiple files, and process them together before reviewing the combined report.',
    steps: [
      'Click "Batch Upload" in the sidebar',
      'Drag and drop multiple files at once',
      'Choose the primary batch insight focus',
      'Start the batch job and monitor progress in the file list',
    ]
  },
  'collaboration': {
    title: 'Collaboration',
    when: 'Use this when up to three partners need to review the same document results.',
    how: 'Choose a document, add partner names and emails, then save the collaboration list.',
    steps: [
      'Click "Collaboration" in the sidebar',
      'Select a document from your library',
      'Add up to 3 collaborator emails',
      'Save - they will receive an invite link',
    ]
  },
  'live-activity': {
    title: 'Live Activity',
    when: 'Use this to monitor running jobs and quickly revisit completed ones.',
    how: 'Open the activity panel or navbar bell to watch in-progress and recent analyses.',
    steps: [
      'Click "Live Activity" in the sidebar',
      'See all running and completed jobs',
      'Click any job to view its full results',
    ]
  }
};

export default function ToolGuideModal({ toolKey, onClose }) {
  const tool = toolContent[toolKey];
  if (!tool) return null;

  return (
    <Modal onClose={onClose}>
      <div className="p-6 max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{tool.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wide mb-1">When to use</p>
          <p className="text-gray-700">{tool.when}</p>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wide mb-1">How it works</p>
          <p className="text-gray-700">{tool.how}</p>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wide mb-2">Steps</p>
          <ol className="space-y-2">
            {tool.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-gray-700">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-black text-white text-xs flex items-center justify-center font-medium">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          Got it, let's go!
        </button>
      </div>
    </Modal>
  );
}
