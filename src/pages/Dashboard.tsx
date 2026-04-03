import React, { useEffect, useState } from 'react';
import { AnalyticalCard } from '../components/AnalyticalCard';
import { DeviceScanner } from '../components/DeviceScanner';
import { invoke } from '@tauri-apps/api/core';
import { Users, UserCheck, AlertTriangle, UserMinus } from 'lucide-react';

interface Stats {
  totalStaff: number;
  presentToday: number;
  onLeave: number;
  absent: number;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    invoke<Stats>('get_dashboard_stats').then(setStats);
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <h1>Dashboard Overview</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Real-time statistics for Head Office</p>
      
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
          <AnalyticalCard title="Total Staff" value={stats.totalStaff} icon={<Users size={32} />} />
          <AnalyticalCard title="Present Today" value={stats.presentToday} icon={<UserCheck size={32} />} color="var(--success)" />
          <AnalyticalCard title="On Leave" value={stats.onLeave} icon={<AlertTriangle size={32} />} color="var(--warning)" />
          <AnalyticalCard title="Absent" value={stats.absent} icon={<UserMinus size={32} />} color="var(--error)" />
        </div>
      )}

      <DeviceScanner />
    </div>
  );
};
