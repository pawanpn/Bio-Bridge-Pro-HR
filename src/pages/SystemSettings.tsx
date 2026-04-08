import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { AppConfig } from '../config/appConfig';
import { Shield, Lock, Eye, EyeOff, Settings, Key, Users as UsersIcon, UserPlus, UserCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EmployeeProfileSidebar } from '../components/EmployeeProfileSidebar';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface CloudConfig {
  configured: boolean;
  clientEmail?: string;
  projectId?: string;
  rootFolderId?: string;
}

type Tab = 'general' | 'directory' | 'master' | 'users';

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export const SystemSettings: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
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
          label="Employee Directory"
          icon={<UsersIcon size={15} />}
          active={activeTab === 'directory'}
          onClick={() => handleTabChange('directory')}
        />
        <TabButton
          label="Master Settings"
          icon={<Shield size={15} />}
          active={activeTab === 'master'}
          locked={!masterUnlocked}
          onClick={() => handleTabChange('master')}
        />
        {isSuperAdmin && (
          <TabButton
            label="User Management"
            icon={<Shield size={15} />}
            active={activeTab === 'users'}
            onClick={() => handleTabChange('users')}
          />
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'general' && <GeneralSettings />}
      {activeTab === 'directory' && <EmployeeDirectory />}
      {activeTab === 'users' && <UserManagement />}
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
            <Button onClick={() => fileInputRef.current?.click()}>📂 Choose JSON File</Button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {jsonText ? '✅ New key loaded' : config?.configured ? 'Existing key active' : 'No key selected'}
            </span>
          </div>
          <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
        </div>

        <Button variant="accent" onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Saving...' : '💾 Save Cloud Settings'}
        </Button>

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
// Employee Directory (Modify Auto-Discovered Staff)
// ─────────────────────────────────────────────────────────────────────────────
const EmployeeDirectory: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const emps = await invoke<any[]>('list_employees');
      const brs = await invoke<any[]>('list_branches');
      setEmployees(emps);
      setBranches(brs);
    } catch (e) { console.error(e); }
  };

  const handleUpdate = async () => {
    if (!editingEmp) return;
    try {
      await invoke('update_employee', { 
        id: editingEmp.id, 
        name: editingEmp.name, 
        department: editingEmp.department || '', 
        branchId: editingEmp.branch_id || 1 
      });
      setStatus('✅ Profile updated!');
      setTimeout(() => setStatus(''), 2000);
      setEditingEmp(null);
      loadData();
    } catch (e) { setStatus('❌ ' + e); }
  };

  return (
    <div>
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>Staff Directory</h3>
        
        {employees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
             <p>No employees found. Start syncing devices to discover staff.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-muted)' }}>BIO ID</th>
                <th style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-muted)' }}>NAME</th>
                <th style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-muted)' }}>DEPARTMENT</th>
                <th style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-muted)' }}>BRANCH</th>
                <th style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-muted)' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} style={{ borderBottom: '1px solid var(--bg-color)' }}>
                  <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>#{emp.id}</td>
                  <td style={{ padding: '12px 8px', fontWeight: 600 }}>{emp.name}</td>
                  <td style={{ padding: '12px 8px', fontSize: 13 }}>{emp.department || '—'}</td>
                  <td style={{ padding: '12px 8px', fontSize: 13 }}>
                    {branches.find(b => b.id === emp.branch_id)?.name || 'Default'}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button 
                          onClick={() => setViewingProfile(emp)}
                          style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--primary-color)', background: 'var(--primary-color)', color: 'white', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <UserCircle size={14} /> Profile
                        </button>
                        <button 
                          onClick={() => setEditingEmp(emp)}
                          style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-color)', cursor: 'pointer', fontSize: 12 }}
                        >
                          Edit
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingEmp && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', width: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0 }}>Edit Employee #{editingEmp.id}</h3>
            
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Full Name</label>
              <input 
                value={editingEmp.name} 
                onChange={e => setEditingEmp({...editingEmp, name: e.target.value})} 
                style={inputStyle} 
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Department</label>
              <input 
                value={editingEmp.department || ''} 
                onChange={e => setEditingEmp({...editingEmp, department: e.target.value})} 
                style={inputStyle} 
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Branch</label>
              <select 
                value={editingEmp.branch_id || ''} 
                onChange={e => setEditingEmp({...editingEmp, branch_id: Number(e.target.value)})} 
                style={inputStyle}
              >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {status && <p style={{ color: 'var(--success)', fontSize: 13, marginBottom: 12 }}>{status}</p>}

            <div style={{ display: 'flex', gap: 12 }}>
              <Button variant="accent" onClick={handleUpdate}>Save Changes</Button>
              <button onClick={() => setEditingEmp(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>Discard</button>
            </div>
          </div>
        </div>
      )}

      {viewingProfile && (
        <EmployeeProfileSidebar 
          employee={viewingProfile} 
          onClose={() => setViewingProfile(null)} 
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// User Management
// ─────────────────────────────────────────────────────────────────────────────
const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // New/Edit User Form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ADMIN');
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branchAccess, setBranchAccess] = useState<number[]>([]);

  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
    loadBranches();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await invoke<any[]>('list_users');
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadBranches = async () => {
    try {
      const data = await invoke<any[]>('list_branches');
      setBranches(data);
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setRole('ADMIN');
    setBranchId(null);
    setBranchAccess([]);
    setEditingUser(null);
    setShowAddForm(false);
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setUsername(user.username);
    setPassword('');
    setRole(user.role);
    setBranchId(user.branchId);
    setBranchAccess(user.branchAccess?.map((b: any) => b.id) || []);
    setShowAddForm(true);
  };

  const handleAddUser = async () => {
    if (!username || (!editingUser && !password)) {
      setStatus('❌ Username and Password are required.');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      if (editingUser) {
        await invoke('update_user', {
          id: editingUser.id,
          username,
          role,
          branchId: role === 'SUPER_ADMIN' ? null : branchId,
          branchIds: role === 'SUPER_ADMIN' ? [] : branchAccess,
          isActive: editingUser.isActive
        });
        setStatus('✅ User updated successfully!');
      } else {
        await invoke('add_user', {
          username,
          password,
          role,
          branchId: role === 'SUPER_ADMIN' ? null : branchId,
          branchIds: role === 'SUPER_ADMIN' ? [] : branchAccess
        });
        setStatus('✅ User created successfully!');
      }
      resetForm();
      loadUsers();
    } catch (e) {
      setStatus('❌ ' + e);
    }
    setLoading(false);
  };

  const handleResetPassword = async (user: any) => {
    const newPass = prompt(`Enter new password for ${user.username}:`);
    if (!newPass) return;
    try {
      await invoke('reset_user_password', { id: user.id, newPassword: newPass });
      alert('✅ Password reset successfully!');
    } catch (e) {
      alert('❌ Error: ' + e);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await invoke('delete_user', { id });
      loadUsers();
    } catch (e) {
      alert('Error deleting user: ' + e);
    }
  };

  const toggleBranchAccess = (branchId: number) => {
    setBranchAccess(prev =>
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0 }}>Active Users</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
            borderRadius: 8, border: 'none', background: 'var(--primary-color)', color: 'white', cursor: 'pointer', fontWeight: 600
          }}
        >
          {showAddForm ? 'Cancel' : <><UserPlus size={16} /> Add User</>}
        </button>
      </div>

      {showAddForm && (
        <div style={{ ...cardStyle, marginBottom: 24, border: '1px dashed var(--primary-color)' }}>
          <h4 style={{ marginTop: 0, marginBottom: 16 }}>
            {editingUser ? 'Edit User' : 'Create New User'}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} placeholder="john_doe" />
            </div>
            {!editingUser && (
              <div>
                <label style={labelStyle}>Temporary Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="••••••" />
              </div>
            )}
            <div>
              <label style={labelStyle}>Access Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
                <option value="SUPER_ADMIN">Super Admin (Full Access)</option>
                <option value="ADMIN">Admin (Branch Limited)</option>
                <option value="OPERATOR">Operator (Read Only/Branch)</option>
              </select>
            </div>
            {role !== 'SUPER_ADMIN' && (
              <div>
                <label style={labelStyle}>Primary Branch</label>
                <select value={branchId || ''} onChange={e => setBranchId(e.target.value ? Number(e.target.value) : null)} style={inputStyle}>
                  <option value="">Select Primary Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {role !== 'SUPER_ADMIN' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Branch Access (Multi-Select)</label>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Select which branches this user can access data from
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {branches.map(branch => (
                  <button
                    key={branch.id}
                    onClick={() => toggleBranchAccess(branch.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: branchAccess.includes(branch.id) ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                      background: branchAccess.includes(branch.id) ? 'var(--primary-color)' : 'transparent',
                      color: branchAccess.includes(branch.id) ? 'white' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    {branchAccess.includes(branch.id) ? '✓ ' : ''}{branch.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {status && <p style={{ color: status.includes('❌') ? 'var(--error)' : 'var(--success)', fontSize: 13, marginBottom: 12 }}>{status}</p>}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleAddUser}
              disabled={loading}
              style={{
                padding: '9px 20px', borderRadius: 7, border: 'none',
                background: 'var(--primary-color)', color: 'white', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14,
              }}
            >
              {loading ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
            </button>
            <button onClick={resetForm} style={{ border: '1px solid var(--border-color)', background: 'transparent', padding: '9px 20px', borderRadius: 7, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* User List */}
      <div style={cardStyle}>
        {users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No users found. Create your first user above.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-muted)' }}>USERNAME</th>
                <th style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-muted)' }}>ROLE</th>
                <th style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-muted)' }}>BRANCH ACCESS</th>
                <th style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-muted)' }}>STATUS</th>
                <th style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-muted)' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--bg-color)' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 600 }}>{user.username}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      background: user.role === 'SUPER_ADMIN' ? 'rgba(99,102,241,0.1)' : user.role === 'ADMIN' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                      color: user.role === 'SUPER_ADMIN' ? '#6366f1' : user.role === 'ADMIN' ? '#10b981' : '#f59e0b',
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: 12 }}>
                    {user.role === 'SUPER_ADMIN' ? (
                      <span style={{ color: 'var(--text-muted)' }}>All Branches</span>
                    ) : user.branchAccess?.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {user.branchAccess.map((b: any) => (
                          <span key={b.id} style={{ padding: '2px 6px', borderRadius: 3, background: 'var(--bg-color)', fontSize: 11 }}>
                            {b.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Primary Only</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: user.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      color: user.isActive ? '#10b981' : '#ef4444',
                    }}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleEditUser(user)}
                        style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: 12 }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleResetPassword(user)}
                        style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: 12 }}
                      >
                        🔑 Reset Pass
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
