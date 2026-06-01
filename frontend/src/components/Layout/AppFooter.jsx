import React from 'react';
import { Link } from 'react-router-dom';

const GROUPS = [
  {
    title: 'Product',
    links: [
      { label: 'Home', to: '/' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'API', to: '/api-docs' },
      { label: 'Changelog', to: '/info/changelog' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', to: '/info/privacy-policy' },
      { label: 'Terms of service', to: '/info/terms-of-service' },
      { label: 'GDPR', to: '/info/gdpr' },
      { label: 'Cookies', to: '/info/cookies' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Documentation', to: '/info/documentation' },
      { label: 'Help center', to: '/info/help-center' },
      { label: 'Contact', to: '/info/contact' },
      { label: 'Status', to: '/info/status' },
    ],
  },
];

export default function AppFooter() {
  return (
    <footer className="bg-ink text-white/70 pt-14 pb-8 mt-0">
      <div className="max-w-[940px] mx-auto px-8">
        <div className="grid grid-cols-4 gap-10 mb-12">
          <div>
            <div className="font-serif text-[20px] text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent inline-block" />
              Docu<span className="text-blue-400">Wise</span>
            </div>
            <p className="text-[13px] leading-relaxed max-w-[220px]">
              Intelligent document analysis for teams, translators, and researchers.
            </p>
          </div>

          {GROUPS.map((group) => (
            <div key={group.title}>
              <h5 className="text-[12px] font-semibold uppercase tracking-wider text-white/90 mb-4">{group.title}</h5>
              {group.links.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="block text-[13px] text-white/60 hover:text-white mb-2.5 transition-colors no-underline"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center border-t border-white/10 pt-6 text-[12px]">
          <span>Copyright 2026 DocuWise. All rights reserved.</span>
          <span>End-to-end encrypted - GDPR aligned - Live activity aware</span>
        </div>
      </div>
    </footer>
  );
}
