import React from 'react';

interface StatusBadgeProps {
  status: 'Online' | 'Offline' | 'Error' | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  let color = 'var(--text-muted)';
  if (status.toLowerCase().includes('online') || status.toLowerCase().includes('success')) {
    color = 'var(--success)';
  } else if (status.toLowerCase().includes('error') || status.toLowerCase().includes('absent')) {
    color = 'var(--error)';
  } else if (status.toLowerCase().includes('warning') || status.toLowerCase().includes('leave')) {
    color = 'var(--warning)';
  }

  return (
    <span style={{ color, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
      <div style={{ width: 8, height: 8, backgroundColor: color, borderRadius: '50%' }} className="pulse"></div>
      {status}
    </span>
  );
};
