import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { Lock, User as UserIcon, ShieldCheck } from 'lucide-react';
import { AppConfig } from '../config/appConfig';

export const Login: React.FC = () => {
  const { login, changePassword } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [rememberMe, setRememberMe] = useState(localStorage.getItem('rememberMe') === 'true');

  React.useEffect(() => {
    if (localStorage.getItem('rememberMe') === 'true') {
        const storedUser = localStorage.getItem('saved_username');
        const storedPass = localStorage.getItem('saved_password');
        if (storedUser) setUsername(storedUser);
        if (storedPass) setPassword(storedPass);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { mustChange } = await login(username, password);

      if (rememberMe) {
          localStorage.setItem('saved_username', username);
          localStorage.setItem('saved_password', password);
          localStorage.setItem('rememberMe', 'true');
      } else {
          localStorage.removeItem('saved_username');
          localStorage.removeItem('saved_password');
          localStorage.setItem('rememberMe', 'false');
      }

      if (mustChange) {
        setIsChangingPass(true);
      }
    } catch (err: any) {
      setError(err.toString() || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const clearSaved = () => {
    localStorage.removeItem('saved_username');
    localStorage.removeItem('saved_password');
    localStorage.setItem('rememberMe', 'false');
    setRememberMe(false);
    setUsername('');
    setPassword('');
    setError('Saved credentials cleared.');
    setTimeout(() => setError(''), 3000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await changePassword(newPassword);
    } catch (err: any) {
      setError(err.toString() || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={loginCardStyle}>
        <div style={headerStyle}>
          <div style={logoCircleStyle}>
             <ShieldCheck size={32} color="white" />
          </div>
          <h1 style={{ margin: '16px 0 8px', fontSize: '24px' }}>{AppConfig.appName}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Enterprise Attendance & HR Management</p>
        </div>

        {!isChangingPass ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Username</label>
              <div style={inputContainerStyle}>
                <UserIcon size={18} style={iconStyle} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  style={inputStyle}
                  autoFocus={!username}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <div style={inputContainerStyle}>
                <Lock size={18} style={iconStyle} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input 
                        type="checkbox" 
                        checked={rememberMe} 
                        onChange={(e) => setRememberMe(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    Save Credentials
                </label>
                {(localStorage.getItem('saved_username')) && (
                    <span 
                        onClick={clearSaved}
                        style={{ fontSize: '12px', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
                    >
                        Clear Saved
                    </span>
                )}
            </div>

            {error && <div style={errorStyle}>{error}</div>}

            <div style={{ marginTop: '10px' }}>
              <PrimaryButton 
                label={loading ? 'Authenticating...' : 'Sign In'} 
                disabled={loading} 
                isAccent
                style={{ width: '100%', height: '48px', fontSize: '16px' }}
              />
            </div>
          </form>
        ) : (
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>Update Password</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  First time login: Please set a new secure password.
                </p>
             </div>
             
             <div>
              <label style={labelStyle}>New Password</label>
              <div style={inputContainerStyle}>
                <Lock size={18} style={iconStyle} />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  style={inputStyle}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Confirm New Password</label>
              <div style={inputContainerStyle}>
                <Lock size={18} style={iconStyle} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  style={inputStyle}
                />
              </div>
            </div>

            {error && <div style={errorStyle}>{error}</div>}

            <div style={{ marginTop: '10px' }}>
              <PrimaryButton 
                label={loading ? 'Updating Password...' : 'Update & Sign In'} 
                disabled={loading} 
                isAccent
                style={{ width: '100%', height: '48px', fontSize: '16px' }}
              />
            </div>
          </form>
        )}

        <div style={footerStyle}>
          <p>Default credentials: <b>admin</b> / <b>admin123</b></p>
          <p>© 2026 Bio Bridge Pro HR. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100vh',
  width: '100vw',
  backgroundColor: 'var(--bg-color)',
  background: 'linear-gradient(135deg,rgba(79, 70, 229, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%)',
};

const loginCardStyle: React.CSSProperties = {
  padding: '48px',
  width: '100%',
  maxWidth: '420px',
  backgroundColor: 'var(--surface-color)',
  borderRadius: '16px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.1), 0 20px 48px rgba(0,0,0,0.05)',
  border: '1px solid var(--border-color)',
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '32px',
};

const logoCircleStyle: React.CSSProperties = {
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: '600',
  color: 'var(--text-color)',
  marginBottom: '8px',
};

const inputContainerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const iconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '12px',
  color: 'var(--text-muted)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 12px 12px 40px',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-color)',
  color: 'var(--text-color)',
  fontSize: '15px',
  outline: 'none',
  transition: 'border-color 0.2s',
};

const errorStyle: React.CSSProperties = {
  padding: '10px 14px',
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  color: '#ef4444',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: '500',
};

const footerStyle: React.CSSProperties = {
  marginTop: '32px',
  textAlign: 'center',
  fontSize: '12px',
  color: 'var(--text-muted)',
};
