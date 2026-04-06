import React, { useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Shield, Lock, Eye, EyeOff } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export const SuperAdminGuard: React.FC<Props> = ({ children }) => {
  const { isUnlocked, isPinSet, unlock, setPin, lock } = useAdminAuth();
  const [pin, setInputPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [setupMode, setSetupMode] = useState(!isPinSet);

  // Keep setupMode reactive when isPinSet changes
  React.useEffect(() => { if (!isPinSet) setSetupMode(true); }, [isPinSet]);

  const handleUnlock = async () => {
    if (!pin.trim()) return;
    setLoading(true);
    setError('');
    const ok = await unlock(pin);
    setLoading(false);
    if (!ok) {
      setError('Incorrect Master PIN. Access denied.');
      setInputPin('');
    }
  };

  const handleSetupPin = async () => {
    if (newPin.length < 4) { setError('PIN must be at least 4 characters.'); return; }
    if (newPin !== confirmPin) { setError('PINs do not match.'); return; }
    setLoading(true);
    setError('');
    const ok = await setPin(null, newPin);
    setLoading(false);
    if (ok) {
      setSetupMode(false);
      setNewPin('');
      setConfirmPin('');
    } else {
      setError('Failed to save PIN. Try again.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setupMode ? handleSetupPin() : handleUnlock();
    }
  };

  if (isUnlocked) {
    return (
      <div style={{ position: 'relative' }}>
        {/* Lock button in top-right */}
        <button
          onClick={lock}
          title="Lock Master Settings"
          style={{
            position: 'absolute', top: 28, right: 32, zIndex: 10,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.4)',
            background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer',
            fontSize: 12, fontWeight: 700,
          }}
        >
          <Lock size={13} /> Lock
        </button>
        {children}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: 24 }}>
      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 420, backgroundColor: 'var(--surface-color)',
        borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          padding: '32px 32px 24px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.2)',
          }}>
            <Shield size={28} color="#a5b4fc" />
          </div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>
            {setupMode ? 'Set Master PIN' : 'Super Admin Access'}
          </h2>
          <p style={{ margin: '8px 0 0', color: '#a5b4fc', fontSize: 13 }}>
            {setupMode
              ? 'Create a Master PIN to protect system settings'
              : 'Enter your Master PIN to access protected settings'}
          </p>
        </div>

        {/* Form Body */}
        <div style={{ padding: '28px 32px 32px' }}>
          {setupMode ? (
            <>
              <Field label="New Master PIN" show={showPin} onToggle={() => setShowPin(s => !s)}>
                <PinInput value={newPin} onChange={setNewPin} show={showPin} placeholder="Min. 4 characters" onKeyDown={handleKeyDown} />
              </Field>
              <Field label="Confirm PIN" show={showPin} onToggle={() => setShowPin(s => !s)} hideToggle>
                <PinInput value={confirmPin} onChange={setConfirmPin} show={showPin} placeholder="Repeat PIN" onKeyDown={handleKeyDown} />
              </Field>
            </>
          ) : (
            <Field label="Master PIN" show={showPin} onToggle={() => setShowPin(s => !s)}>
              <PinInput value={pin} onChange={setInputPin} show={showPin} placeholder="Enter Master PIN" onKeyDown={handleKeyDown} autoFocus />
            </Field>
          )}

          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            onClick={setupMode ? handleSetupPin : handleUnlock}
            disabled={loading}
            style={{
              width: '100%', padding: '12px', borderRadius: 10, border: 'none',
              background: loading ? 'var(--text-muted)' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: '#fff', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? 'Verifying...' : setupMode ? '🔐 Set PIN & Unlock' : '🔓 Unlock Settings'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'var(--text-muted)' }}>
            <Lock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Protected by AES-256 encrypted PIN storage
          </p>
        </div>
      </div>

      {/* Read-only notice */}
      <div style={{ marginTop: 24, textAlign: 'center', maxWidth: 380 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Without Super Admin access, System Settings are <strong>read-only</strong>. All changes to cloud credentials and license require PIN verification.
        </p>
      </div>
    </div>
  );
};

// Sub-components
const Field: React.FC<{ label: string; show: boolean; onToggle: () => void; hideToggle?: boolean; children: React.ReactNode }> = ({ label, children, show, onToggle, hideToggle }) => (
  <div style={{ marginBottom: 20 }}>
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
      {label}
      {!hideToggle && (
        <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
    </label>
    {children}
  </div>
);

const PinInput: React.FC<{ value: string; onChange: (v: string) => void; show: boolean; placeholder?: string; onKeyDown?: (e: React.KeyboardEvent) => void; autoFocus?: boolean }> = ({ value, onChange, show, placeholder, onKeyDown, autoFocus }) => (
  <input
    type={show ? 'text' : 'password'}
    value={value}
    onChange={e => onChange(e.target.value)}
    onKeyDown={onKeyDown}
    autoFocus={autoFocus}
    placeholder={placeholder}
    style={{
      width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontSize: 16,
      outline: 'none', boxSizing: 'border-box', letterSpacing: show ? 'normal' : '0.3em',
    }}
  />
);
