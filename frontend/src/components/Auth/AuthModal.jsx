import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }) {
  const [mode, setMode]             = useState(initialMode);
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const googleButtonRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const { login, register, googleLogin } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => { setMode(initialMode); }, [initialMode]);

  const handleGoogleCredential = useCallback(async (response) => {
    if (!response?.credential) {
      toast.error('Google sign in was cancelled');
      return;
    }

    setGoogleSubmitting(true);
    const result = await googleLogin(response.credential);
    setGoogleSubmitting(false);

    if (result.success) {
      toast.success('Welcome back!');
      onClose();
      navigate('/dashboard');
    } else {
      toast.error(result.message);
    }
  }, [googleLogin, navigate, onClose]);

  useEffect(() => {
    if (!isOpen || !googleClientId) return;

    let cancelled = false;

    const renderGoogleButton = () => {
      if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return;

      googleButtonRef.current.innerHTML = '';
      latestGoogleCredentialHandler = handleGoogleCredential;

      if (googleInitializedClientId !== googleClientId) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
        });
        googleInitializedClientId = googleClientId;
      }

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        width: 360,
        text: mode === 'login' ? 'signin_with' : 'continue_with',
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      const existingScript = document.getElementById('google-identity-services');

      if (existingScript) {
        existingScript.addEventListener('load', renderGoogleButton, { once: true });
      } else {
        const script = document.createElement('script');
        script.id = 'google-identity-services';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = renderGoogleButton;
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (latestGoogleCredentialHandler === handleGoogleCredential) {
        latestGoogleCredentialHandler = null;
      }
    };
  }, [googleClientId, handleGoogleCredential, isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const normalizedEmail = email.trim();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();

    let result;
    if (mode === 'login') {
      result = await login(normalizedEmail, password);
    } else {
      result = await register(normalizedFirstName, normalizedLastName, normalizedEmail, password);
    }

    setSubmitting(false);

    if (result.success) {
      toast.success(mode === 'login' ? 'Welcome back! 👋' : 'Account created! 🎉');
      onClose();
      navigate('/dashboard');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50"
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl p-9 w-[440px] max-w-[95vw] relative fade-up shadow-xl">
        <button onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-surface2 flex items-center
                     justify-center text-muted hover:bg-surface3 border-none cursor-pointer">
          <X size={14} />
        </button>

        <h2 className="font-serif text-[26px] mb-1">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h2>
        <p className="text-sm text-muted mb-7">
          {mode === 'login' ? 'Sign in to your DocuWise account' : 'Start for free - no credit card needed'}
        </p>

        {googleClientId && (
          <>
            <div className="flex justify-center min-h-[44px]">
              <div ref={googleButtonRef} className={googleSubmitting ? 'pointer-events-none opacity-60' : ''} />
            </div>

            <div className="flex items-center gap-3 my-5 text-xs text-muted">
              <span className="h-px flex-1 bg-black/10" />
              <span>or</span>
              <span className="h-px flex-1 bg-black/10" />
            </div>
          </>
        )}

        {!googleClientId && (
          <p className="text-xs text-muted mb-4">
            Add VITE_GOOGLE_CLIENT_ID to frontend/.env to enable Google sign in.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-medium block mb-1.5">First name</label>
                <input className="input" type="text" required placeholder="Alex"
                       value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className="text-[13px] font-medium block mb-1.5">Last name</label>
                <input className="input" type="text" required placeholder="Johnson"
                       value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <label className="text-[13px] font-medium block mb-1.5">Email</label>
            <input className="input" type="email" required placeholder="you@example.com"
                   value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div>
            <label className="text-[13px] font-medium block mb-1.5">Password</label>
            <input className="input" type="password" required placeholder="********" minLength={6}
                   value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <button type="submit" disabled={submitting}
            className="btn-primary w-full justify-center py-3 text-[14px] mt-2 disabled:opacity-60">
            {submitting
              ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
              : (mode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        <p className="text-center text-[13px] text-muted mt-5">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-accent font-medium bg-transparent border-none cursor-pointer hover:underline">
            {mode === 'login' ? 'Create one free' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
