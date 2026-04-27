import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, CalendarCheck2, Clock3, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AppConfig } from '@/config/appConfig';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors',
    isActive ? 'bg-teal-500 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ');

export const StaffLayout: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-slate-200 bg-white px-4 py-4 lg:w-72 lg:border-b-0 lg:border-r">
          <Link to="/staff/dashboard" className="block">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-600">Staff Portal</div>
            <div className="text-xl font-bold">{AppConfig.appName}</div>
          </Link>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-medium text-slate-900">{user?.full_name || user?.username || 'Staff'}</div>
            <div className="mt-1">{user?.email}</div>
          </div>
          <nav className="mt-6 space-y-2">
            <NavLink to="/staff/dashboard" className={linkClass}>
              <LayoutDashboard size={18} />
              Dashboard
            </NavLink>
            <NavLink to="/staff/attendance" className={linkClass}>
              <Clock3 size={18} />
              Attendance
            </NavLink>
            <NavLink to="/staff/leaves" className={linkClass}>
              <CalendarCheck2 size={18} />
              Leave
            </NavLink>
          </nav>
          <button
            type="button"
            onClick={logout}
            className="mt-6 flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </aside>
        <main className="flex-1">
          <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Staff Portal</div>
                <div className="text-lg font-semibold text-slate-900">Mobile and web self-service</div>
              </div>
              <div className="text-sm text-slate-500">{user?.role}</div>
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

