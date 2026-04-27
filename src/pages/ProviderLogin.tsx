import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProviderAuth } from '../context/ProviderAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Mail as MailIcon, ShieldAlert, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ProviderLogin: React.FC = () => {
  const { providerLogin, loading: authLoading } = useProviderAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (authLoading) return;
  }, [authLoading]);

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
      const result = await providerLogin(email, password);

      if (!result.success) {
        setError(result.error || 'Login failed. Provider access only.');
        return;
      }

      setSuccess('Access granted! Redirecting...');
      setTimeout(() => {
        navigate('/provider/dashboard');
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-slate-700 bg-slate-800/80 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-lg">
            <ShieldAlert size={32} className="text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">BioBridge Provider</CardTitle>
          <CardDescription className="text-sm text-slate-400">
            Software Provider Control Panel
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <div className="relative">
                <MailIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="provider@biobridge.com"
                  className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter provider password"
                  className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-sm font-medium">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-md text-sm font-medium">
                <CheckCircle2 size={16} />
                <span>{success}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base bg-amber-600 hover:bg-amber-700 text-white"
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Access Provider Panel'}
            </Button>

            <div className="text-center">
              <a href="/" className="text-sm text-slate-500 hover:text-slate-400 transition-colors">
                ← Back to Client Login
              </a>
            </div>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 text-center text-xs text-slate-500">
          <p>BioBridge Pro HR Provider Portal</p>
        </CardFooter>
      </Card>
    </div>
  );
};
