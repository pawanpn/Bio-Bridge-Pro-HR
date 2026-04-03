import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';

export const SetupWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    authKey: '',
    companyName: '',
    address: '',
    contactInfo: '',
    licenseExpiry: '',
    defaultCalendar: 'BS',
    globalWeekend: 'Saturday',
  });

  const nextStep = () => setStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleVerify = async () => {
    try {
      // Step 2 logic: Pull license via Rust Drive simulation
      const expiry = await invoke<string>('get_license_info');
      setFormData({ ...formData, licenseExpiry: expiry });
      nextStep();
    } catch (e) {
      alert("Verification failed: " + e);
    }
  };

  const handleFinish = async () => {
    try {
      await invoke('save_company_info', {
        name: formData.companyName,
        address: formData.address,
        contact: formData.contactInfo,
        authKey: formData.authKey,
      });
      // Set to local storage so layout knows setup is complete
      localStorage.setItem('setupComplete', 'true');
      localStorage.setItem('calendarMode', formData.defaultCalendar);
      navigate('/dashboard');
    } catch (e) {
      alert("Failed to save setup: " + e);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2>Bio Bridge Pro HR - Setup</h2>
          <div style={{ color: 'var(--text-muted)' }}>Step {step} of 4</div>
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-color)', marginBottom: '24px' }}>
          <div style={{ width: `${(step / 4) * 100}%`, height: '100%', backgroundColor: 'var(--accent-color)' }} />
        </div>

        {step === 1 && (
          <div>
            <h3>Enterprise Registration</h3>
            <input 
              placeholder="Authorization Key" 
              value={formData.authKey} 
              onChange={e => setFormData({ ...formData, authKey: e.target.value})} 
            />
            <input 
              placeholder="Company Name" 
              value={formData.companyName} 
              onChange={e => setFormData({ ...formData, companyName: e.target.value})} 
            />
            <input 
              placeholder="Address" 
              value={formData.address} 
              onChange={e => setFormData({ ...formData, address: e.target.value})} 
            />
            <input 
              placeholder="Contact Info" 
              value={formData.contactInfo} 
              onChange={e => setFormData({ ...formData, contactInfo: e.target.value})} 
            />
            <button className="accent" onClick={handleVerify} style={{ marginTop: '16px', width: '100%' }}>Verify License & Next</button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3>Verification Successful</h3>
            <p>Your license from Google Drive has been validated.</p>
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-color)', borderRadius: '8px', margin: '16px 0' }}>
               Expiry Date: <strong>{formData.licenseExpiry}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={prevStep}>Back</button>
              <button className="accent" onClick={nextStep}>Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3>Multi-Branch Configuration</h3>
            <p>Define your primary branch. Sub-branches can be added later via Settings.</p>
            <input value="Head Office" disabled />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
              <button onClick={prevStep}>Back</button>
              <button className="accent" onClick={nextStep}>Next</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3>Localization Preferences</h3>
            <label style={{ display: 'block', margin: '16px 0 8px' }}>Default Calendar System</label>
            <select 
               value={formData.defaultCalendar} 
               onChange={e => setFormData({...formData, defaultCalendar: e.target.value})}
            >
              <option value="BS">Bikram Sambat (BS)</option>
              <option value="AD">English Date (AD)</option>
            </select>
            
            <label style={{ display: 'block', margin: '16px 0 8px' }}>Global Weekend</label>
            <select 
               value={formData.globalWeekend} 
               onChange={e => setFormData({...formData, globalWeekend: e.target.value})}
            >
              <option value="Saturday">Saturday</option>
              <option value="Sunday">Sunday</option>
            </select>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <button onClick={prevStep}>Back</button>
              <button className="accent" onClick={handleFinish}>Complete Setup</button>
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
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  modal: {
    backgroundColor: 'var(--surface-color)',
    padding: '32px', borderRadius: '12px',
    width: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '24px'
  }
};
