import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { AppConfig } from '../config/appConfig';

interface CloudConfig {
  configured: boolean;
  clientEmail?: string;
  projectId?: string;
  rootFolderId?: string;
}

const statusDot = (color: string): React.CSSProperties => ({
  width: 10,
  height: 10,
  borderRadius: '50%',
  backgroundColor: color,
});

export const CloudSettings: React.FC = () => {
  const [config, setConfig] = useState<CloudConfig | null>(null);
  const [rootFolderId, setRootFolderId] = useState(AppConfig.defaultRootFolderId);
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [jsonText, setJsonText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await invoke<CloudConfig>('get_cloud_config');
      setConfig(data);
      if (data.configured && data.rootFolderId) {
        setRootFolderId(data.rootFolderId);
      }
    } catch (e) {
      setStatus('Failed to load cloud config: ' + e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      // Just parse to validate
      JSON.parse(text);
      setJsonText(text);
      setStatus('✅ Key file loaded. Click "Save Cloud Settings" to apply.');
    } catch (err) {
      setStatus('❌ Invalid JSON: ' + err);
    }
  };

  const handleSave = async () => {
    if (!jsonText && !config?.configured) {
      setStatus('❌ Please upload a Service Account JSON key first.');
      return;
    }

    setIsLoading(true);
    setStatus('');

    try {
      // If we already have a config and haven't uploaded a NEW JSON, 
      // we might need a way to only update the root ID. 
      // For now, the user must provide the JSON again if they want to change root ID 
      // OR we implement a separate update_root_id command.
      // But the requirement implies saving them together.
      
      await invoke('save_cloud_credentials', { 
        jsonContent: jsonText || "", // This is a bit tricky if only updating ID.
        rootFolderId: rootFolderId 
      });
      
      setStatus('✅ Cloud settings saved successfully!');
      loadConfig();
      setJsonText('');
    } catch (err) {
      setStatus('❌ Failed: ' + err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px' }}>
      <h1>Cloud Settings</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Configure Google Drive Service Account and Target Folder ID.
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
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
          <input 
            type="text" 
            value={rootFolderId} 
            onChange={(e) => setRootFolderId(e.target.value)}
            style={inputStyle}
            placeholder="Enter Google Drive Folder ID"
          />
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Default: {AppConfig.defaultRootFolderId}
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <span style={labelStyle}>Service Account Key (JSON)</span>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <PrimaryButton
              label="Choose JSON Key File"
              onClick={() => fileInputRef.current?.click()}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {jsonText ? '✅ Key loaded' : (config?.configured ? 'Existing key in use' : 'No key selected')}
            </span>
          </div>
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        </div>

        <PrimaryButton
          isAccent
          label={isLoading ? 'Saving...' : 'Save Cloud Settings'}
          disabled={isLoading}
          onClick={handleSave}
        />

        {status && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: status.includes('❌') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            color: status.includes('❌') ? 'var(--error)' : 'var(--success)',
            fontSize: '14px'
          }}>
            {status}
          </div>
        )}
      </div>

      {/* Sharing Info */}
      <div style={{ ...cardStyle, marginTop: '24px' }}>
        <h3 style={{ marginBottom: '12px' }}>Permission Setup</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
          To allow "Bio Bridge Pro HR" to upload logs, you must share the target folder with the Service Account email.
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
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const valueStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: '600',
  wordBreak: 'break-all',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '4px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-color)',
  color: 'var(--text-color)',
  fontSize: '14px',
  outline: 'none',
};
