import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProviderAuth } from '../context/ProviderAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, ShieldAlert, AlertCircle, CheckCircle2, User, Info, Eye, EyeOff } from 'lucide-react';

export const ProviderLogin: React.FC = () => {
  const { providerLogin } = useProviderAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoutReason, setLogoutReason] = useState('');
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    const reason = localStorage.getItem('biobridge_provider_logout_reason');
    if (reason) {
      setLogoutReason(reason);
      localStorage.removeItem('biobridge_provider_logout_reason');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) { setError('PIN is required'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const result = await providerLogin(username || 'provider', pin);
      if (!result.success) { setError(result.error || 'Invalid credentials'); return; }
      setSuccess('Access granted!');
      setTimeout(() => navigate('/provider/dashboard'), 400);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-slate-700 bg-slate-800/80 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-lg">
            <ShieldAlert size={32} className="text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">Provider Portal</CardTitle>
          <CardDescription className="text-sm text-slate-400">
            Sign in with your provider credentials
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300">Username</Label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input id="username" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Provider username" autoFocus className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin" className="text-slate-300">PIN</Label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input id="pin" type={showPin ? "text" : "password"} value={pin} onChange={e => setPin(e.target.value)}
                  placeholder="Enter PIN" className="pl-10 pr-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 text-lg tracking-widest" />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {logoutReason && <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-md text-sm"><Info size={16} />{logoutReason}</div>}
            {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-sm"><AlertCircle size={16} />{error}</div>}
            {success && <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-md text-sm"><CheckCircle2 size={16} />{success}</div>}

            <Button type="submit" className="w-full h-12 text-base bg-amber-600 hover:bg-amber-700 text-white" disabled={loading}>
              {loading ? 'Verifying...' : 'Sign In'}
            </Button>

            <div className="text-center space-y-1">
              <p className="text-xs text-slate-500">Default: <code className="text-amber-400 bg-slate-700 px-1 rounded">provider</code> / <code className="text-amber-400 bg-slate-700 px-1 rounded">provider123</code></p>
              <a href="/" className="text-sm text-slate-500 hover:text-slate-400 transition-colors">← Back to Client Login</a>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3 text-center text-xs text-slate-500">
          <p>BioBridge Pro HR Provider Portal v2.0</p>
        </CardFooter>
      </Card>
    </div>
  );
};
