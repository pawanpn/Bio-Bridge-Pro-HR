import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
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
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

export const MainLayout: React.FC = () => {
  useShortcuts();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [calendarMode, setCalendarMode] = useState(localStorage.getItem('calendarMode') || 'BS');
  const [activeTab, setActiveTab] = useState('Overview');
  const [branches, setBranches] = useState<{id: number, name: string}[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | string>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [breadcrumbHistory, setBreadcrumbHistory] = useState<Array<{label: string, path: string}>>([]);

  // Define breadcrumb labels for each route
  const breadcrumbLabels: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/employees': 'Employees',
    '/employee-hierarchy': 'Employee Hierarchy',
    '/leave-management': 'Leave Management',
    '/attendance': 'Attendance',
    '/payroll': 'Payroll',
    '/finance': 'Finance & Accounts',
    '/reports': 'Reports',
    '/inventory': 'Inventory',
    '/projects': 'Projects',
    '/crm': 'CRM',
    '/assets': 'Assets',
    '/organization': 'Organization',
    '/device-settings': 'Device Settings',
    '/notifications': 'Notifications',
    '/system-settings': 'System Settings',
    '/permissions': 'Roles & Permissions',
    '/cloud-settings': 'Cloud Settings',
  };

  // Sync activeTab with current route
  useEffect(() => {
    const currentPath = location.pathname;
    const label = breadcrumbLabels[currentPath];
    if (label) {
      setActiveTab(label);

      // Update breadcrumb history - reset if it's a main menu item (clicking from sidebar)
      setBreadcrumbHistory(prev => {
        const lastItem = prev[prev.length - 1];
        if (lastItem?.path === currentPath) {
          return prev;
        }
        // If navigating to a main menu item, replace the whole history
        const isMainMenu = Object.values(breadcrumbLabels).includes(label);
        if (isMainMenu && prev.length > 0) {
          return [{ label, path: currentPath }];
        }
        return [...prev, { label, path: currentPath }];
      });
    }
  }, [location.pathname]);

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

  // Toggle sidebar visibility
  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible(prev => !prev);
  }, []);

  const go = useCallback((tab: string, path: string) => {
    setActiveTab(tab);
    // Reset breadcrumb to just the menu item when clicking from sidebar
    const label = breadcrumbLabels[path] || tab;
    setBreadcrumbHistory([{ label, path }]);
    navigate(path);
  }, [navigate]);

  // Navigate to a specific breadcrumb step
  const navigateToBreadcrumb = useCallback((path: string) => {
    navigate(path);
    // Remove breadcrumbs after the selected path
    setBreadcrumbHistory(prev => {
      const index = prev.findIndex(item => item.path === path);
      if (index !== -1) {
        return prev.slice(0, index + 1);
      }
      return prev;
    });
  }, [navigate]);

  // Go back one step in breadcrumb
  const goBack = useCallback(() => {
    setBreadcrumbHistory(prev => {
      if (prev.length <= 1) return prev;
      const newHistory = prev.slice(0, -1);
      const lastItem = newHistory[newHistory.length - 1];
      if (lastItem) {
        navigate(lastItem.path);
      }
      return newHistory;
    });
  }, [navigate]);

  // Go to first breadcrumb (Menu root)
  const goToHome = useCallback(() => {
    if (breadcrumbHistory.length > 1) {
      const firstItem = breadcrumbHistory[0];
      if (firstItem) {
        navigate(firstItem.path);
        setBreadcrumbHistory([firstItem]);
      }
    }
  }, [navigate, breadcrumbHistory]);

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

      {/* Sidebar - Pushes content on all screens */}
      <aside className={`
        fixed inset-y-0 left-0 z-50
        w-52 bg-sidebar text-sidebar-foreground flex flex-col shadow-xl
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen || isSidebarVisible ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Header - Fixed at Top */}
        <div className="flex-shrink-0 px-3 py-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate">{AppConfig.appName}</h1>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-white/60">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                <span className="truncate">{user?.username} ({user?.role})</span>
              </div>
            </div>
            {/* Close button - Works on all screens */}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsSidebarVisible(false);
              }}
              className="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
              title="Close Menu"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <nav className="py-1 space-y-0">
            <SidebarItem
              icon={<LayoutDashboard size={16} />}
              label="ERP Dashboard"
              active={activeTab === 'Overview'}
              onClick={() => go('Overview', '/dashboard')}
            />

            {/* HR Module Group */}
            <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              Human Resources
            </div>
            {!isOperator && (
              <SidebarItem
                icon={<Users size={16} />}
                label="Employees"
                active={activeTab === 'Employees'}
                onClick={() => go('Employees', '/employees')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<GitBranch size={16} />}
                label="Employee Hierarchy"
                active={activeTab === 'Hierarchy'}
                onClick={() => go('Hierarchy', '/employee-hierarchy')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<CalendarCheck size={16} />}
                label="Leave Management"
                active={activeTab === 'Leave'}
                onClick={() => go('Leave', '/leave-management')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<ClipboardCheck size={16} />}
                label="Attendance"
                active={activeTab === 'Attendance'}
                onClick={() => go('Attendance', '/attendance')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<DollarSign size={16} />}
                label="Payroll"
                active={activeTab === 'Payroll'}
                onClick={() => go('Payroll', '/payroll')}
              />
            )}

            {/* Finance Module Group */}
            <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              Finance
            </div>
            {!isOperator && (
              <SidebarItem
                icon={<TrendingUp size={16} />}
                label="Finance & Accounts"
                active={activeTab === 'Finance'}
                onClick={() => go('Finance', '/finance')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<FileText size={16} />}
                label="Reports"
                active={activeTab === 'Reports'}
                onClick={() => go('Reports', '/reports')}
              />
            )}

            {/* Operations Module Group */}
            <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              Operations
            </div>
            {!isOperator && (
              <SidebarItem
                icon={<Package size={16} />}
                label="Inventory"
                active={activeTab === 'Inventory'}
                onClick={() => go('Inventory', '/inventory')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<Briefcase size={16} />}
                label="Projects"
                active={activeTab === 'Projects'}
                onClick={() => go('Projects', '/projects')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<Users2 size={16} />}
                label="CRM"
                active={activeTab === 'CRM'}
                onClick={() => go('CRM', '/crm')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<Building2 size={16} />}
                label="Assets"
                active={activeTab === 'Assets'}
                onClick={() => go('Assets', '/assets')}
              />
            )}

            {/* Admin Module Group */}
            <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              Administration
            </div>
            {!isOperator && (
              <SidebarItem
                icon={<Monitor size={16} />}
                label="Organization"
                active={activeTab === 'Devices'}
                onClick={() => go('Devices', '/organization')}
              />
            )}
            {!isOperator && (
              <SidebarItem
                icon={<Shield size={16} />}
                label="Roles & Permissions"
                active={activeTab === 'Permissions'}
                onClick={() => go('Permissions', '/permissions')}
              />
            )}
            <SidebarItem
              icon={<Bell size={16} />}
              label="Notifications"
              active={activeTab === 'Notifications'}
              onClick={() => go('Notifications', '/notifications')}
            />
          </nav>
        </div>

        {/* Footer - Fixed at Bottom */}
        <div className="flex-shrink-0 py-1 border-t border-white/10 space-y-0">
          {!isOperator && (
            <SidebarItem
              icon={<Settings size={16} />}
              label="System Settings"
              active={activeTab === 'Settings'}
              onClick={() => go('Settings', '/system-settings')}
            />
          )}
          <SidebarItem
            icon={<LogOut size={16} />}
            label="Sign Out"
            active={false}
            onClick={handleLogout}
          />
        </div>
      </aside>

      {/* Main Area */}
      <div className={`flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300 ${(isMobileMenuOpen || isSidebarVisible) ? 'ml-52' : 'ml-0'}`}>
        {/* Top Header */}
        <header className="flex-shrink-0 h-16 bg-card shadow-sm flex items-center justify-between px-4 lg:px-6 space-x-2 lg:space-x-4">
          <div className="flex items-center gap-2 lg:gap-4 flex-shrink-0">
            {/* Sidebar Toggle Button - Always Visible */}
            <button
              onClick={toggleSidebar}
              className="p-2 rounded hover:bg-muted/50 transition-colors flex-shrink-0"
              title={isSidebarVisible ? "Hide Menu" : "Show Menu"}
            >
              {isSidebarVisible ? (
                <PanelLeftClose size={20} className="text-muted-foreground" />
              ) : (
                <PanelLeftOpen size={20} className="text-muted-foreground" />
              )}
            </button>

            {/* Breadcrumb Navigation */}
            <nav className="hidden md:flex items-center gap-1 text-sm overflow-hidden">
              {breadcrumbHistory.length > 0 && breadcrumbHistory.map((item, index) => {
                const isLast = index === breadcrumbHistory.length - 1;
                const isClickable = !isLast && breadcrumbHistory.length > 1;

                return (
                  <React.Fragment key={item.path}>
                    <button
                      onClick={() => isClickable && navigateToBreadcrumb(item.path)}
                      disabled={!isClickable}
                      className={`
                        px-2 py-1 rounded transition-colors flex-shrink-0
                        ${isLast 
                          ? 'font-semibold text-foreground cursor-default' 
                          : isClickable
                            ? 'hover:bg-muted/50 text-muted-foreground hover:text-foreground cursor-pointer'
                            : 'text-muted-foreground cursor-default'
                        }
                      `}
                      title={isClickable ? `Go to ${item.label}` : undefined}
                    >
                      {item.label}
                    </button>
                    {!isLast && (
                      <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}

              {/* Back Button - Only show when history > 1 */}
              {breadcrumbHistory.length > 1 && (
                <button
                  onClick={goBack}
                  className="ml-2 px-2 py-1 rounded bg-muted/50 hover:bg-muted text-xs transition-colors flex-shrink-0"
                  title="Go back"
                >
                  ← Back
                </button>
              )}
            </nav>
          </div>

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
    className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-all duration-200 text-xs ${
      active
        ? 'bg-primary/20 border-l-4 border-primary text-white'
        : 'text-white/70 hover:bg-white/5 hover:text-white'
    }`}
  >
    <span className="flex-shrink-0">{icon}</span>
    <span className={`truncate ${active ? 'font-semibold' : 'font-normal'}`}>{label}</span>
  </div>
);
