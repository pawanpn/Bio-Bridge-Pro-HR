import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { AttendanceConsole } from '../components/AttendanceConsole';
import { useShortcuts } from '../hooks/useShortcuts';
import { useAuth } from '../context/AuthContext';
import { AppConfig } from '../config/appConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Calendar, 
  Search, 
  LayoutDashboard, 
  Monitor, 
  FileText, 
  Settings, 
  LogOut, 
  User as UserIcon, 
  CalendarCheck 
} from 'lucide-react';

export const MainLayout: React.FC = () => {
  useShortcuts();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [calendarMode, setCalendarMode] = useState(localStorage.getItem('calendarMode') || 'BS');
  const [activeTab, setActiveTab] = useState('Overview');
  const [branches, setBranches] = useState<{id: number, name: string}[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | string>('all');

  useEffect(() => {
    invoke<any[]>('list_branches').then(setBranches).catch(console.error);

    // Set initial branch if user is branch-locked
    if (user?.branchId) {
      setSelectedBranch(user.branchId);
    }
  }, [user]);

  const toggleCalendar = () => {
    const nextMode = calendarMode === 'BS' ? 'AD' : 'BS';
    setCalendarMode(nextMode);
    localStorage.setItem('calendarMode', nextMode);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const go = (tab: string, path: string) => {
    setActiveTab(tab);
    navigate(path);
  };

  const isOperator = user?.role === 'OPERATOR';

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar-bg text-white flex flex-col shadow-xl">
        <div className="px-6 py-6 border-b border-white/10">
          <h1 className="text-lg font-bold">{AppConfig.appName}</h1>
          <div className="flex items-center gap-2 mt-2 text-xs text-white/60">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>{user?.username} ({user?.role})</span>
          </div>
        </div>

        <nav className="flex-1 py-4 space-y-1">
          <SidebarItem 
            icon={<LayoutDashboard size={18} />} 
            label="Dashboard Overview" 
            active={activeTab === 'Overview'} 
            onClick={() => go('Overview', '/dashboard')} 
          />
          {!isOperator && (
            <SidebarItem 
              icon={<CalendarCheck size={18} />} 
              label="Leave Management" 
              active={activeTab === 'Leave'} 
              onClick={() => go('Leave', '/leave-management')} 
            />
          )}
          {!isOperator && (
            <SidebarItem 
              icon={<Monitor size={18} />} 
              label="Device Management" 
              active={activeTab === 'Devices'} 
              onClick={() => go('Devices', '/device-settings')} 
            />
          )}
          <SidebarItem 
            icon={<FileText size={18} />} 
            label="Reports" 
            active={activeTab === 'Reports'} 
            onClick={() => go('Reports', '/reports')} 
          />
        </nav>

        <div className="py-4 border-t border-white/10 space-y-1">
          {!isOperator && (
            <SidebarItem
              icon={<Settings size={18} />}
              label="System Settings"
              active={activeTab === 'Settings'}
              onClick={() => go('Settings', '/system-settings')}
            />
          )}
          <SidebarItem
            icon={<LogOut size={18} />}
            label="Sign Out"
            active={false}
            onClick={handleLogout}
          />
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-card shadow-sm flex items-center justify-between px-6 space-x-4">
          <div className="relative w-72">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              className="pl-10 bg-muted/50" 
            />
          </div>

          <div className="flex items-center gap-6">
            {/* Branch Selector - Locked for Branch Admins/Operators */}
            <select
              value={selectedBranch}
              disabled={!!user?.branchId}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="h-10 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="all">Global (All Branches)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleCalendar}
              className="flex items-center gap-2"
            >
              <Calendar size={20} className="text-primary" />
              <span className="font-medium">{calendarMode} Mode</span>
            </Button>

            <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
              <AvatarFallback>
                <UserIcon size={18} />
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-muted/20 p-6">
          <Outlet />
        </main>

        <AttendanceConsole />
      </div>
    </div>
  );
};

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

const SidebarItem = ({ icon, label, active, onClick }: SidebarItemProps) => (
  <div
    onClick={onClick}
    className={`flex items-center gap-3 px-6 py-3 cursor-pointer transition-all duration-200 ${
      active 
        ? 'bg-primary/20 border-l-4 border-primary text-white' 
        : 'text-white/70 hover:bg-white/5 hover:text-white'
    }`}
  >
    {icon}
    <span className={`text-sm ${active ? 'font-semibold' : 'font-normal'}`}>{label}</span>
  </div>
);
