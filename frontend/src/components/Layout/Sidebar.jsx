import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  LayoutDashboard,
  Zap,
  BookOpen,
  GitCompare,
  Upload,
  Code2,
  Settings,
  Users,
  Bell,
} from 'lucide-react';

const PLAN_LIMITS = { free: Infinity, pro: Infinity, enterprise: Infinity };

export default function Sidebar({ activeView, onViewChange, onToolClick }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const usage = user?.monthlyUsage || 0;
  const limit = PLAN_LIMITS[user?.plan || 'free'];
  const usedPct = limit === Infinity ? 20 : Math.min((usage / limit) * 100, 100);

  const go = (view) => onViewChange ? onViewChange(view) : null;
  const handleToolClick = (tool) => {
    if (onToolClick) onToolClick(tool);
    go(tool === 'compare-docs' ? 'compare' : tool === 'batch-upload' ? 'batch' : tool === 'collaboration' ? 'collaboration' : tool === 'live-activity' ? 'activity' : null);
  };

  return (
    <aside className="w-[230px] bg-white border-r border-black/[0.09] flex flex-col py-5 px-3">
      <SidebarGroup label="Workspace">
        <SItem icon={<LayoutDashboard size={16} />} active={activeView === 'overview'} onClick={() => go('overview')}>
          Overview
        </SItem>
        <SItem icon={<Zap size={16} />} onClick={() => navigate('/analyse')}>
          New analysis
        </SItem>
        <SItem icon={<BookOpen size={16} />} active={activeView === 'library'} onClick={() => go('library')}>
          Document library
        </SItem>
      </SidebarGroup>

      <SidebarGroup label="Tools">
        <SItem icon={<GitCompare size={16} />} active={activeView === 'compare'} onClick={() => handleToolClick('compare-docs')}>
          Compare docs
        </SItem>
        <SItem icon={<Upload size={16} />} active={activeView === 'batch'} onClick={() => handleToolClick('batch-upload')}>
          Batch upload
        </SItem>
        <SItem icon={<Users size={16} />} active={activeView === 'collaboration'} onClick={() => handleToolClick('collaboration')}>
          Collaboration
        </SItem>
        <SItem icon={<Bell size={16} />} active={activeView === 'activity'} onClick={() => handleToolClick('live-activity')}>
          Live activity
        </SItem>
        <SItem icon={<Code2 size={16} />} onClick={() => navigate('/api-docs')}>
          API & webhooks
        </SItem>
      </SidebarGroup>

      <SidebarGroup label="Account">
        <SItem icon={<Settings size={16} />} onClick={() => navigate('/settings')}>
          Settings
        </SItem>
      </SidebarGroup>

      <div className="mt-auto pt-4 border-t border-black/[0.09] px-1">
        <div className="flex justify-between text-[11px] text-muted mb-1.5">
          <span>Analysis access</span>
          <span>Unlimited</span>
        </div>
        <div className="h-1.5 bg-surface2 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${usedPct}%` }} />
        </div>
        <p className="text-[11px] text-muted leading-5">
          Pricing is display-only right now. Upload, analyze, collaborate, and export without a monthly cap.
        </p>
      </div>
    </aside>
  );
}

function SidebarGroup({ label, children }) {
  return (
    <div className="mb-6">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted px-2.5 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function SItem({ icon, active, onClick, children, badge }) {
  return (
    <button onClick={onClick} className={`sidebar-item mb-0.5 ${active ? 'active' : ''}`}>
      {icon}
      <span className="flex-1 text-left">{children}</span>
      {badge && (
        <span className="text-[10px] font-semibold bg-surface2 text-muted px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}
