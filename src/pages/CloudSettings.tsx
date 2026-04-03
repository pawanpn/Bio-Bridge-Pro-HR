import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PrimaryButton } from '../components/common/PrimaryButton';

interface CloudConfig {
  configured: boolean;
  clientEmail?: string;
  projectId?: string;
}

const statusDot = (color: string): React.CSSProperties => ({
  width: 10,
  height: 10,
  borderRadius: '50%',
  backgroundColor: color,
});

export const CloudSettings: React.FC = () => {
  const [config, setConfig] = useState<CloudConfig | null>(null);
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await invoke<CloudConfig>('get_cloud_config');
      setConfig(data);
    } catch (e) {
      setStatus('Failed to load cloud config: ' + e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatus('');

    try {
      const text = await file.text();
      JSON.parse(text);
      await invoke('save_cloud_credentials', { jsonContent: text });
      setStatus('✅ Service Account credentials saved successfully!');
      loadConfig();
    } catch (err) {
      setStatus('❌ Failed: ' + err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '700px' }}>
      <h1>Cloud Settings</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Configure your Google Drive Service Account for automatic cloud synchronization.
      </p>

      {/* Connection Status */}
      <div style={cardStyle}>
        <h3 style={{ marginBottom: '16px' }}>Connection Status</h3>
        {config === null ? (
          <p>Loading...</p>
        ) : config.configured ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={statusDot('#10b981')} />
              <span style={{ color: 'var(--success)', fontWeight: '600' }}>Connected</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <span style={labelStyle}>Service Account Email</span>
                <span style={valueStyle}>{config.clientEmail}</span>
              </div>
              <div>
                <span style={labelStyle}>GCP Project ID</span>
                <span style={valueStyle}>{config.projectId}</span>
              </div>
            </div>
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--bg-color)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <strong>Drive Path:</strong> Bio Bridge Pro HR → [Organization] → [Branch] → [Year] → [Month] → logs.json
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={statusDot('#ef4444')} />
            <span style={{ color: 'var(--error)', fontWeight: '600' }}>Not Configured</span>
          </div>
        )}
      </div>

      {/* Upload Section */}
      <div style={{ ...cardStyle, marginTop: '24px' }}>
        <h3 style={{ marginBottom: '8px' }}>
          {config?.configured ? 'Update' : 'Upload'} Service Account Key
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
          Upload the JSON key file downloaded from Google Cloud Console.
          The private key is stored securely in the local database and never leaves this device.
        </p>

        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        <PrimaryButton
          isAccent
          label={isLoading ? 'Uploading...' : 'Choose JSON Key File'}
          disabled={isLoading}
          onClick={() => fileInputRef.current?.click()}
        />

        {status && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: status.startsWith('✅') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: status.startsWith('✅') ? 'var(--success)' : 'var(--error)',
            fontSize: '14px'
          }}>
            {status}
          </div>
        )}
      </div>

      {/* Setup Guide */}
      <div style={{ ...cardStyle, marginTop: '24px' }}>
        <h3 style={{ marginBottom: '12px' }}>Setup Guide</h3>
        <ol style={{ paddingLeft: '20px', color: 'var(--text-muted)', lineHeight: '2' }}>
          <li>Create a folder named <strong>Bio Bridge Pro HR</strong> in your Google Drive.</li>
          <li>Copy the Service Account email shown above.</li>
          <li>Right-click the folder → <strong>Share</strong> → paste the email → set <strong>Editor</strong> permission.</li>
          <li>Uncheck "Notify people" and click Share.</li>
          <li>The app will now automatically create sub-folders and upload logs during every sync.</li>
        </ol>
      </div>
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface-color)',
  padding: '24px',
  borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: 'var(--text-muted)',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const valueStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: '600',
  wordBreak: 'break-all',
};
