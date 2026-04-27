import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';

interface LicenseExpiredProps {
  reason?: string;
}

export const LicenseExpired: React.FC<LicenseExpiredProps> = ({ reason }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-xl border-slate-800 bg-slate-900 text-white shadow-2xl">
        <CardHeader>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
            <AlertTriangle size={30} />
          </div>
          <CardTitle className="text-2xl">License Expired</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-slate-300">
          <p>
            Your organization has been marked inactive by the provider, or the license period has expired.
          </p>
          <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
            {reason || 'Access is blocked until the provider reactivates the organization.'}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={() => navigate(0)}
              className="flex items-center gap-2 bg-amber-500 text-slate-950 hover:bg-amber-400"
            >
              <RefreshCw size={16} />
              Retry
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={logout}
              className="flex items-center gap-2 border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              <LogOut size={16} />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

