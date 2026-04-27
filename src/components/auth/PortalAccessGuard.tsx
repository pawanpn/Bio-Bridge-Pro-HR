import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getPortalForRole, type PortalType } from '@/config/portalPolicy';
import { isSuperAdmin } from '@/config/accessPolicy';
import { Button } from '@/components/ui/button';

interface PortalAccessGuardProps {
  allowedPortals: PortalType | PortalType[];
  children: React.ReactNode;
}

export const PortalAccessGuard: React.FC<PortalAccessGuardProps> = ({ allowedPortals, children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isSuperAdmin(user?.role)) {
    return <>{children}</>;
  }

  const portals = Array.isArray(allowedPortals) ? allowedPortals : [allowedPortals];
  const currentPortal = getPortalForRole(user?.role);
  const isAllowed = portals.includes(currentPortal);

  const requestedPortal = location.pathname.split('/')[1] as PortalType | '';
  const isPortalPath = requestedPortal === 'provider' || requestedPortal === 'admin' || requestedPortal === 'staff';

  if (isPortalPath && !isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
            <Lock size={28} />
          </div>
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="mt-3 text-sm text-slate-300">
            Your account is linked to the <strong>{currentPortal}</strong> portal. The URL you opened belongs to a
            different portal, so access is blocked.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={() => navigate(`/${currentPortal}/dashboard`, { replace: true })}
              className="bg-white text-slate-950 hover:bg-slate-200"
            >
              Go to my portal
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
  }

  return <>{children}</>;
};

