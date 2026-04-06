import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { AppConfig } from '../config/appConfig';
import { Shield, Lock, Eye, EyeOff, Settings, Key } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface CloudConfig {
  configured: boolean;
  clientEmail?: string;
  projectId?: string;
  rootFolderId?: string;
}

type Tab = 'general' | 'master';

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export const SystemSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [masterUnlocked, setMasterUnlocked] = useState(false);

  // Lock master settings whenever user switches away from that tab
  const handleTabChange = (tab: Tab) => {
    if (tab !== 'master') setMasterUnlocked(false);
    setActiveTab(tab);
  };

  // Lock when component unmounts (user navigated away)
  useEffect(() => {
    return () => setMasterUnlocked(false);
  }, []);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0 }}>System Settings</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
          General configuration and protected Master Settings.
        </p>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border-color)', marginBottom: 32 }}>
        <TabButton
          label="General Settings"
          icon={<Settings size={15} />}
          active={activeTab === 'general'}
          onClick={() => handleTabChange('general')}
        />
        <TabButton
          label="Master Settings"
          icon={<Shield size={15} />}
          active={activeTab === 'master'}
          locked={!masterUnlocked}
          onClick={() => handleTabChange('master')}
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'general' && <GeneralSettings />}
      {activeTab === 'master' && (
        masterUnlocked
          ? <MasterSettingsContent onLock={() => setMasterUnlocked(false)} />
          : <MasterLoginGate onUnlock={() => setMasterUnlocked(true)} />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab Button
// ─────────────────────────────────────────────────────────────────────────────
const TabButton: React.FC<{
  label: string; icon: React.ReactNode; active: boolean;
  locked?: boolean; onClick: () => void;
}> = ({ label, icon, active, locked, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
      fontWeight: active ? 700 : 500, fontSize: 14,
      color: active ? 'var(--primary-color)' : 'var(--text-muted)',
      borderBottom: active ? '2px solid var(--primary-color)' : '2px solid transparent',
      marginBottom: -2, transition: 'all 0.15s',
    }}
  >
    {icon}
    {label}
    {locked && <Lock size={12} style={{ opacity: 0.5 }} />}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// General Settings (public — no lock)
// ─────────────────────────────────────────────────────────────────────────────
const GeneralSettings: React.FC = () => {
  const [calMode, setCalMode] = useState(localStorage.getItem('calendarMode') || 'BS');

  const handleCalChange = (mode: string) => {
    setCalMode(mode);
    localStorage.setItem('calendarMode', mode);
  };

  return (
    <div>
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>Application Preferences</h3>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Calendar Mode</label>
          <div style={{ display: 'flex', gap: 12 }}>
            {['BS', 'AD'].map(m => (
              <button
                key={m}
                onClick={() => handleCalChange(m)}
                style={{
                  padding: '10px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14,
                  border: `2px solid ${calMode === m ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  background: calMode === m ? 'var(--primary-color)' : 'transparent',
                  color: calMode === m ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {m === 'BS' ? '🇳🇵 BS (Bikram Sambat)' : '🌍 AD (Gregorian)'}
              </button>
            ))}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
            Controls how dates are displayed across the application.
          </p>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>Application Version</label>
          <div style={{ fontSize: 14, color: 'var(--text-color)', fontWeight: 600 }}>
            {AppConfig.appName} — v1.0.0
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 20, borderLeft: '4px solid var(--accent-color)' }}>
        <h4 style={{ marginTop: 0, marginBottom: 10 }}>ℹ️ About Master Settings</h4>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0, lineHeight: 1.7 }}>
          The <strong>Master Settings</strong> tab contains sensitive configurations such as Google Drive credentials,
          Service Account keys, and License activation. Access is restricted to <strong>Super Admins only</strong>.
          Click the Master Settings tab and enter the admin password to access it.
        </p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Master Settings Login Gate
// ─────────────────────────────────────────────────────────────────────────────
const MasterLoginGate: React.FC<{ onUnlock: () => void }> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleUnlock = useCallback(async () => {
    if (!pin.trim()) return;
    setLoading(true);
    setError('');
    try {
      const ok = await invoke<boolean>('verify_master_pin', { pin });
      if (ok) {
        onUnlock();
      } else {
        setError('Incorrect password. Access denied.');
        setPin('');
        inputRef.current?.focus();
      }
    } catch (e) {
      setError('Authentication error: ' + e);
    }
    setLoading(false);
  }, [pin, onUnlock]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
      <div style={{
        width: '100%', maxWidth: 420, borderRadius: 16,
        overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        backgroundColor: 'var(--surface-color)',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          padding: '32px 32px 28px', textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 2px rgba(165,180,252,0.4)',
          }}>
            <Shield size={28} color="#a5b4fc" />
          </div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>
            Super Admin Access
          </h2>
          <p style={{ margin: '8px 0 0', color: '#a5b4fc', fontSize: 13 }}>
            Enter your Master Password to unlock settings
          </p>
        </div>

        {/* Form */}
        <div style={{ padding: '28px 32px 32px' }}>
          <label style={{ ...labelStyle, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Master Password
            <button onClick={() => setShowPin(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </label>
          <input
            ref={inputRef}
            type={showPin ? 'text' : 'password'}
            value={pin}
            onChange={e => { setPin(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            placeholder="Enter master password"
            style={{
              ...inputStyle, marginBottom: 16,
              letterSpacing: showPin ? 'normal' : '0.2em', fontSize: 15,
            }}
          />

          {error && (
            <div style={{
              marginBottom: 16, padding: '10px 14px', borderRadius: 8,
              backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444', fontSize: 13,
            }}>
              🚫 {error}
            </div>
          )}

          <button
            onClick={handleUnlock}
            disabled={loading || !pin.trim()}
            style={{
              width: '100%', padding: '12px', borderRadius: 10, border: 'none',
              background: loading || !pin.trim()
                ? 'var(--text-muted)'
                : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: '#fff', fontWeight: 700, fontSize: 15,
              cursor: loading || !pin.trim() ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s',
            }}
          >
            {loading ? 'Verifying...' : '🔓 Unlock Master Settings'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'var(--text-muted)', margin: '18px 0 0' }}>
            <Lock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Session expires when you navigate away
          </p>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Master Settings Content (shown only after unlock)
// ─────────────────────────────────────────────────────────────────────────────
const MasterSettingsContent: React.FC<{ onLock: () => void }> = ({ onLock }) => {
  const [config, setConfig] = useState<CloudConfig | null>(null);
  const [rootFolderId, setRootFolderId] = useState(AppConfig.defaultRootFolderId);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change PIN state
  const [showChangePIN, setShowChangePIN] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const data = await invoke<CloudConfig>('get_cloud_config');
      setConfig(data);
      if (data.configured && data.rootFolderId) setRootFolderId(data.rootFolderId);
    } catch (e) { setStatus('Failed to load config: ' + e); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      JSON.parse(text); // validate
      setJsonText(text);
      setStatus('✅ Key file loaded. Click Save to apply.');
    } catch { setStatus('❌ Invalid JSON file.'); }
  };

  const handleSave = async () => {
    if (!jsonText && !config?.configured) {
      setStatus('❌ Please upload a Service Account JSON key first.');
      return;
    }
    setIsLoading(true);
    setStatus('');
    try {
      await invoke('save_cloud_credentials', { jsonContent: jsonText || '', rootFolderId });
      setStatus('✅ Cloud settings saved successfully!');
      setJsonText('');
      loadConfig();
    } catch (err) { setStatus('❌ Failed: ' + err); }
    setIsLoading(false);
  };

  const handleChangePIN = async () => {
    setPinError(''); setPinSuccess('');
    if (newPin.length < 4) { setPinError('New password must be at least 4 characters.'); return; }
    if (newPin !== confirmPin) { setPinError('Passwords do not match.'); return; }
    try {
      await invoke('set_master_pin', { currentPin, newPin });
      setPinSuccess('✅ Master password updated successfully!');
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
      setTimeout(() => { setShowChangePIN(false); setPinSuccess(''); }, 2000);
    } catch (e) { setPinError('❌ ' + e); }
  };

  return (
    <div>
      {/* Unlock Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderRadius: 8, marginBottom: 24,
        background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontWeight: 600, fontSize: 13 }}>
          <Shield size={16} /> Super Admin Session Active
        </span>
        <button onClick={onLock} style={{
          padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.4)',
          background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer',
          fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <Lock size={12} /> Lock
        </button>
      </div>

      {/* Cloud Configuration */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>☁️ Google Drive Sync</h3>

        {/* Status */}
        {config !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
            padding: '10px 14px', borderRadius: 8,
            background: config.configured ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${config.configured ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: config.configured ? '#10b981' : '#ef4444' }} />
            {config.configured ? (
              <span style={{ fontSize: 13 }}>
                <strong style={{ color: '#10b981' }}>Connected</strong>
                {' — '}{config.clientEmail}
              </span>
            ) : (
              <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>Not Configured</span>
            )}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Root Folder ID</label>
          <input
            type="text" value={rootFolderId}
            onChange={e => setRootFolderId(e.target.value)}
            style={inputStyle} placeholder="Google Drive Folder ID"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Service Account Key (JSON)</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <PrimaryButton label="📂 Choose JSON File" onClick={() => fileInputRef.current?.click()} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {jsonText ? '✅ New key loaded' : config?.configured ? 'Existing key active' : 'No key selected'}
            </span>
          </div>
          <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
        </div>

        <PrimaryButton
          isAccent
          label={isLoading ? 'Saving...' : '💾 Save Cloud Settings'}
          disabled={isLoading}
          onClick={handleSave}
        />

        {status && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 8, fontSize: 14,
            background: status.includes('❌') ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
            color: status.includes('❌') ? '#ef4444' : '#10b981',
          }}>
            {status}
          </div>
        )}
      </div>

      {/* License Info */}
      <div style={{ ...cardStyle, marginTop: 20 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>🔑 License & Activation</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
          License activation is managed through the initial setup wizard.
          To re-activate or transfer license, restart the application.
        </p>
      </div>

      {/* Change Master Password */}
      <div style={{ ...cardStyle, marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showChangePIN ? 20 : 0 }}>
          <div>
            <h3 style={{ margin: 0 }}>🔐 Master Password</h3>
            {!showChangePIN && <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '6px 0 0' }}>Change the Super Admin master password.</p>}
          </div>
          <button
            onClick={() => { setShowChangePIN(s => !s); setPinError(''); setPinSuccess(''); }}
            style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-color)',
              background: 'transparent', color: 'var(--text-color)', cursor: 'pointer', fontWeight: 600, fontSize: 13,
            }}
          >
            <Key size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            {showChangePIN ? 'Cancel' : 'Change Password'}
          </button>
        </div>

        {showChangePIN && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              {[
                { label: 'Current Password', val: currentPin, set: setCurrentPin },
                { label: 'New Password', val: newPin, set: setNewPin },
                { label: 'Confirm New Password', val: confirmPin, set: setConfirmPin },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label style={labelStyle}>{label}</label>
                  <input type="password" value={val} onChange={e => set(e.target.value)} style={inputStyle} placeholder="••••••" />
                </div>
              ))}
            </div>
            {pinError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{pinError}</div>}
            {pinSuccess && <div style={{ color: '#10b981', fontSize: 13, marginBottom: 12 }}>{pinSuccess}</div>}
            <button onClick={handleChangePIN} style={{
              padding: '9px 20px', borderRadius: 7, border: 'none',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13,
            }}>
              Update Password
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared Styles
// ─────────────────────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface-color)', padding: '24px',
  borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: 'var(--text-muted)',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 6,
  border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)',
  color: 'var(--text-color)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
