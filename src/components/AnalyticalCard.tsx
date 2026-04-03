import React from 'react';

interface CardProps {
  title: string;
  value: number;
  icon?: React.ReactNode;
  color?: string;
}

export const AnalyticalCard: React.FC<CardProps> = ({ title, value, icon, color = 'var(--primary-color)' }) => {
  return (
    <div style={{
      backgroundColor: 'var(--surface-color)',
      padding: '24px',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderLeft: `4px solid ${color}`
    }}>
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>{title}</div>
        <div style={{ color: 'var(--text-main)', fontSize: '32px', fontWeight: 'bold' }}>{value}</div>
      </div>
      {icon && <div style={{ color }}>{icon}</div>}
    </div>
  );
};
