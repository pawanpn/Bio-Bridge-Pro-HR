import React from 'react';

interface StandardInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const StandardInput: React.FC<StandardInputProps> = ({ label, style, ...props }) => {
  return (
    <div style={{ marginBottom: '12px', ...style }}>
      {label && <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>{label}</label>}
      <input 
        style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '4px', outline: 'none' }}
        {...props}
      />
    </div>
  );
};
