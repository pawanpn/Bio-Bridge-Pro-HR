import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { AppConfig } from '../config/appConfig';
import { SuperAdminGuard } from '../components/SuperAdminGuard';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Lock } from 'lucide-react';

interface CloudConfig {
  configured: boolean;
  clientEmail?: string;
  projectId?: string;
  rootFolderId?: string;
}

const statusDot = (color: string): React.CSSProperties => ({
  width: 10, height: 10, borderRadius: '50%', backgroundColor: color,
});

// Inner content — only shown when unlocked
const CloudSettingsContent: React.FC = () => {
  const { verifyPin } = useAdminAuth();
  const [config, setConfig] = useState<CloudConfig | null>(null);
  const [rootFolderId, setRootFolderId] = useState(AppConfig.defaultRootFolderId);
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [jsonText, setJsonText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-verify before save prompt
  const [verifyPrompt, setVerifyPrompt] = useState(false);
  const [verifyPin_, setVerifyPin_] = useState('');
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const data = await invoke<CloudConfig>('get_cloud_config');
      setConfig(data);
      if (data.configured && data.rootFolderId) setRootFolderId(data.rootFolderId);
    } catch (e) { setStatus('Failed to load cloud config: ' + e); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      JSON.parse(text);
      setJsonText(text);
      setStatus('✅ Key file loaded. Click "Save Cloud Settings" to apply.');
    } catch (err) { setStatus('❌ Invalid JSON: ' + err); }
  };

  const handleSaveRequest = () => {
    if (!jsonText && !config?.configured) {
      setStatus('❌ Please upload a Service Account JSON key first.');
      return;
    }
    // Require re-verification before saving sensitive data
    setVerifyPrompt(true);
    setVerifyPin_('');
    setVerifyError('');
  };

  const handleVerifyAndSave = async () => {
    const ok = await verifyPin(verifyPin_);
    if (!ok) { setVerifyError('Incorrect PIN. Changes not saved.'); return; }
    setVerifyPrompt(false);
    doSave();
  };

  const doSave = async () => {
    setIsLoading(true);
    setStatus('');
    try {
      await invoke('save_cloud_credentials', {
        jsonContent: jsonText || '',
        rootFolderId,
      });
      setStatus('✅ Cloud settings saved successfully!');
      loadConfig();
      setJsonText('');
    } catch (err) {
      setStatus('❌ Failed: ' + err);
    } finally { setIsLoading(false); }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', position: 'relative' }}>
      <h1>Cloud Settings</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Configure Google Drive Service Account and Target Folder ID.
      </p>

      {/* Connection Status */}
      <div style={cardStyle}>
        <h3 style={{ marginBottom: '16px' }}>Connection Status</h3>
        {config === null ? <p>Loading...</p> : config.configured ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={statusDot('#10b981')} />
              <span style={{ color: 'var(--success)', fontWeight: '600' }}>Configured</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <span style={labelStyle}>Service Account Email</span>
                <span style={valueStyle}>{config.clientEmail}</span>
              </div>
              <div>
                <span style={labelStyle}>Target Root Folder ID</span>
                <span style={valueStyle}>{config.rootFolderId}</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={statusDot('#ef4444')} />
            <span style={{ color: 'var(--error)', fontWeight: '600' }}>Not Configured</span>
          </div>
        )}
      </div>

      {/* Settings Form */}
      <div style={{ ...cardStyle, marginTop: '24px' }}>
        <h3 style={{ marginBottom: '20px' }}>Update Configuration</h3>

        <div style={{ marginBottom: '24px' }}>
          <span style={labelStyle}>Target Root Folder ID</span>
          <input type="text" value={rootFolderId} onChange={e => setRootFolderId(e.target.value)}
            style={inputStyle} placeholder="Enter Google Drive Folder ID" />
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Default: {AppConfig.defaultRootFolderId}
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <span style={labelStyle}>Service Account Key (JSON)</span>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <PrimaryButton label="Choose JSON Key File" onClick={() => fileInputRef.current?.click()} />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {jsonText ? '✅ Key loaded' : (config?.configured ? 'Existing key in use' : 'No key selected')}
            </span>
          </div>
          <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
        </div>

        {/* Save triggers re-verify */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PrimaryButton
            isAccent
            label={isLoading ? 'Saving...' : '🔐 Save Cloud Settings'}
            disabled={isLoading}
            onClick={handleSaveRequest}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Lock size={11} /> Master PIN required to save
          </span>
        </div>

        {status && (
          <div style={{
            marginTop: '16px', padding: '12px', borderRadius: '6px',
            backgroundColor: status.includes('❌') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            color: status.includes('❌') ? 'var(--error)' : 'var(--success)', fontSize: '14px',
          }}>
            {status}
          </div>
        )}
      </div>

      {/* Sharing Info */}
      <div style={{ ...cardStyle, marginTop: '24px' }}>
        <h3 style={{ marginBottom: '12px' }}>Permission Setup</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
          To allow "Bio Bridge Pro HR" to upload logs, share the target folder with the Service Account email.
        </p>
        <div style={{ padding: '12px', backgroundColor: 'var(--bg-color)', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
          <span style={labelStyle}>Invite this email as "Editor":</span>
          <code style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary-color)' }}>
            {config?.clientEmail || 'your-service-account@project.iam.gserviceaccount.com'}
          </code>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Target Email: <strong>pudasaini.pawan23@gmail.com</strong> (Owner)
        </p>
      </div>

      {/* Re-verify Modal */}
      {verifyPrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ ...cardStyle, width: 380, padding: 32 }}>
            <h3 style={{ margin: '0 0 8px' }}>🔐 Confirm Master PIN</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              Re-enter your Master PIN to confirm saving sensitive cloud credentials.
            </p>
            <input
              type="password"
              autoFocus
              value={verifyPin_}
              onChange={e => setVerifyPin_(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerifyAndSave()}
              placeholder="Enter Master PIN"
              style={{ ...inputStyle, marginBottom: 12, letterSpacing: '0.3em' }}
            />
            {verifyError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{verifyError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setVerifyPrompt(false)} style={cancelBtn}>Cancel</button>
              <button onClick={handleVerifyAndSave} style={confirmBtn}>Confirm & Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Public export: always wrapped in the guard
export const CloudSettings: React.FC = () => (
  <SuperAdminGuard>
    <CloudSettingsContent />
  </SuperAdminGuard>
);

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface-color)', padding: '24px', borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px',
  textTransform: 'uppercase', letterSpacing: '0.5px',
};
const valueStyle: React.CSSProperties = { display: 'block', fontSize: '14px', fontWeight: '600', wordBreak: 'break-all' };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '4px', border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};
const cancelBtn: React.CSSProperties = {
  flex: 1, padding: '10px', borderRadius: 6, border: '1px solid var(--border-color)',
  background: 'transparent', color: 'var(--text-color)', cursor: 'pointer', fontWeight: 600,
};
const confirmBtn: React.CSSProperties = {
  flex: 1, padding: '10px', borderRadius: 6, border: 'none',
  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', cursor: 'pointer', fontWeight: 700,
};
