import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProviderAuth } from '../context/ProviderAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';

export const ProviderSetup: React.FC = () => {
  const { setProviderPin, providerLogin } = useProviderAuth();
  const navigate = useNavigate();
  const [currentPin, setCurrentPin] = useState('provider123');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPin.length < 6) {
      setError('PIN must be at least 6 characters');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setLoading(true);
    setError('');

    const result = await setProviderPin(currentPin, newPin);
    if (result.success) {
      setSuccess('PIN updated! Login with your new PIN.');
      setTimeout(() => navigate('/provider/login'), 1500);
    } else {
      setError(result.error || 'Failed to update PIN');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardHeader className="text-center">
          <Lock size={48} className="mx-auto text-amber-500 mb-3" />
          <CardTitle className="text-white">Provider PIN Setup</CardTitle>
          <CardDescription className="text-slate-400">
            Change your provider access PIN. Default is <code className="text-amber-400">provider123</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetPin} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Current PIN</Label>
              <Input
                type="password"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="Default: provider123"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">New PIN (min 6 chars)</Label>
              <Input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="Enter new PIN"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Confirm New PIN</Label>
              <Input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="Re-enter new PIN"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-md text-sm">
                <CheckCircle2 size={16} />
                {success}
              </div>
            )}

            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={loading}>
              {loading ? 'Updating...' : 'Update PIN'}
            </Button>

            <Button type="button" variant="ghost" className="w-full text-slate-400" onClick={() => navigate('/provider/login')}>
              Back to Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
