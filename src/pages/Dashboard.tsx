import React, { useEffect, useState } from 'react';
import { AnalyticalCard } from '../components/AnalyticalCard';
import { DeviceScanner } from '../components/DeviceScanner';
import { invoke } from '@tauri-apps/api/core';
import { Users, UserCheck, AlertTriangle, UserMinus, Cloud, CloudOff, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Staff {
  id: number;
  name: string;
  time?: string;
}

interface Stats {
  totalStaff: number;
  presentToday: number;
  onLeave: number;
  absent: number;
  lateToday: number;
  presentStaff: Staff[];
  absentStaff: Staff[];
  lateStaff: Staff[];
  leaveStaff: Staff[];
}

interface DeviceConfig {
  name: string;
  brand: string;
  ip: string;
  port: number;
  status: string;
}

interface CloudConfig {
  configured: boolean;
  clientEmail?: string;
  projectId?: string;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [cloud, setCloud] = useState<CloudConfig | null>(null);
  const [device, setDevice] = useState<DeviceConfig | null>(null);
  const [isDeviceOnline, setIsDeviceOnline] = useState<boolean | null>(null);
  const [isQuickSyncEnabled, setIsQuickSyncEnabled] = useState<boolean>(localStorage.getItem('quickSync') === 'true');
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState<boolean>(localStorage.getItem('realtimePush') === 'true');
  const [secondsUntilSync, setSecondsUntilSync] = useState<number>(60);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastPulse, setLastPulse] = useState<number>(0);

  useEffect(() => {
    invoke<Stats>('get_dashboard_stats').then(setStats);
    invoke<CloudConfig>('get_cloud_config').then(setCloud);
    loadAndTestDevice();

    // Auto-Sync Timer (QuickSync)
    const syncTimer = setInterval(() => {
      if (isQuickSyncEnabled && device && isDeviceOnline && !isSyncing) {
        setSecondsUntilSync(prev => {
          if (prev <= 1) {
            triggerAutoSync();
            return 60;
          }
          return prev - 1;
        });
      }
    }, 1000);

    // Subscribe to Real-Time Pulses
    let unlisten: () => void = () => {};
    const setupEvents = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      
      const un1 = await listen('realtime-pulse', () => {
        setLastPulse(Date.now());
        invoke<Stats>('get_dashboard_stats').then(setStats);
      });

      const un2 = await listen('attendance-sync-complete', () => {
        console.log("Sync complete, refreshing stats...");
        invoke<Stats>('get_dashboard_stats').then(setStats);
      });

      unlisten = () => { un1(); un2(); };

      if (isRealtimeEnabled && isDeviceOnline) {
        invoke('start_realtime_sync').catch(console.error);
      }
    };
    setupEvents();

    return () => {
      clearInterval(syncTimer);
      if (unlisten) unlisten();
    };
  }, [isQuickSyncEnabled, isRealtimeEnabled, device, isDeviceOnline, isSyncing]);

  const loadAndTestDevice = async () => {
    try {
      const activeDevice = await invoke<DeviceConfig | null>('get_active_devices');
      if (activeDevice) {
        setDevice(activeDevice);
        try {
          await invoke('test_device_connection', {
            ip: activeDevice.ip,
            port: activeDevice.port,
            brand: activeDevice.brand
          });
          setIsDeviceOnline(true);
        } catch (e) {
          setIsDeviceOnline(false);
        }
      }
    } catch (e) {
      console.error("Failed to load device config:", e);
    }
  };

  const triggerAutoSync = async () => {
    if (!device) return;
    setIsSyncing(true);
    try {
      await invoke('sync_device_logs', {
        ip: device.ip,
        device_id: 1, // Assuming id=1 for now (Head Office)
        brand: device.brand
      });
    } catch (e) {
      console.error("Auto-Sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleQuickSync = () => {
    const nextVal = !isQuickSyncEnabled;
    setIsQuickSyncEnabled(nextVal);
    localStorage.setItem('quickSync', nextVal.toString());
    if (nextVal) setSecondsUntilSync(60);
  };

  const handleToggleRealtime = () => {
    const nextVal = !isRealtimeEnabled;
    setIsRealtimeEnabled(nextVal);
    localStorage.setItem('realtimePush', nextVal.toString());
    if (nextVal && isDeviceOnline) {
      invoke('start_realtime_sync').catch(console.error);
    } else if (!nextVal) {
      invoke('stop_realtime_sync').catch(console.error);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ margin: 0 }}>Dashboard Overview</h1>
            <div style={{ 
               width: '12px', height: '12px', borderRadius: '50%', 
               backgroundColor: Date.now() - lastPulse < 2000 ? 'var(--success)' : (isRealtimeEnabled ? '#22c55e44' : '#6b728044'),
               boxShadow: Date.now() - lastPulse < 2000 ? '0 0 12px var(--success)' : 'none',
               transition: '0.3s'
            }} title="Live Pulse (Flashes on activity)" />
          </div>
          
          {device && (
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              padding: '6px 12px', borderRadius: '4px', 
              backgroundColor: isDeviceOnline ? 'rgba(16,185,129,0.1)' : isDeviceOnline === false ? 'rgba(239,68,68,0.1)' : 'rgba(156,163,175,0.1)',
              border: `1px solid ${isDeviceOnline ? 'var(--success)' : isDeviceOnline === false ? 'var(--error)' : 'var(--border-color)'}`
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: isDeviceOnline ? 'var(--success)' : isDeviceOnline === false ? 'var(--error)' : 'var(--text-muted)' }} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: isDeviceOnline ? 'var(--success)' : isDeviceOnline === false ? 'var(--error)' : 'var(--text-muted)' }}>
                {device.name}: {isDeviceOnline ? 'CONNECTED' : isDeviceOnline === false ? 'OFFLINE' : 'CHECKING...'}
              </span>
            </div>
          )}

          {/* Real-Time Push Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', color: isRealtimeEnabled ? 'var(--success)' : 'var(--text-muted)' }} onClick={handleToggleRealtime}>
              LIVE PUSH {isRealtimeEnabled ? 'ON' : 'OFF'}
            </label>
            <div 
              onClick={handleToggleRealtime}
              style={{ 
                width: '40px', height: '20px', borderRadius: '10px', 
                backgroundColor: isRealtimeEnabled ? 'var(--success)' : 'var(--border-color)',
                position: 'relative', cursor: 'pointer', transition: '0.3s'
              }}
            >
              <div style={{ 
                width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white',
                position: 'absolute', top: '2px', left: isRealtimeEnabled ? '22px' : '2px',
                transition: '0.3s'
              }} />
            </div>
          </div>

          {/* Quick-Sync Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', color: isQuickSyncEnabled ? 'var(--primary-color)' : 'var(--text-muted)' }} onClick={handleToggleQuickSync}>
              QUICK-SYNC {isQuickSyncEnabled ? 'ON' : 'OFF'}
            </label>
            <div 
              onClick={handleToggleQuickSync}
              style={{ 
                width: '40px', height: '20px', borderRadius: '10px', 
                backgroundColor: isQuickSyncEnabled ? 'var(--primary-color)' : 'var(--border-color)',
                position: 'relative', cursor: 'pointer', transition: '0.3s'
              }}
            >
              <div style={{ 
                width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white',
                position: 'absolute', top: '2px', left: isQuickSyncEnabled ? '22px' : '2px',
                transition: '0.3s'
              }} />
            </div>
            {isQuickSyncEnabled && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {isSyncing ? 'SYNCING...' : `NEXT IN ${secondsUntilSync}s`}
              </span>
            )}
          </div>

          {/* Manual Sync Button */}
          <button 
            onClick={triggerAutoSync}
            disabled={isSyncing || !isDeviceOnline}
            style={{
              marginLeft: '12px',
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid var(--primary-color)',
              backgroundColor: isSyncing ? 'transparent' : 'var(--primary-color)',
              color: isSyncing ? 'var(--primary-color)' : 'white',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: isSyncing || !isDeviceOnline ? 'not-allowed' : 'pointer',
              opacity: isSyncing || !isDeviceOnline ? 0.6 : 1,
              transition: '0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isSyncing ? 'SYNCING...' : 'SYNC NOW'}
          </button>
        </div>
        
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
      


      {stats && stats.totalStaff > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '40px' }}>
            <AnalyticalCard title="Total Employees" value={stats.totalStaff} icon={<Users size={32} />} />
            <AnalyticalCard title="Present Today" value={stats.presentToday} icon={<UserCheck size={32} />} color="var(--success)" />
            <AnalyticalCard title="Late Today" value={stats.lateToday} icon={<Clock size={32} />} color="var(--error)" />
            <AnalyticalCard title="On Leave" value={stats.onLeave} icon={<AlertTriangle size={32} />} color="var(--warning)" />
            <AnalyticalCard title="Absent" value={stats.absent} icon={<UserMinus size={32} />} color="var(--error)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr', gap: '32px', marginBottom: '40px' }}>
            {/* Pie Chart Section */}
            <div style={{ backgroundColor: 'var(--surface-color)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: '0 0 24px' }}>Overview</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'On-time', value: stats.presentToday - stats.lateToday, color: '#10b981' },
                        { name: 'Late', value: stats.lateToday, color: '#f59e0b' },
                        { name: 'Leave', value: stats.onLeave, color: '#3b82f6' },
                        { name: 'Absent', value: stats.absent, color: '#ef4444' }
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {
                        [
                          { name: 'On-time', value: stats.presentToday - stats.lateToday, color: '#10b981' },
                          { name: 'Late', value: stats.lateToday, color: '#f59e0b' },
                          { name: 'Leave', value: stats.onLeave, color: '#3b82f6' },
                          { name: 'Absent', value: stats.absent, color: '#ef4444' }
                        ].filter(d => d.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))
                      }
                    </Pie>
                    <Tooltip 
                       contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}
                       itemStyle={{ color: 'var(--text-color)', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* List Section */}
            <div style={{ backgroundColor: 'var(--surface-color)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', maxHeight: '380px' }}>
              <div>
                <h3 style={{ margin: '0 0 12px', color: 'var(--text-color)', display: 'flex', justifyContent: 'space-between' }}>
                  Present Today <span style={{ color: 'var(--success)', fontSize: '14px' }}>{stats.presentToday}</span>
                </h3>
                {stats.presentStaff.length === 0 ? <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No one present yet.</p> : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {stats.presentStaff.map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-color)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', transition: '0.2s', borderLeft: '3px solid var(--success)' }} className="hover-list-item">
                        <span style={{ fontWeight: '600' }}>{s.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>In: {s.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 style={{ margin: '0 0 12px', color: 'var(--text-color)', display: 'flex', justifyContent: 'space-between' }}>
                  Absent <span style={{ color: 'var(--error)', fontSize: '14px' }}>{stats.absent}</span>
                </h3>
                {stats.absentStaff.length === 0 ? <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Everyone is present or on leave!</p> : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {stats.absentStaff.map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-color)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', transition: '0.2s', borderLeft: '3px solid var(--error)' }} className="hover-list-item">
                        <span style={{ fontWeight: '600' }}>{s.name}</span>
                        <span style={{ color: 'var(--error)' }}>Missing</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ 
          padding: '40px', borderRadius: '12px', border: '1px dashed var(--border-color)', 
          textAlign: 'center', backgroundColor: 'var(--surface-color)', marginBottom: '40px' 
        }}>
           <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
           <h3 style={{ margin: 0 }}>No Data Available</h3>
           <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '8px 0 0' }}>Sync your device to see real-time workforce statistics.</p>
        </div>
      )}

      <DeviceScanner />
    </div>
  );
};

