import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Building2, Shield, LogOut, Users2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AppConfig } from '@/config/appConfig';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors',
    isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
  ].join(' ');

export const ProviderLayout: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-white/10 bg-slate-900/95 px-4 py-4 lg:w-72 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <Link to="/provider/dashboard" className="block">
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Provider</div>
              <div className="text-xl font-bold">{AppConfig.appName}</div>
            </Link>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            <div className="font-medium text-white">{user?.full_name || user?.username || 'Provider'}</div>
            <div className="mt-1">{user?.email}</div>
          </div>
          <nav className="mt-6 space-y-2">
            <NavLink to="/provider/dashboard" className={linkClass}>
              <LayoutDashboard size={18} />
              Dashboard
            </NavLink>
            <NavLink to="/provider/organizations" className={linkClass}>
              <Building2 size={18} />
              Organizations
            </NavLink>
            <NavLink to="/provider/roles" className={linkClass}>
              <Shield size={18} />
              Permissions
            </NavLink>
          </nav>
          <button
            type="button"
            onClick={logout}
            className="mt-6 flex w-full items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </aside>
        <main className="flex-1 bg-slate-50 text-slate-900">
          <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Provider Portal</div>
                <div className="text-lg font-semibold text-slate-900">Global control and licensing</div>
              </div>
              <div className="text-sm text-slate-500">Role: {user?.role}</div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

