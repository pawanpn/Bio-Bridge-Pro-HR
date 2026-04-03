import React, { useEffect, useState } from 'react';
import { AnalyticalCard } from '../components/AnalyticalCard';
import { DeviceScanner } from '../components/DeviceScanner';
import { invoke } from '@tauri-apps/api/core';
import { Users, UserCheck, AlertTriangle, UserMinus, Cloud, CloudOff, Info } from 'lucide-react';

interface Stats {
  totalStaff: number;
  presentToday: number;
  onLeave: number;
  absent: number;
}

interface CloudConfig {
  configured: boolean;
  clientEmail?: string;
  projectId?: string;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [cloud, setCloud] = useState<CloudConfig | null>(null);

  useEffect(() => {
    invoke<Stats>('get_dashboard_stats').then(setStats);
    invoke<CloudConfig>('get_cloud_config').then(setCloud);
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h1 style={{ margin: 0 }}>Dashboard Overview</h1>
        
        {cloud && (
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '10px', 
            padding: '8px 16px', borderRadius: '24px', 
            backgroundColor: cloud.configured ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${cloud.configured ? 'var(--success)' : 'var(--error)'}`
          }}>
            {cloud.configured ? <Cloud size={18} color="var(--success)" /> : <CloudOff size={18} color="var(--error)" />}
            <span style={{ fontSize: '13px', fontWeight: '500', color: cloud.configured ? 'var(--success)' : 'var(--error)' }}>
              {cloud.configured ? 'Cloud Sync Active' : 'Cloud Not Configured'}
            </span>
          </div>
        )}
      </div>
      
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Real-time statistics for Head Office</p>
      
      {cloud?.configured && (
        <div style={{ 
          marginBottom: '32px', padding: '16px', borderRadius: '12px', 
          backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <div style={{ padding: '10px', backgroundColor: 'var(--primary-light)', borderRadius: '50%', color: 'white' }}>
            <Info size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Service Account (Invite this to your Drive folder)
            </span>
            <code style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary-color)' }}>{cloud.clientEmail}</code>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>
             Root Folder ID: <br />
             <span style={{ fontWeight: '600', color: 'var(--text-color)' }}>1jwry...DC_Ps</span>
          </div>
        </div>
      )}

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
