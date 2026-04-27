import React from 'react';
import { AlertTriangle, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

interface OrganizationPendingApprovalProps {
  reason?: string;
}

export const OrganizationPendingApproval: React.FC<OrganizationPendingApprovalProps> = ({ reason }) => {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4 text-white">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
          <AlertTriangle size={28} />
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">Approval Required</p>
        <h1 className="mt-2 text-3xl font-bold">Client organization is waiting for provider approval</h1>
        <p className="mt-4 max-w-prose text-sm leading-6 text-slate-300">
          {reason || 'Your organization has been created, but the provider has not approved access yet. The HR portal stays locked until that approval is completed.'}
        </p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div className="flex items-center gap-3 text-sm text-slate-200">
            <ShieldCheck size={18} className="text-emerald-300" />
            <span>After approval, the client desktop app will unlock HR, attendance, gate, and employee features.</span>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-white text-slate-950 hover:bg-slate-200"
          >
            <RefreshCw size={16} />
            Recheck Approval
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={logout}
            className="border-white/20 bg-transparent text-white hover:bg-white/10"
          >
            <LogOut size={16} />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
};
