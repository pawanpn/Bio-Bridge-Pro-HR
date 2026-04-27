import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const ProviderSetup: React.FC = () => {
  const [step, setStep] = useState<'check' | 'register' | 'done' | 'error'>('check');
  const [email, setEmail] = useState('provider@biobridge.com');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('provider');
  const [fullName, setFullName] = useState('System Provider');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [existingProviders, setExistingProviders] = useState<any[]>([]);

  useEffect(() => {
    checkExistingProviders();
  }, []);

  const checkExistingProviders = async () => {
    try {
      const { data } = await supabase.from('users').select('*').eq('role', 'PROVIDER');
      setExistingProviders(data || []);
      if (data && data.length > 0) {
        setStep('done');
      } else {
        setStep('register');
      }
    } catch (err) {
      setStep('register');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Try signing up first
      let userId: string | null = null;
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      });

      if (signUpError && !signUpError.message.includes('already registered')) {
        throw new Error(`Auth error: ${signUpError.message}`);
      }

      if (signUpData?.user) {
        userId = signUpData.user.id;
      } else {
        // Try signing in (user already exists)
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          throw new Error(`Sign in failed: ${signInError.message}. Check email confirmation in Supabase Dashboard.`);
        }
        userId = signInData.user?.id || null;
      }

      if (!userId) {
        throw new Error('Could not get user ID');
      }

      const { error: insertError } = await supabase.from('users').insert({
        auth_id: userId,
        username,
        email,
        full_name: fullName,
        role: 'PROVIDER',
        is_active: true,
        must_change_password: false
      });

      if (insertError) {
        throw new Error(`Profile insert failed: ${insertError.message}`);
      }

      setSuccess('Provider account created successfully!');
      setStep('done');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-amber-400" />
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <CheckCircle2 size={48} className="mx-auto text-green-400 mb-3" />
            <CardTitle className="text-white">Provider Setup Complete</CardTitle>
            <CardDescription className="text-slate-400">
              Your provider account is ready. Go to the login page to access the control panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {existingProviders.map((p: any, i: number) => (
              <div key={i} className="p-3 bg-slate-700/50 rounded-md text-sm text-slate-300">
                <strong>{p.full_name}</strong> ({p.email}) — {p.role}
              </div>
            ))}
            <div className="flex gap-3">
              <Button
                onClick={() => { window.location.href = '/provider/login'; }}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                Go to Provider Login
              </Button>
              <Button
                variant="outline"
                onClick={() => { window.location.href = '/'; }}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Client Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardHeader className="text-center">
          <ShieldAlert size={48} className="mx-auto text-amber-500 mb-3" />
          <CardTitle className="text-white">First-Time Provider Setup</CardTitle>
          <CardDescription className="text-slate-400">
            Create the initial provider account to manage client organizations.
            If the auth user already exists, use the same password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password (min 6 chars)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-slate-300">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-sm">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Create Provider Account
            </Button>
          </form>

          <p className="mt-4 text-xs text-slate-500 text-center">
            If you get RLS errors, run CREATE_PROVIDER_USER.sql in Supabase SQL Editor,
            or disable email confirmation in Supabase Auth settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
