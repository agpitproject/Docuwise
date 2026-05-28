import React from 'react';

const ROLE_CAPABILITIES = {
  owner: ['All actions'],
  editor: ['Add comments', 'React', 'Edit own comments'],
  reviewer: ['Add comments', 'React', 'Edit own comments', 'Resolve comments'],
  approver: ['Add comments', 'React', 'Edit own comments', 'Resolve comments', 'Manage collaborators'],
};

export default function RolePermissionsInfo({ role = 'editor' }) {
  const capabilities = ROLE_CAPABILITIES[role] || ROLE_CAPABILITIES.editor;

  return (
    <div className="card p-3 w-full max-w-[200px]">
      <p className="text-[12px] font-semibold text-ink mb-2">Role permissions</p>
      <p className="text-[11px] text-muted mb-2 capitalize">{role}</p>
      <ul className="space-y-1">
        {capabilities.map((item) => (
          <li key={item} className="text-[11px] text-ink">- {item}</li>
        ))}
      </ul>
    </div>
  );
}
