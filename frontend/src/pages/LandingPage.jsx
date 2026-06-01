import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Zap, Lock, CheckCircle } from 'lucide-react';
import AuthModal from '../components/Auth/AuthModal';
import AppFooter from '../components/Layout/AppFooter';

const FEATURES = [
  { icon: '📋', title: 'Categorization', desc: 'Topics, domain, and document type auto-labelled by BERT' },
  { icon: '✏️', title: 'Summarization', desc: 'Key points distilled by GPT-4o into a clear summary' },
  { icon: '💬', title: 'Sentiment', desc: 'Positive / negative / neutral scored with confidence %' },
  { icon: '🔍', title: 'Entity extraction', desc: 'Names, dates, orgs, locations pulled from the text' },
  { icon: '🤖', title: 'Document Q&A', desc: 'Ask any question and get answers grounded in your doc' },
  { icon: '🔑', title: 'Keywords', desc: 'Ranked key phrases and concepts from the full text' },
  { icon: '🌐', title: 'Translation', desc: 'Get results in your selected output language' },
  { icon: '📦', title: 'Batch API', desc: 'Process hundreds of docs via REST API + webhooks' },
];

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    sub: 'per month',
    desc: 'Try DocuWise risk-free',
    features: ['Unlimited analyses', '3 core modes', 'Unlimited downloads', 'Basic Q&A', 'Text export'],
    cta: 'Get started free',
    accent: false,
  },
  {
    name: 'Pro',
    price: '$19',
    sub: 'per month',
    desc: 'For professionals',
    features: ['Unlimited analyses', 'All AI modes', 'Max 50MB per file', 'Advanced Q&A', 'Export PDF, DOCX, CSV', 'Translation', 'Doc comparison', 'Priority processing'],
    cta: 'View options',
    accent: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    sub: '',
    desc: 'For teams & orgs',
    features: ['Everything in Pro', 'Team workspaces', 'SSO / SAML', 'REST API + webhooks', 'Batch processing', 'Audit logs', 'White-label', 'SLA support'],
    cta: 'View options',
    accent: false,
  },
];

export default function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <section className="max-w-[820px] mx-auto px-8 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 text-[12px] font-semibold text-accent bg-accent-light px-4 py-1.5 rounded-full mb-7 border border-accent/15">
          <Zap size={12} /> AI-powered document intelligence
        </div>
        <h1 className="font-serif text-[62px] leading-[1.08] tracking-tight mb-5">
          Understand any document, <em className="not-italic text-accent">instantly</em>
        </h1>
        <p className="text-[18px] text-muted max-w-[540px] mx-auto mb-10 font-light leading-relaxed">
          Upload a PDF, Word doc, or text file and get AI-powered categorization, summaries, sentiment analysis, translation, entity extraction, and Q&A in seconds.
        </p>
        <div className="flex gap-3 justify-center flex-wrap mb-10">
          <button onClick={() => setAuthOpen(true)} className="btn-primary px-8 py-3 text-[15px]">
            Start for free
          </button>
          <button onClick={() => navigate('/pricing')} className="btn-outline px-6 py-3 text-[15px]">
            See pricing
          </button>
        </div>
        <div className="flex justify-center gap-7 flex-wrap">
          {[
            { icon: <CheckCircle size={14} className="text-green-500" />, text: 'No signup to try' },
            { icon: <Lock size={14} className="text-green-500" />, text: 'Files deleted after analysis' },
            { icon: <Shield size={14} className="text-green-500" />, text: 'End-to-end encrypted' },
          ].map(({ icon, text }) => (
            <span key={text} className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
              {icon}
              {text}
            </span>
          ))}
        </div>
      </section>

      <hr className="border-black/[0.08]" />

      <section className="max-w-[940px] mx-auto px-8 py-20">
        <p className="section-eyebrow text-center">Everything you need</p>
        <h2 className="section-title text-center text-[38px]">All analysis modes in one place</h2>
        <p className="text-[15px] text-muted text-center max-w-xl mx-auto mb-12">
          Core AI analysis plus collaboration and live workflow support for power users.
        </p>
        <div className="grid grid-cols-4 gap-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card p-5 hover:shadow-md transition-shadow">
              <div className="text-[26px] mb-3">{feature.icon}</div>
              <h4 className="text-[13px] font-semibold mb-1.5">{feature.title}</h4>
              <p className="text-[12px] text-muted leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-black/[0.08]" />

      <section className="bg-white py-20">
        <div className="max-w-[940px] mx-auto px-8">
          <p className="section-eyebrow">How it works</p>
          <h2 className="section-title">Three steps to insight</h2>
          <div className="grid grid-cols-3 gap-10">
            {[
              { n: '1', title: 'Upload your file', desc: 'Drag and drop any .txt, .pdf, or .docx file up to 50MB.' },
              { n: '2', title: 'Choose your analysis', desc: 'Pick a focused mode or run the full pipeline with translation and extraction together.' },
              { n: '3', title: 'Work with the result', desc: 'Export, collaborate with up to three partners, and use selected-text search or translation directly in the preview.' },
            ].map(({ n, title, desc }) => (
              <div key={n}>
                <div className="w-9 h-9 bg-ink text-bg rounded-full flex items-center justify-center text-[13px] font-semibold mb-4">{n}</div>
                <h4 className="text-[14px] font-semibold mb-2">{title}</h4>
                <p className="text-[13px] text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="border-black/[0.08]" />

      <section className="max-w-[940px] mx-auto px-8 py-20">
        <p className="section-eyebrow text-center">Pricing</p>
        <h2 className="section-title text-center">Simple, honest pricing</h2>
        <p className="text-[15px] text-muted text-center max-w-md mx-auto mb-12">
          Pricing is visible for reference, but this build currently keeps analyses and downloads unlimited.
        </p>
        <div className="grid grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`card p-7 relative ${plan.accent ? 'border-accent shadow-[0_0_0_3px_rgba(37,99,235,.10)]' : ''}`}>
              {plan.accent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[11px] font-semibold px-4 py-1 rounded-full whitespace-nowrap">
                  Most popular
                </span>
              )}
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">{plan.name}</p>
              <div className="font-serif text-[44px] leading-none mb-1">
                {plan.price}
                {plan.sub && <span className="font-sans text-[14px] font-normal text-muted"> / {plan.sub.replace('per ', '')}</span>}
              </div>
              <p className="text-[13px] text-muted mb-5">{plan.desc}</p>
              <ul className="space-y-2 mb-7">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-[13px]">
                    <CheckCircle size={14} className="text-green-500 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button onClick={() => setAuthOpen(true)} className={`w-full py-3 rounded-lg text-[14px] font-medium transition-all ${plan.accent ? 'btn-accent' : 'btn-outline'}`}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      <AppFooter />

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode="signup" />
    </>
  );
}
