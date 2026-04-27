import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useProviderAuth } from '../context/ProviderAuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LayoutDashboard,
  Building2,
  Users,
  Activity,
  DollarSign,
  MessageSquare,
  ShieldAlert,
  LogOut,
  User as UserIcon,
  Menu,
  X,
} from 'lucide-react';

export const ProviderLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { providerUser, providerLogout } = useProviderAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await providerLogout();
    navigate('/provider/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { icon: <LayoutDashboard size={18} />, label: 'Dashboard', path: '/provider/dashboard' },
    { icon: <Building2 size={18} />, label: 'Organizations', path: '/provider/organizations' },
    { icon: <Users size={18} />, label: 'Client Users', path: '/provider/users' },
    { icon: <DollarSign size={18} />, label: 'Billing', path: '/provider/billing' },
    { icon: <MessageSquare size={18} />, label: 'Support CRM', path: '/provider/crm' },
    { icon: <Activity size={18} />, label: 'Monitoring', path: '/provider/monitoring' },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-56 bg-slate-800 border-r border-slate-700 flex flex-col
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-amber-400 truncate">BioBridge Provider</h1>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                <span className="truncate">{providerUser?.email}</span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded hover:bg-slate-700 transition-colors"
            >
              <X size={14} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 overflow-y-auto">
          <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Provider Controls
          </div>
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200 text-left ${
                isActive(item.path)
                  ? 'bg-amber-500/10 border-l-3 border-amber-500 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 py-2 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300 ${sidebarOpen ? 'ml-56' : 'ml-0'}`}>
        {/* Header */}
        <header className="flex-shrink-0 h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded hover:bg-slate-700 transition-colors"
            >
              <Menu size={18} className="text-slate-400" />
            </button>
            <span className="text-sm font-medium text-slate-300">
              Provider Control Panel
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ShieldAlert size={16} className="text-amber-500" />
            <span className="text-xs text-slate-400 hidden sm:inline">Provider Mode</span>
            <Avatar className="h-7 w-7 bg-amber-600 text-white">
              <AvatarFallback className="text-xs">
                <UserIcon size={14} />
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-900 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};
