import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import AuthModal from '../Auth/AuthModal';
import ActivityBell from './ActivityBell';

export default function Navbar() {
  const { user, logout, token } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const openLogin  = () => { setAuthMode('login');  setAuthOpen(true); };
  const openSignup = () => { setAuthMode('signup'); setAuthOpen(true); };

  return (
    <>
      <nav className="sticky top-0 z-50 h-[60px] flex items-center px-8 gap-2
                      bg-bg/95 backdrop-blur-md border-b border-black/[0.09]">
        {/* Logo */}
        <Link to="/" className="font-serif text-[22px] flex items-center gap-2 mr-auto text-ink no-underline">
          <span className="w-2 h-2 rounded-full bg-accent inline-block" />
          Docu<em className="not-italic text-accent">Wise</em>
        </Link>

        {/* Nav links */}
        <NavLink to="/"          active={isActive('/')}>Home</NavLink>
        {token && <NavLink to="/dashboard" active={isActive('/dashboard')}>Dashboard</NavLink>}
        {token && <NavLink to="/analyse"   active={isActive('/analyse')}>Analyse</NavLink>}
        <NavLink to="/pricing"   active={isActive('/pricing')}>Pricing</NavLink>
        <NavLink to="/api-docs"  active={isActive('/api-docs')}>API</NavLink>

        <div className="flex-1" />

        {/* Auth state */}
        {token ? (
          <div className="flex items-center gap-3">
            <ActivityBell />
            <span className="text-[10px] font-semibold bg-accent-light text-accent px-2.5 py-1 rounded-full uppercase tracking-wide">
              {user?.plan || 'Free'} plan
            </span>
            <Link to="/settings" className="w-8 h-8 rounded-full bg-ink text-bg flex items-center
                                            justify-center text-xs font-semibold hover:opacity-80">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </Link>
            <button onClick={handleLogout}
              className="text-sm text-muted hover:text-ink bg-transparent border-none cursor-pointer px-2 py-1">
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={openLogin}
              className="text-sm font-medium text-muted hover:text-ink bg-transparent border-none cursor-pointer px-3 py-1.5 rounded-lg hover:bg-surface2 transition-all">
              Sign in
            </button>
            <button onClick={openSignup}
              className="btn-primary text-sm px-4 py-2">
              Get started free
            </button>
          </div>
        )}
      </nav>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
      />
    </>
  );
}

function NavLink({ to, active, children }) {
  return (
    <Link to={to}
      className={`text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all no-underline
        ${active ? 'text-ink bg-surface2' : 'text-muted hover:text-ink hover:bg-surface2'}`}>
      {children}
    </Link>
  );
}
