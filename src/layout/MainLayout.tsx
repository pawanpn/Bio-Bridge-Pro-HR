import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AttendanceConsole } from '../components/AttendanceConsole';
import { useShortcuts } from '../hooks/useShortcuts';
import { AppConfig } from '../config/appConfig';
import { Calendar, Search, LayoutDashboard, Monitor, FileText, Settings } from 'lucide-react';

export const MainLayout: React.FC = () => {
  useShortcuts();
  const navigate = useNavigate();
  const [calendarMode, setCalendarMode] = useState(localStorage.getItem('calendarMode') || 'BS');
  const [activeTab, setActiveTab] = useState('Overview');

  const toggleCalendar = () => {
    const nextMode = calendarMode === 'BS' ? 'AD' : 'BS';
    setCalendarMode(nextMode);
    localStorage.setItem('calendarMode', nextMode);
  };

  const go = (tab: string, path: string) => {
    setActiveTab(tab);
    navigate(path);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {/* Sidebar */}
      <div style={{ width: '250px', backgroundColor: 'var(--sidebar-bg)', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', fontSize: '20px', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {AppConfig.appName}
        </div>

        <div style={{ flex: 1, padding: '16px 0' }}>
          <SidebarItem icon={<LayoutDashboard size={18} />} label="Dashboard Overview" active={activeTab === 'Overview'} onClick={() => go('Overview', '/dashboard')} />
          <SidebarItem icon={<Monitor size={18} />} label="Device Management" active={activeTab === 'Devices'} onClick={() => go('Devices', '/device-settings')} />
          <SidebarItem icon={<FileText size={18} />} label="Reports" active={activeTab === 'Reports'} onClick={() => go('Reports', '/reports')} />
        </div>

        {/* System Settings at bottom — contains Master Settings inside */}
        <div style={{ padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <SidebarItem
            icon={<Settings size={18} />}
            label="System Settings"
            active={activeTab === 'Settings'}
            onClick={() => go('Settings', '/system-settings')}
          />
        </div>
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Top Header */}
        <div style={{ height: '70px', backgroundColor: 'var(--surface-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-color)', padding: '8px 12px', borderRadius: '4px', width: '300px' }}>
            <Search size={18} color="var(--text-muted)" style={{ marginRight: '8px' }} />
            <input placeholder="Quick search employees or branches..." style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', marginBottom: 0, padding: 0 }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <select style={{ marginBottom: 0, padding: '8px', minWidth: '150px' }}>
              <option>Head Office</option>
              <option>Kathmandu Branch</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={toggleCalendar}>
              <Calendar size={20} color="var(--primary-color)" />
              <span style={{ fontWeight: '500' }}>{calendarMode} Mode</span>
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
      backgroundColor: active ? 'var(--primary-light)' : 'transparent',
      transition: 'background-color 0.2s',
      color: active ? 'white' : 'var(--text-muted)',
    }}
  >
    {icon}
    <span>{label}</span>
  </div>
);
