import React from 'react';
import { useParams } from 'react-router-dom';
import AppFooter from '../components/Layout/AppFooter';

const PAGES = {
  'privacy-policy': {
    title: 'Privacy policy',
    intro: 'How DocuWise handles uploaded files, account details, and derived analysis outputs.',
    sections: [
      'Uploaded documents are used only to provide the requested analysis, translation, and export features.',
      'Profile settings such as default language, notification preferences, and privacy choices are stored with your account so the app can personalize behavior.',
      'If auto-delete is enabled, uploaded source files are removed after analysis completes. Analysis records may still remain in your history unless you disable history retention.',
    ],
  },
  'terms-of-service': {
    title: 'Terms of service',
    intro: 'The baseline rules for using this DocuWise build.',
    sections: [
      'You are responsible for the documents you upload and for confirming that you have permission to process them.',
      'AI-generated summaries, translations, and classifications should be reviewed before being treated as legal, financial, or compliance advice.',
      'The pricing page is currently informational only and does not enforce billing or access restrictions in this build.',
    ],
  },
  gdpr: {
    title: 'GDPR',
    intro: 'Privacy-friendly controls that support safer document processing for EU-related workflows.',
    sections: [
      'Users can manage retention preferences through Settings, including automatic file deletion after processing.',
      'Analysis history and profile preferences can be exported or removed through account controls and admin workflows.',
      'Sensitive content should still be reviewed carefully before being uploaded to any shared environment.',
    ],
  },
  cookies: {
    title: 'Cookies',
    intro: 'What local storage and browser state are used for in the app.',
    sections: [
      'Authentication state is stored locally so sessions can survive refreshes.',
      'UI preferences such as notification state and account settings are retained to make the workspace feel consistent.',
      'No separate marketing-cookie banner is wired into this build yet.',
    ],
  },
  documentation: {
    title: 'Documentation',
    intro: 'Quick guidance on how to use the main document workflows.',
    sections: [
      'Upload a TXT, PDF, or DOCX file from Analyse and wait for text extraction to complete.',
      'Choose a focused mode for one type of output or run Full Analysis for summary, sentiment, categories, keywords, entities, readability, and translation together.',
      'Use the new selection toolbar inside the document preview to search or translate any highlighted phrase directly.',
    ],
  },
  'help-center': {
    title: 'Help center',
    intro: 'Common product questions and where to look first.',
    sections: [
      'If the document preview is empty, the uploaded file may not contain selectable text yet.',
      'If translation stays in English, confirm the selected output language in Settings and rerun the analysis.',
      'Live activity in the navbar shows running jobs and recent completions so you can keep track of background work.',
    ],
  },
  contact: {
    title: 'Contact',
    intro: 'Ways to reach the project team for support or feedback.',
    sections: [
      'Product feedback: product@docuwise.local',
      'Support requests: support@docuwise.local',
      'Operational issues: status updates are published on the Status page inside the app footer.',
    ],
  },
  status: {
    title: 'Status',
    intro: 'Current service visibility for this local build.',
    sections: [
      'Frontend: available',
      'Backend API: depends on your local server process and environment variables',
      'Translation quality: best when OpenAI, Gemini, or LibreTranslate is configured; otherwise the app will fall back to an original-text notice',
    ],
  },
  changelog: {
    title: 'Changelog',
    intro: 'Recent product changes in this workspace.',
    sections: [
      'Upload button now opens the system file chooser correctly.',
      'Analysis access is no longer capped at five runs per month in the current build.',
      'Collaboration, live activity, and selected-text search/translate actions were added to the document workflow.',
    ],
  },
};

export default function InfoPage() {
  const { slug } = useParams();
  const page = PAGES[slug] || {
    title: 'Page not found',
    intro: 'The requested footer page does not exist yet.',
    sections: ['Return to the homepage or choose another footer link.'],
  };

  return (
    <>
      <div className="max-w-[840px] mx-auto px-8 py-20">
        <p className="section-eyebrow">Footer page</p>
        <h1 className="font-serif text-[46px] tracking-tight mb-4">{page.title}</h1>
        <p className="text-[16px] text-muted max-w-[640px] mb-10">{page.intro}</p>

        <div className="space-y-4">
          {page.sections.map((section) => (
            <div key={section} className="card p-6">
              <p className="text-[14px] leading-7 text-ink">{section}</p>
            </div>
          ))}
        </div>
      </div>

      <AppFooter />
    </>
  );
}
