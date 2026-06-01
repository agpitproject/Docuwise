import React, { useState } from 'react';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

const ENDPOINTS = [
  { method: 'POST', path: '/api/auth/register',    desc: 'Create a new account' },
  { method: 'POST', path: '/api/auth/login',        desc: 'Obtain a JWT token' },
  { method: 'GET',  path: '/api/auth/me',           desc: 'Get current user profile' },
  { method: 'POST', path: '/api/documents/upload',  desc: 'Upload a document (multipart/form-data)' },
  { method: 'GET',  path: '/api/documents',         desc: 'List all user documents' },
  { method: 'DELETE',path: '/api/documents/:id',    desc: 'Delete a document' },
  { method: 'POST', path: '/api/analysis/run',      desc: 'Start an analysis job' },
  { method: 'GET',  path: '/api/analysis/:id',      desc: 'Poll analysis status & results' },
  { method: 'POST', path: '/api/analysis/:id/qa',   desc: 'Ask a question about a document' },
  { method: 'POST', path: '/api/analysis/batch',    desc: 'Batch-analyse multiple documents' },
];

const METHOD_STYLE = {
  GET:    'bg-blue-50 text-blue-700',
  POST:   'bg-green-50 text-green-700',
  DELETE: 'bg-red-50 text-red-700',
  PATCH:  'bg-amber-50 text-amber-700',
};

const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!'); };

export default function ApiPage() {
  const { user } = useAuthStore();
  const [keyVisible, setKeyVisible] = useState(false);
  const [apiKey, setApiKey] = useState(user?.apiKey || null);
  const [generating, setGenerating] = useState(false);

  const generateKey = async () => {
    setGenerating(true);
    try {
      const res = await authService.generateApiKey();
      setApiKey(res.data.data.apiKey);
      toast.success('Preview API key generated. JWT auth is still required.');
    } catch {
      toast.error('Failed to generate API key. Please log in first.');
    } finally {
      setGenerating(false);
    }
  };

  const maskedKey = apiKey ? `dw_live_${'*'.repeat(32)}` : null;

  const curlExample = `curl -X POST https://docuwisebackend.onrender.com/api/analysis/run \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "documentId": "64f3a2b1c9e4d8f0a1b2c3d4",
    "mode": "summarization",
    "language": "en"
  }'`;

  const uploadExample = `curl -X POST https://docuwisebackend.onrender.com/api/documents/upload \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@report.pdf"`;

  const responseExample = `{
  "success": true,
  "message": "Analysis started",
  "data": {
    "analysisId": "64f3a2b1c9e4d8f0a1b2c3d4",
    "status": "processing"
  }
}`;

  return (
    <div className="max-w-[820px] mx-auto px-8 py-14 fade-up">
      <h1 className="font-serif text-[38px] mb-2">API & developer tools</h1>
      <p className="text-[15px] text-muted mb-10">
        Use the local REST API with JWT authentication while developer API-key access is still in preview.
        Remote base URL: <code className="bg-surface2 px-2 py-0.5 rounded text-[13px]">https://docuwisebackend.onrender.com</code>
      </p>

      {/* API Key */}
      <Section title="Developer API access">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4 text-[13px] leading-5 text-amber-800">
          Developer API access is planned. Generated keys are preview-only and are not active for authentication yet.
          Use JWT Bearer tokens from login for protected API routes.
        </div>
        <div className="card p-5 flex items-center gap-4 mb-4">
          <code className="flex-1 text-[13px] text-muted font-mono tracking-wide">
            {apiKey ? (keyVisible ? apiKey : maskedKey) : 'No key generated yet'}
          </code>
          {apiKey && (
            <button onClick={() => setKeyVisible(!keyVisible)} className="btn-ghost p-2">
              {keyVisible ? <EyeOff size={15}/> : <Eye size={15}/>}
            </button>
          )}
          {apiKey && (
            <button onClick={() => copy(apiKey)} className="btn-outline text-[12px] px-3 py-2">
              <Copy size={13}/> Copy
            </button>
          )}
          <button onClick={generateKey} disabled={generating}
            className="btn-primary text-[12px] px-4 py-2 disabled:opacity-60">
            {generating ? 'Generating...' : apiKey ? 'Regenerate preview key' : 'Generate preview key'}
          </button>
        </div>
        <p className="text-[12px] text-muted">
          Preview keys are stored for future developer access only. They are not accepted by the current auth middleware.
        </p>
      </Section>

      {/* Quick Start */}
      <Section title="Quick start - run analysis">
        <CodeBlock code={curlExample} lang="bash"/>
      </Section>

      <Section title="Upload document - cURL">
        <CodeBlock code={uploadExample} lang="bash"/>
      </Section>

      <Section title="Example response">
        <CodeBlock code={responseExample} lang="json"/>
      </Section>

      {/* Endpoints */}
      <Section title="All endpoints">
        <div className="space-y-2.5">
          {ENDPOINTS.map((ep) => (
            <div key={ep.path} className="card px-5 py-4 flex items-center gap-4">
              <span className={`badge ${METHOD_STYLE[ep.method]} text-[10px] font-bold uppercase
                               tracking-wider w-16 justify-center`}>
                {ep.method}
              </span>
              <code className="text-[13px] flex-1 font-mono">{ep.path}</code>
              <span className="text-[12px] text-muted">{ep.desc}</span>
              <button onClick={() => copy(ep.path)} className="btn-ghost p-1.5">
                <Copy size={12}/>
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* Auth header */}
      <Section title="Authentication">
        <p className="text-[13px] text-muted mb-4">
          All endpoints (except <code className="bg-surface2 px-1.5 py-0.5 rounded">/auth/register</code> and{' '}
          <code className="bg-surface2 px-1.5 py-0.5 rounded">/auth/login</code>) require a Bearer token.
        </p>
        <CodeBlock code={`Authorization: Bearer YOUR_JWT_TOKEN`} lang="bash"/>
      </Section>

      {/* Testing tools */}
      <Section title="Testing with Thunder Client / Postman / Hoppscotch">
        <div className="grid grid-cols-3 gap-4">
          {[
            { name: 'Thunder Client', url: 'https://www.thunderclient.com', desc: 'VS Code extension - lightweight REST client' },
            { name: 'Postman', url: 'https://postman.com', desc: 'Industry-standard API testing platform' },
            { name: 'Hoppscotch', url: 'https://hoppscotch.io', desc: 'Open-source, browser-based API tool' },
          ].map(({ name, url, desc }) => (
            <a key={name} href={url} target="_blank" rel="noreferrer"
               className="card p-4 hover:shadow-sm transition-all block no-underline">
              <h4 className="text-[13px] font-semibold mb-1 text-ink">{name}</h4>
              <p className="text-[12px] text-muted">{desc}</p>
              <span className="text-[11px] text-accent mt-2 block">Open</span>
            </a>
          ))}
        </div>
        <p className="text-[12px] text-muted mt-4">
          Set base URL to <code className="bg-surface2 px-1.5 py-0.5 rounded">https://docuwisebackend.onrender.com</code> when running locally.
          Add the Authorization header with your JWT token from login to all protected routes.
          API-key authentication is not enabled in this build.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h3 className="text-[15px] font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function CodeBlock({ code, lang }) {
  return (
    <div className="relative">
      <pre className="bg-ink text-[#E8E6DE] rounded-xl p-6 text-[13px] leading-relaxed overflow-x-auto font-mono">
        {code}
      </pre>
      <button onClick={() => copy(code)}
        className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white/80
                   border-none rounded-lg px-3 py-1.5 text-[11px] cursor-pointer flex items-center gap-1.5 transition-all">
        <Copy size={11}/> Copy
      </button>
    </div>
  );
}
