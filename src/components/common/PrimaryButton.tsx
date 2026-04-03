import React from 'react';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  isAccent?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({ label, isAccent, style, ...props }) => {
  return (
    <button 
      className={isAccent ? "accent" : ""}
      style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', ...style }}
      {...props}
    >
      {label}
    </button>
  );
};
