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
  CalendarCheck,
  Bell,
  ClipboardCheck,
  DollarSign,
  Users,
  Shield,
  GitBranch,
  Package,
  Briefcase,
  Users2,
  Building2,
  TrendingUp,
  X
} from 'lucide-react';

export const MainLayout: React.FC = () => {
  useShortcuts();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [calendarMode, setCalendarMode] = useState(localStorage.getItem('calendarMode') || 'BS');
  const [activeTab, setActiveTab] = useState('Overview');
  const [branches, setBranches] = useState<{id: number, name: string}[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | string>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    invoke<any[]>('list_branches').then(setBranches).catch(console.error);

    // Set initial branch if user is branch-locked
    if (user?.branch_id) {
      setSelectedBranch(user.branch_id);
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
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Fixed on Desktop, Drawer on Mobile */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50
        w-64 bg-sidebar text-sidebar-foreground flex flex-col shadow-xl
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Sidebar Header - Fixed at Top */}
        <div className="flex-shrink-0 px-4 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">{AppConfig.appName}</h1>
              <div className="flex items-center gap-2 mt-1 text-xs text-white/60">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="truncate max-w-[150px]">{user?.username} ({user?.role})</span>
              </div>
            </div>
            {/* Close button for mobile */}
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-1 rounded hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <nav className="py-2 space-y-0.5">
            <SidebarItem
              icon={<LayoutDashboard size={18} />}
              label="ERP Dashboard"
              active={activeTab === 'Overview'}
              onClick={() => go('Overview', '/dashboard')}
            />
            
            {/* HR Module Group */}
            <div className="px-4 pt-3 pb-1 text-xs font-semibold text-white/40 uppercase tracking-wider">
              Human Resources
            </div>
            {!isOperator && (
              <SidebarItem
                icon={<Users size={18} />}
                label="Employees"
                active={activeTab === 'Employees'}
                onClick={() => go('Employees', '/employees')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<GitBranch size={18} />}
                label="Employee Hierarchy"
                active={activeTab === 'Hierarchy'}
                onClick={() => go('Hierarchy', '/employee-hierarchy')}
              />
            )}
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
                icon={<ClipboardCheck size={18} />}
                label="Attendance"
                active={activeTab === 'Attendance'}
                onClick={() => go('Attendance', '/attendance')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<DollarSign size={18} />}
                label="Payroll"
                active={activeTab === 'Payroll'}
                onClick={() => go('Payroll', '/payroll')}
              />
            )}
            
            {/* Finance Module Group */}
            <div className="px-4 pt-3 pb-1 text-xs font-semibold text-white/40 uppercase tracking-wider">
              Finance
            </div>
            {!isOperator && (
              <SidebarItem
                icon={<TrendingUp size={18} />}
                label="Finance & Accounts"
                active={activeTab === 'Finance'}
                onClick={() => go('Finance', '/finance')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<FileText size={18} />}
                label="Reports"
                active={activeTab === 'Reports'}
                onClick={() => go('Reports', '/reports')}
              />
            )}
            
            {/* Operations Module Group */}
            <div className="px-4 pt-3 pb-1 text-xs font-semibold text-white/40 uppercase tracking-wider">
              Operations
            </div>
            {!isOperator && (
              <SidebarItem
                icon={<Package size={18} />}
                label="Inventory"
                active={activeTab === 'Inventory'}
                onClick={() => go('Inventory', '/inventory')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<Briefcase size={18} />}
                label="Projects"
                active={activeTab === 'Projects'}
                onClick={() => go('Projects', '/projects')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<Users2 size={18} />}
                label="CRM"
                active={activeTab === 'CRM'}
                onClick={() => go('CRM', '/crm')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<Building2 size={18} />}
                label="Assets"
                active={activeTab === 'Assets'}
                onClick={() => go('Assets', '/assets')}
              />
            )}
            
            {/* Admin Module Group */}
            <div className="px-4 pt-3 pb-1 text-xs font-semibold text-white/40 uppercase tracking-wider">
              Administration
            </div>
            {!isOperator && (
              <SidebarItem
                icon={<Monitor size={18} />}
                label="Organization"
                active={activeTab === 'Devices'}
                onClick={() => go('Devices', '/organization')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<Shield size={18} />}
                label="Roles & Permissions"
                active={activeTab === 'Permissions'}
                onClick={() => go('Permissions', '/permissions')}
              />
            )}
            <SidebarItem
              icon={<Bell size={18} />}
              label="Notifications"
              active={activeTab === 'Notifications'}
              onClick={() => go('Notifications', '/notifications')}
            />
          </nav>
        </div>

        {/* Footer - Fixed at Bottom */}
        <div className="flex-shrink-0 py-2 border-t border-white/10 space-y-0.5">
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="flex-shrink-0 h-16 bg-card shadow-sm flex items-center justify-between px-4 lg:px-6 space-x-2 lg:space-x-4">
          {/* Mobile Menu Button */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded hover:bg-muted/50"
          >
            <Search size={20} className="rotate-90 lg:rotate-0" />
          </button>

          <div className="relative flex-1 max-w-xs lg:max-w-sm">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-10 bg-muted/50 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 lg:gap-4 flex-shrink-0">
            {/* Branch Selector */}
            <select
              value={selectedBranch}
              disabled={!!user?.branch_id}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="hidden md:block h-9 px-2 rounded-md border border-input bg-background text-xs lg:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="flex items-center gap-1 lg:gap-2 h-9 px-2 lg:px-3 text-xs"
            >
              <Calendar size={16} className="text-primary" />
              <span className="hidden sm:inline font-medium">{calendarMode} Mode</span>
            </Button>

            <Avatar className="h-7 w-7 lg:h-8 lg:w-8 bg-primary text-primary-foreground">
              <AvatarFallback className="text-xs">
                <UserIcon size={16} />
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page Content - Scrollable */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/20 p-3 sm:p-4 lg:p-6">
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
    className={`flex items-center gap-2 lg:gap-3 px-4 py-2.5 cursor-pointer transition-all duration-200 text-sm ${
      active
        ? 'bg-primary/20 border-l-4 border-primary text-white'
        : 'text-white/70 hover:bg-white/5 hover:text-white'
    }`}
  >
    <span className="flex-shrink-0">{icon}</span>
    <span className={`truncate ${active ? 'font-semibold' : 'font-normal'}`}>{label}</span>
  </div>
);
