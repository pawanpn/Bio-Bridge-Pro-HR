import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Mail as MailIcon, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AppConfig } from '../config/appConfig';
import { type PortalType, getPortalLabel } from '@/config/portalPolicy';

interface LoginProps {
  portal?: PortalType;
  embedded?: boolean;
}

export const Login: React.FC<LoginProps> = ({ portal, embedded = false }) => {
  const { login, changePassword, resetPassword, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isChangingPass, setIsChangingPass] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [rememberMe, setRememberMe] = useState(localStorage.getItem('rememberMe') === 'true');

  React.useEffect(() => {
    if (localStorage.getItem('rememberMe') === 'true') {
        const storedEmail = localStorage.getItem('saved_email');
        const storedPass = localStorage.getItem('saved_password');
        if (storedEmail) setEmail(storedEmail);
        if (storedPass) setPassword(storedPass);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await login(email, password, portal);

      if (!result.success) {
        setError(result.error || 'Login failed. Please check your credentials.');
        return;
      }

      if (rememberMe) {
          localStorage.setItem('saved_email', email);
          localStorage.setItem('saved_password', password);
          localStorage.setItem('rememberMe', 'true');
      } else {
          localStorage.removeItem('saved_email');
          localStorage.removeItem('saved_password');
          localStorage.setItem('rememberMe', 'false');
      }

      setSuccess('Login successful! Redirecting...');
      // AuthContext handles navigation automatically
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearSaved = () => {
    localStorage.removeItem('saved_email');
    localStorage.removeItem('saved_password');
    localStorage.setItem('rememberMe', 'false');
    setRememberMe(false);
    setEmail('');
    setPassword('');
    setError('');
    setSuccess('Saved credentials cleared.');
    setTimeout(() => setSuccess(''), 3000);
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
    setSuccess('');
    try {
      await changePassword(newPassword);
      setSuccess('Password updated successfully!');
    } catch (err: any) {
      setError(err.toString() || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={embedded ? 'w-full' : 'min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4'}>
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
            <ShieldCheck size={32} className="text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">{AppConfig.appName}</CardTitle>
          <CardDescription className="text-sm">
            {portal ? `${getPortalLabel(portal)} access` : 'Enterprise Attendance & HR Management'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isResetting ? (
            <form onSubmit={async (e) => {
              e.preventDefault();
              if(!email) return setError("Please enter your Email or Employee ID");
              setLoading(true); setError(''); setSuccess('');
              const res = await resetPassword(email);
              setLoading(false);
              if(res.success) {
                 setSuccess("Password reset link sent! Check your email.");
              } else {
                 setError(res.error || "Failed context reset");
              }
            }} className="space-y-5">
               <div className="space-y-2">
                 <Label htmlFor="reset-email">Email or Employee ID</Label>
                 <div className="relative">
                   <MailIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                   <Input id="reset-email" type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email or BB-0001" className="pl-10" autoFocus />
                 </div>
               </div>
               {error && <div className="p-3 bg-red-100 text-red-600 rounded-md text-sm">{error}</div>}
               {success && <div className="p-3 bg-green-100 text-green-600 rounded-md text-sm">{success}</div>}
               <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                 {loading ? 'Sending...' : 'Send Reset Link'}
               </Button>
               <Button type="button" variant="ghost" onClick={() => { setIsResetting(false); setError(''); setSuccess(''); }} className="w-full">
                 Back to Login
               </Button>
            </form>
          ) : !isChangingPass ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email or Employee ID</Label>
                <div className="relative">
                  <MailIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@biobridge.com or BB-0001"
                    className="pl-10"
                    autoFocus={!email}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 cursor-pointer rounded"
                  />
                  <span>Save Credentials</span>
                </label>
                {(localStorage.getItem('saved_username') || localStorage.getItem('saved_email')) && (
                  <button
                    type="button"
                    onClick={clearSaved}
                    className="text-xs text-destructive hover:text-destructive/80 font-semibold transition-colors"
                  >
                    Clear Saved
                  </button>
                )}
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setIsResetting(true); setError(''); setSuccess(''); }}
                  className="text-sm font-medium text-primary hover:underline transition-colors"
                >
                   Forgot Password?
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm font-medium">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-md text-sm font-medium">
                  <CheckCircle2 size={16} />
                  <span>{success}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-5">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-primary">Update Password</h3>
                <p className="text-sm text-muted-foreground">
                  First time login: Please set a new secure password.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pl-10"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="pl-10"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm font-medium">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-md text-sm font-medium">
                  <CheckCircle2 size={16} />
                  <span>{success}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={loading}
              >
                {loading ? 'Updating Password...' : 'Update & Sign In'}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 text-center text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {portal === 'provider' ? (
                <>Provider: <span className="font-semibold ml-1">master_admin</span> / <span className="font-semibold ml-1">masterpassword</span></>
              ) : portal === 'admin' ? (
                <>Client: <span className="font-semibold ml-1">client_hr</span> / <span className="font-semibold ml-1">clientpassword</span></>
              ) : (
                <>Default: <span className="font-semibold ml-1">admin</span> / <span className="font-semibold ml-1">admin123</span></>
              )}
            </Badge>
          </div>
          <p>© 2026 Bio Bridge Pro HR. All rights reserved.</p>
        </CardFooter>
      </Card>
    </div>
  );
};
