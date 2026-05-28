import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import AuthModal from '../components/Auth/AuthModal';
import AppFooter from '../components/Layout/AppFooter';

const PLANS = [
  {
    name: 'Starter view',
    price: '$0',
    period: '/month',
    desc: 'Current showcase tier',
    features: ['Unlimited analyses', 'Categorization, summarization, sentiment', 'Unlimited downloads', 'Basic document Q&A', 'Text export', 'Community support'],
    cta: 'Display only',
    featured: false,
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    desc: 'For professionals and power users',
    features: ['Unlimited analyses', 'All AI modes + entity extraction', 'Max 50MB per file', 'Advanced document Q&A', 'Export PDF, DOCX, CSV', 'Translation', 'Document comparison', 'Priority processing', 'Email support'],
    cta: 'Display only',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For teams and large organizations',
    features: ['Everything in Pro', 'Team workspaces + roles', 'SSO / SAML', 'REST API + webhooks', 'Batch processing API', 'Audit logs & compliance', 'Custom data retention', 'White-label option', 'Dedicated SLA support'],
    cta: 'Display only',
    featured: false,
  },
];

export default function PricingPage() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <div className="max-w-[960px] mx-auto px-8 py-20">
        <div className="text-center mb-14">
          <p className="section-eyebrow">Pricing</p>
          <h1 className="font-serif text-[48px] tracking-tight mb-4">Simple, honest pricing</h1>
          <p className="text-[16px] text-muted max-w-md mx-auto">
            Pricing is informational right now. This build allows unlimited analyses and unlimited downloads.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`card p-8 relative ${plan.featured ? 'border-accent shadow-[0_0_0_3px_rgba(37,99,235,.10)]' : ''} transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] hover:border-black/15`}
            >
              {plan.featured && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-accent text-white text-[11px] font-semibold px-4 py-1.5 rounded-full whitespace-nowrap">
                  Most popular
                </span>
              )}
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">{plan.name}</p>
              <div className="mb-2">
                <span className="font-serif text-[48px] leading-none">{plan.price}</span>
                {plan.period && <span className="text-[14px] text-muted ml-1">{plan.period}</span>}
              </div>
              <p className="text-[13px] text-muted mb-6">{plan.desc}</p>
              <ul className="space-y-2.5 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[13px]">
                    <CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button onClick={() => setAuthOpen(true)} className={`w-full py-3 rounded-lg text-[14px] font-medium transition-all ${plan.featured ? 'btn-accent' : 'btn-outline'}`}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-20">
          <h2 className="font-serif text-[28px] text-center mb-10">Frequently asked questions</h2>
          <div className="grid grid-cols-2 gap-8 max-w-[720px] mx-auto">
            {[
              { q: 'Is my document data private?', a: 'Yes. Files are encrypted in transit and at rest. We auto-delete uploaded files after processing by default.' },
              { q: 'Is there a monthly analysis cap right now?', a: 'No. The former five-analysis limit was hardcoded before, but the current build no longer enforces that cap.' },
              { q: 'Can I use DocuWise via API?', a: 'Yes. Pro and Enterprise plans describe API-oriented capabilities, though the pricing page is currently for display.' },
              { q: 'What file types are supported?', a: 'We support .txt, .pdf, and .docx files. The current upload flow allows files up to 50MB.' },
            ].map(({ q, a }) => (
              <div key={q}>
                <h4 className="text-[14px] font-semibold mb-2">{q}</h4>
                <p className="text-[13px] text-muted leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AppFooter />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode="signup" />
    </>
  );
}
