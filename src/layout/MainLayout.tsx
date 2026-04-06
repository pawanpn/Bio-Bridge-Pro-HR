import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { AttendanceConsole } from '../components/AttendanceConsole';
import { useShortcuts } from '../hooks/useShortcuts';
import { useAuth } from '../context/AuthContext';
import { AppConfig } from '../config/appConfig';
import { Calendar, Search, LayoutDashboard, Monitor, FileText, Settings, LogOut, User as UserIcon } from 'lucide-react';

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
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {/* Sidebar */}
      <div style={{ width: '250px', backgroundColor: 'var(--sidebar-bg)', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{AppConfig.appName}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
             <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
             {user?.username} ({user?.role})
          </div>
        </div>

        <div style={{ flex: 1, padding: '16px 0' }}>
          <SidebarItem icon={<LayoutDashboard size={18} />} label="Dashboard Overview" active={activeTab === 'Overview'} onClick={() => go('Overview', '/dashboard')} />
          {!isOperator && (
            <SidebarItem icon={<Monitor size={18} />} label="Device Management" active={activeTab === 'Devices'} onClick={() => go('Devices', '/device-settings')} />
          )}
          <SidebarItem icon={<FileText size={18} />} label="Reports" active={activeTab === 'Reports'} onClick={() => go('Reports', '/reports')} />
        </div>

        <div style={{ padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
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
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Top Header */}
        <div style={{ height: '70px', backgroundColor: 'var(--surface-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-color)', padding: '8px 12px', borderRadius: '4px', width: '300px' }}>
            <Search size={18} color="var(--text-muted)" style={{ marginRight: '8px' }} />
            <input placeholder="Search..." style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', marginBottom: 0, padding: 0 }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* Branch Selector - Locked for Branch Admins/Operators */}
            <select 
              value={selectedBranch} 
              disabled={!!user?.branchId}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ marginBottom: 0, padding: '8px', minWidth: '150px' }}
            >
              <option value="all">Global (All Branches)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={toggleCalendar}>
              <Calendar size={20} color="var(--primary-color)" />
              <span style={{ fontWeight: '500' }}>{calendarMode} Mode</span>
            </div>
            
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
               <UserIcon size={18} />
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </div>

        <AttendanceConsole />
      </div>
    </div>
  );
};

const SidebarItem = ({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) => (
  <div
    onClick={onClick}
    style={{
      padding: '12px 24px',
      display: 'flex', alignItems: 'center', gap: '12px',
      cursor: 'pointer',
      backgroundColor: active ? 'rgba(79, 70, 229, 0.15)' : 'transparent',
      borderLeft: active ? '4px solid #4f46e5' : '4px solid transparent',
      transition: 'all 0.2s',
      color: active ? 'white' : 'rgba(255,255,255,0.7)',
    }}
  >
    {icon}
    <span style={{ fontSize: '14px', fontWeight: active ? '600' : '400' }}>{label}</span>
  </div>
);
