import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const NAV = ['Profile', 'Notifications', 'Privacy & data', 'Billing', 'Danger zone'];

export default function SettingsPage() {
  const { user, updateProfile, logout } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Profile');
  const [saving, setSaving] = useState(false);

  // Profile form state
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName,  setLastName]  = useState(user?.lastName  || '');
  const [email,     setEmail]     = useState(user?.email     || '');
  const [lang,      setLang]      = useState(user?.defaultLanguage || 'en');

  // Notification toggles
  const [notif, setNotif] = useState({
    analysisComplete: user?.notifications?.analysisComplete ?? true,
    weeklyDigest:     user?.notifications?.weeklyDigest     ?? true,
    usageWarnings:    user?.notifications?.usageWarnings    ?? false,
    productUpdates:   user?.notifications?.productUpdates   ?? false,
  });

  // Privacy toggles
  const [privacy, setPrivacy] = useState({
    autoDeleteFiles: user?.privacy?.autoDeleteFiles ?? true,
    saveHistory:     user?.privacy?.saveHistory     ?? true,
  });

  useEffect(() => {
    setFirstName(user?.firstName || '');
    setLastName(user?.lastName || '');
    setEmail(user?.email || '');
    setLang(user?.defaultLanguage || 'en');
    setNotif({
      analysisComplete: user?.notifications?.analysisComplete ?? true,
      weeklyDigest: user?.notifications?.weeklyDigest ?? true,
      usageWarnings: user?.notifications?.usageWarnings ?? false,
      productUpdates: user?.notifications?.productUpdates ?? false,
    });
    setPrivacy({
      autoDeleteFiles: user?.privacy?.autoDeleteFiles ?? true,
      saveHistory: user?.privacy?.saveHistory ?? true,
    });
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    const res = await updateProfile({ firstName, lastName, defaultLanguage: lang });
    setSaving(false);
    if (res.success) toast.success('Profile saved!');
    else toast.error(res.message);
  };

  const saveNotifications = async () => {
    setSaving(true);
    const res = await updateProfile({ notifications: notif });
    setSaving(false);
    if (res.success) toast.success('Notifications updated!');
    else toast.error(res.message);
  };

  const savePrivacy = async () => {
    setSaving(true);
    const res = await updateProfile({ privacy });
    setSaving(false);
    if (res.success) toast.success('Privacy settings saved!');
    else toast.error(res.message);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Signed out');
  };

  return (
    <div className="flex fade-up" style={{ minHeight: 'calc(100vh - 60px)' }}>
      {/* Settings nav */}
      <nav className="w-[210px] bg-white border-r border-black/[0.09] py-6 px-3 shrink-0">
        {NAV.map((item) => (
          <button key={item} onClick={() => setActiveTab(item)}
            className={`sidebar-item mb-0.5 ${activeTab === item ? 'active' : ''}`}>
            {item}
          </button>
        ))}
        <div className="mt-4 pt-4 border-t border-black/[0.09]">
          <button onClick={handleLogout}
            className="sidebar-item text-red-500 hover:bg-red-50 hover:text-red-600">
            Sign out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-10 bg-bg max-w-[680px]">

        {/* Plan banner */}
        <div className="bg-accent rounded-xl p-6 flex items-center justify-between mb-10">
          <div>
            <h3 className="text-white font-semibold text-[16px] mb-1 capitalize">
              {user?.plan || 'Free'} plan
            </h3>
            <p className="text-white/80 text-[13px]">
              Unlimited analyses and downloads are enabled in the current build.
            </p>
          </div>
          <button onClick={() => navigate('/pricing')}
            className="bg-white text-accent font-semibold text-[13px] px-5 py-2.5
                       rounded-lg hover:bg-accent-light transition-all border-none cursor-pointer">
            View pricing
          </button>
        </div>

        {/* ── PROFILE ── */}
        {activeTab === 'Profile' && (
          <Section title="Profile" desc="Your personal information and display preferences">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field label="First name">
                <input className="input" type="text" value={firstName}
                       onChange={e => setFirstName(e.target.value)} placeholder="First name"/>
              </Field>
              <Field label="Last name">
                <input className="input" type="text" value={lastName}
                       onChange={e => setLastName(e.target.value)} placeholder="Last name"/>
              </Field>
            </div>
            <Field label="Email address" className="mb-4">
              <input className="input" type="email" value={email}
                     onChange={e => setEmail(e.target.value)} disabled
                     placeholder="Email" title="Email cannot be changed"/>
              <p className="text-[11px] text-muted mt-1">Email cannot be changed after registration</p>
            </Field>
            <Field label="Default output language" className="mb-6">
              <select className="input" value={lang} onChange={e => setLang(e.target.value)}>
                <option value="en">English (EN)</option>
                <option value="fr">French (FR)</option>
                <option value="es">Spanish (ES)</option>
                <option value="de">German (DE)</option>
                <option value="hi">Hindi (HI)</option>
                <option value="zh">Chinese (ZH)</option>
                <option value="ar">Arabic (AR)</option>
                <option value="pt">Portuguese (PT)</option>
              </select>
            </Field>
            <button onClick={saveProfile} disabled={saving}
              className="btn-primary px-8 py-2.5 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </Section>
        )}

        {/* ── NOTIFICATIONS ── */}
        {activeTab === 'Notifications' && (
          <Section title="Notifications" desc="Control how and when DocuWise contacts you">
            <div className="divide-y divide-black/[0.07]">
              {[
                { key: 'analysisComplete', title: 'Analysis complete',  desc: 'Notify when a document analysis finishes' },
                { key: 'weeklyDigest',     title: 'Weekly digest',      desc: 'Summary of your document activity each week' },
                { key: 'usageWarnings',    title: 'Usage warnings',     desc: 'Alert when a task needs attention or takes longer than expected' },
                { key: 'productUpdates',   title: 'Product updates',    desc: 'New features and improvement announcements' },
              ].map(({ key, title, desc }) => (
                <div key={key} className="flex items-center justify-between py-4">
                  <div>
                    <h5 className="text-[14px] font-medium">{title}</h5>
                    <p className="text-[12px] text-muted">{desc}</p>
                  </div>
                  <Toggle checked={notif[key]} onChange={v => setNotif(p => ({ ...p, [key]: v }))}/>
                </div>
              ))}
            </div>
            <button onClick={saveNotifications} disabled={saving}
              className="btn-primary mt-6 px-8 py-2.5 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save preferences'}
            </button>
          </Section>
        )}

        {/* ── PRIVACY ── */}
        {activeTab === 'Privacy & data' && (
          <Section title="Privacy & data" desc="Control how your documents and data are handled">
            <div className="divide-y divide-black/[0.07] mb-6">
              {[
                { key: 'autoDeleteFiles', title: 'Auto-delete files after analysis', desc: 'Uploaded files are permanently removed once analysis completes' },
                { key: 'saveHistory',     title: 'Save analysis history',            desc: 'Keep results in your document library for future reference' },
              ].map(({ key, title, desc }) => (
                <div key={key} className="flex items-center justify-between py-4">
                  <div>
                    <h5 className="text-[14px] font-medium">{title}</h5>
                    <p className="text-[12px] text-muted">{desc}</p>
                  </div>
                  <Toggle checked={privacy[key]} onChange={v => setPrivacy(p => ({ ...p, [key]: v }))}/>
                </div>
              ))}
            </div>
            <button onClick={savePrivacy} disabled={saving}
              className="btn-primary px-8 py-2.5 mb-6 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save settings'}
            </button>
            <div className="flex gap-3 pt-4 border-t border-black/[0.09]">
              <button onClick={() => toast.success('Data export requested - check your email shortly.')}
                className="btn-outline text-[13px] px-5 py-2.5">
                Export my data
              </button>
            </div>
          </Section>
        )}

        {/* ── BILLING ── */}
        {activeTab === 'Billing' && (
          <Section title="Billing" desc="Manage your subscription and payment details">
            <div className="card p-6 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[13px] text-muted mb-1">Current plan</p>
                  <p className="text-[18px] font-semibold capitalize">{user?.plan || 'Free'}</p>
                </div>
                <button onClick={() => navigate('/pricing')}
                  className="btn-accent text-[13px] px-5 py-2.5">
                  View pricing
                </button>
              </div>
            </div>
            <p className="text-[13px] text-muted">
              The pricing page is currently informational. Access limits are not enforced in this build.
            </p>
          </Section>
        )}

        {/* ── DANGER ZONE ── */}
        {activeTab === 'Danger zone' && (
          <Section title="Danger zone" desc="Irreversible account actions">
            <div className="border border-red-200 bg-red-50 rounded-xl p-6">
              <h4 className="text-[14px] font-semibold text-red-700 mb-2">Delete account</h4>
              <p className="text-[13px] text-red-600/80 mb-5">
                This will permanently delete your account, all documents, and all analysis history.
                This action cannot be undone.
              </p>
              <button
                onClick={() => {
                  if (window.confirm('Are you absolutely sure? This cannot be undone.')) {
                    toast.error('Account deletion requested. You will receive a confirmation email.');
                  }
                }}
                className="bg-red-600 text-white text-[13px] font-medium px-6 py-2.5 rounded-lg
                           hover:bg-red-700 transition-all border-none cursor-pointer">
                Delete my account
              </button>
            </div>
          </Section>
        )}

      </main>
    </div>
  );
}

function Section({ title, desc, children }) {
  return (
    <div>
      <h2 className="text-[18px] font-semibold mb-1">{title}</h2>
      <p className="text-[13px] text-muted mb-7">{desc}</p>
      {children}
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="text-[13px] font-medium block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 border-none cursor-pointer shrink-0
        ${checked ? 'bg-accent' : 'bg-black/20'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm
                        transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}/>
    </button>
  );
}
