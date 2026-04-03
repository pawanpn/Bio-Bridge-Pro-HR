import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { AppConfig } from '../config/appConfig';
import { PrimaryButton } from './common/PrimaryButton';
import { StandardInput } from './common/StandardInput';

export const SetupWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    authKey: '',
    companyName: '',
    address: '',
    contactInfo: '',
    licenseExpiry: '',
    defaultCalendar: 'BS',
    globalWeekend: 'Saturday',
    rootFolderId: AppConfig.defaultRootFolderId,
    serviceAccountEmail: '',
    jsonKeyText: '',
    hardwareId: 'Loading...',
  });

  const nextStep = () => setStep((s) => Math.min(s + 1, 5));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const fetchHardwareId = async () => {
    try {
      const id = await invoke<string>('get_hardware_id');
      setFormData(prev => ({ ...prev, hardwareId: id }));
    } catch (e) {
      console.error("Failed to fetch Hardware ID", e);
    }
  };

  React.useEffect(() => {
    fetchHardwareId();
  }, []);

  const handleVerify = async () => {
    if (!formData.jsonKeyText) {
      alert("Please upload your Service Account JSON key first.");
      return;
    }
    try {
      const expiry = await invoke<string>('activate_license_key', {
        key: formData.authKey,
        jsonKey: formData.jsonKeyText
      });
      setFormData({ ...formData, licenseExpiry: expiry });
      nextStep();
    } catch (e) {
      alert("Activation failed: " + e);
    }
  };

  const handleAdminGenerate = async () => {
    if (!formData.jsonKeyText) {
       alert("Upload JSON first to use Admin Tool.");
       return;
    }
    try {
      const keys = await invoke<string[]>('admin_generate_keys', {
        count: 5,
        expiry: '2027-12-31',
        jsonKey: formData.jsonKeyText
      });
      alert("Successfully generated 5 keys on Drive:\n\n" + keys.join('\n'));
    } catch (e) {
      alert("Admin failed: " + e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.client_email) {
        setFormData({ 
          ...formData, 
          serviceAccountEmail: parsed.client_email,
          jsonKeyText: text
        });
      } else {
        alert("Invalid JSON: 'client_email' not found.");
      }
    } catch (err) {
      alert("Failed to read JSON file: " + err);
    }
  };

  const handleFinish = async () => {
    try {
      // 1. Save Company Info
      await invoke('save_company_info', {
        name: formData.companyName,
        address: formData.address,
        contact: formData.contactInfo,
        authKey: formData.authKey,
      });

      // 2. Save Cloud Credentials (if key provided)
      if (formData.jsonKeyText) {
        await invoke('save_cloud_credentials', {
           jsonContent: formData.jsonKeyText,
           rootFolderId: formData.rootFolderId
        });
      }

      // 3. Mark setup complete
      localStorage.setItem('setupComplete', 'true');
      localStorage.setItem('calendarMode', formData.defaultCalendar);
      navigate('/dashboard');
    } catch (e) {
      alert("Failed to finalize setup: " + e);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={{ margin: 0 }}>{AppConfig.appName}</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Step {step} of 5</div>
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-color)', margin: '12px 0 24px' }}>
          <div style={{ width: `${(step / 5) * 100}%`, height: '100%', backgroundColor: 'var(--accent-color)', transition: 'width 0.3s ease' }} />
        </div>

         {step === 1 && (
          <div>
            <h3>Software Activation</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Upload your cloud credentials and enter your license key to activate.
            </p>
            
            <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: 'var(--bg-color)', borderRadius: '6px', border: '1px dashed var(--border-color)' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Computer ID</span>
              <code style={{ display: 'block', fontSize: '12px', wordBreak: 'break-all', marginTop: '4px' }}>{formData.hardwareId}</code>
            </div>

            <label style={styles.label}>1. Cloud Credentials (.json)</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <PrimaryButton label="Choose JSON Key" onClick={() => fileInputRef.current?.click()} />
              <input type="file" accept=".json" ref={fileInputRef} hidden onChange={handleFileUpload} />
              <span style={{ fontSize: '12px' }}>{formData.jsonKeyText ? '✅ Loaded' : '❌ Not Loaded'}</span>
            </div>

            <label style={styles.label}>2. License Key</label>
            <StandardInput placeholder="BIO-XXXX-XXXX-XXXX" value={formData.authKey} onChange={e => setFormData({ ...formData, authKey: e.target.value})} />
            
            <PrimaryButton isAccent style={{ marginTop: '24px', width: '100%' }} onClick={handleVerify} label="Activate License" />
            
            <button 
              onClick={handleAdminGenerate}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', marginTop: '12px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              [Admin] Generate 5 Stock Keys on Drive
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3>Verification Successful</h3>
            <p>Your license from Google Drive has been validated.</p>
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-color)', borderRadius: '8px', margin: '16px 0' }}>
               Expiry Date: <strong style={{ color: 'var(--success)' }}>{formData.licenseExpiry}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <PrimaryButton onClick={prevStep} label="Back" />
              <PrimaryButton isAccent onClick={nextStep} label="Next" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3>Multi-Branch Setup</h3>
            <p>Define your primary branch. Sub-branches can be added later via Settings.</p>
            <StandardInput value="Head Office" disabled />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <PrimaryButton onClick={prevStep} label="Back" />
              <PrimaryButton isAccent onClick={nextStep} label="Next" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3>Localization</h3>
            <label style={styles.label}>Default Calendar System</label>
            <select style={styles.select} value={formData.defaultCalendar} onChange={e => setFormData({...formData, defaultCalendar: e.target.value})}>
              <option value="BS">Bikram Sambat (BS)</option>
              <option value="AD">English Date (AD)</option>
            </select>
            
            <label style={styles.label}>Global Weekend</label>
            <select style={styles.select} value={formData.globalWeekend} onChange={e => setFormData({...formData, globalWeekend: e.target.value})}>
              <option value="Saturday">Saturday</option>
              <option value="Sunday">Sunday</option>
            </select>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <PrimaryButton onClick={prevStep} label="Back" />
              <PrimaryButton isAccent onClick={nextStep} label="Next" />
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h3>Cloud Sync Setup</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Configure Google Drive to automatically push employee attendance logs.
            </p>

            {formData.serviceAccountEmail && (
              <div style={{ padding: '12px', backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: '6px', marginBottom: '24px', border: '1px solid var(--success)' }}>
                <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Drive Sync Status</span>
                <p style={{ margin: 0, fontSize: '13px' }}>✅ Credentials verified during activation.</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <PrimaryButton onClick={prevStep} label="Back" />
              <PrimaryButton isAccent onClick={handleFinish} label="Complete Setup" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'var(--primary-dark)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  },
  modal: {
    backgroundColor: 'var(--surface-color)',
    padding: '32px', borderRadius: '12px',
    width: '550px', boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '8px'
  },
  label: { display: 'block', margin: '16px 0 8px', fontSize: '13px', color: 'var(--text-muted)' },
  select: { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }
};
