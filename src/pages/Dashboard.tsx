import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnalyticalCard } from '../components/AnalyticalCard';
import { DeviceScanner } from '../components/DeviceScanner';
import { invoke } from '@tauri-apps/api/core';
import { Users, UserCheck, UserMinus, Cloud, CloudOff, Clock, X, CalendarCheck, Fingerprint, ScanFace, ArrowLeft } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface Staff {
  id: number;
  name: string;
  time?: string;
}

interface TodayPunchDetail {
  employeeId: number;
  name: string;
  date: string;
  status: string;
  firstIn: string;
  lastOut: string;
  workingHours: string;
  totalPunches: number;
  punches: { timestamp: string; time: string; method: string; device: string }[];
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
  lastDeviceSync?: string;
}

interface DeviceConfig {
  id: number;
  name: string;
  brand: string;
  ip: string;
  port: number;
  status: string;
  is_default?: boolean;
}

interface CloudConfig {
  configured: boolean;
  clientEmail?: string;
  projectId?: string;
}

// Summary Mini Card for Punch Detail Modal
const SummaryMini: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ backgroundColor: 'var(--bg-color)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '16px', fontWeight: 'bold', color }}>{value}</div>
  </div>
);

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [cloud, setCloud] = useState<CloudConfig | null>(null);
  const [device, setDevice] = useState<DeviceConfig | null>(null);
  const [isDeviceOnline, setIsDeviceOnline] = useState<boolean | null>(null);
  const [isQuickSyncEnabled, setIsQuickSyncEnabled] = useState<boolean>(localStorage.getItem('quickSync') === 'true');
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState<boolean>(localStorage.getItem('realtimePush') === 'true');
  const [secondsUntilSync, setSecondsUntilSync] = useState<number>(60);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastPulse, setLastPulse] = useState<number>(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [weeklyChart, setWeeklyChart] = useState<{ day: string; present: number; absent: number }[]>([]);

  // Refs for mutable state to avoid useEffect re-triggers
  const isQuickSyncRef = useRef(isQuickSyncEnabled);
  const isRealtimeRef = useRef(isRealtimeEnabled);
  const isSyncingRef = useRef(isSyncing);
  const deviceRef = useRef(device);
  const isDeviceOnlineRef = useRef(isDeviceOnline);

  // Keep refs in sync
  useEffect(() => { isQuickSyncRef.current = isQuickSyncEnabled; }, [isQuickSyncEnabled]);
  useEffect(() => { isRealtimeRef.current = isRealtimeEnabled; }, [isRealtimeEnabled]);
  useEffect(() => { isSyncingRef.current = isSyncing; }, [isSyncing]);
  useEffect(() => { deviceRef.current = device; }, [device]);
  useEffect(() => { isDeviceOnlineRef.current = isDeviceOnline; }, [isDeviceOnline]);

  const refreshStats = () => {
    invoke<Stats>('get_dashboard_stats').then(s => { setStats(s); buildWeeklyChart(s); });
  };

  // Interactivity States
  const [activeListModal, setActiveListModal] = useState<{ title: string, data: Staff[], type: string } | null>(null);
  const [todayPunchDetail, setTodayPunchDetail] = useState<TodayPunchDetail | null>(null);
  const [punchDetailLoading, setPunchDetailLoading] = useState(false);

  const handleEmployeeClick = async (id: number) => {
    navigate(`/employee/${id}`);
  };

  // Fetch today's full punch log for an employee
  const handleShowTodayPunches = async (id: number) => {
    setPunchDetailLoading(true);
    try {
      const detail = await invoke<TodayPunchDetail>('get_today_employee_punches', { employeeId: id });
      setTodayPunchDetail(detail);
    } catch (e) {
      console.error('Failed to load today\'s punches:', e);
    } finally {
      setPunchDetailLoading(false);
    }
  };

  const buildWeeklyChart = (s: Stats) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    // Use present/absent from stats to fill today, rest are zeros until real data arrives
    const chart = days.map((day, i) => ({
      day,
      present: i === new Date().getDay() - 1 ? s.presentToday : 0,
      absent: i === new Date().getDay() - 1 ? s.absent : 0,
    }));
    setWeeklyChart(chart);
  };

  useEffect(() => {
    // Initial data load — runs ONCE on mount
    invoke<Stats>('get_dashboard_stats').then(s => { setStats(s); buildWeeklyChart(s); });
    invoke<CloudConfig>('get_cloud_config').then(setCloud);
    loadAndTestDevice();

    // Auto-Sync Timer (QuickSync) — uses refs to avoid re-creating interval
    const syncTimer = setInterval(() => {
      if (isQuickSyncRef.current && deviceRef.current && isDeviceOnlineRef.current && !isSyncingRef.current) {
        setSecondsUntilSync(prev => {
          if (prev <= 1) {
            triggerAutoSync();
            return 60;
          }
          return prev - 1;
        });
      }
    }, 1000);

    // Subscribe to Real-Time Pulses — runs ONCE on mount
    let unlisten: () => void = () => { };
    const setupEvents = async () => {
      const { listen } = await import('@tauri-apps/api/event');

      const un1 = await listen('realtime-pulse', () => {
        setLastPulse(Date.now());
        // Debounced: only refresh if not already syncing
        if (!isSyncingRef.current) {
          refreshStats();
        }
      });

      const un2 = await listen('attendance-sync-complete', () => {
        console.log("Sync complete, refreshing stats...");
        setSyncProgress(null);
        refreshStats();
      });

      const un3 = await listen<string>('sync-error', (event) => {
        setSyncError(event.payload);
        setSyncProgress(null);
        setTimeout(() => setSyncError(null), 8000);
      });

      const un4 = await listen<string>('sync-progress', (event) => {
        setSyncProgress(event.payload);
      });

      unlisten = () => { un1(); un2(); un3(); un4(); };

      // Start realtime only if enabled AND device is online
      if (isRealtimeRef.current && isDeviceOnlineRef.current) {
        invoke('start_realtime_sync').catch(console.error);
      }
    };
    setupEvents();

    return () => {
      clearInterval(syncTimer);
      if (unlisten) unlisten();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAndTestDevice = async () => {
    try {
      const activeDevice = await invoke<DeviceConfig | null>('get_active_devices');
      if (activeDevice) {
        setDevice(activeDevice);
        try {
          await invoke('test_device_connection', {
            ip: activeDevice.ip,
            port: activeDevice.port,
            commKey: 0, // Default 0 for quick check, backend will use DB key anyway
            brand: activeDevice.brand
          });
          setIsDeviceOnline(true);
          // AUTO-SYNC ON CONNECT
          triggerAutoSyncFromDevice(activeDevice);
        } catch (e) {
          setIsDeviceOnline(false);
          console.error("Device test failed:", e);
        }
      }
    } catch (e) {
      console.error("Failed to load device config:", e);
    }
  };

  const triggerAutoSyncFromDevice = async (dev: DeviceConfig) => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncProgress('Connecting to device...');
    try {
      await invoke('sync_device_logs', {
        ip: dev.ip,
        port: dev.port,
        deviceId: dev.id,
        brand: dev.brand,
      });
      setSyncProgress(null);
      invoke<Stats>('get_dashboard_stats').then(s => { setStats(s); buildWeeklyChart(s); });
    } catch (e) {
      setSyncError(String(e));
      setSyncProgress(null);
      setTimeout(() => setSyncError(null), 8000);
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerAutoSync = async () => {
    if (!device) return;
    triggerAutoSyncFromDevice(device);
  };

  const triggerPullAllLogs = async () => {
    if (!device) return;
    if (!confirm('Pull ALL attendance logs from device?\n\nThis will fetch every log from day one to now.\nDuplicates will be auto-skipped.')) return;
    setIsSyncing(true);
    setSyncError(null);
    setSyncProgress('📥 Pulling ALL logs from device...');
    try {
      await invoke('pull_all_logs', {
        ip: device.ip,
        port: device.port,
        deviceId: device.id,
        brand: device.brand,
      });
      setSyncProgress(null);
      invoke<Stats>('get_dashboard_stats').then(s => { setStats(s); buildWeeklyChart(s); });
    } catch (e) {
      setSyncError(String(e));
      setSyncProgress(null);
      setTimeout(() => setSyncError(null), 8000);
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
                {device.is_default && <span style={{ fontSize: 9, backgroundColor: 'var(--primary-color)', color: '#fff', padding: '1px 5px', borderRadius: 3, marginRight: 6 }}>DEFAULT</span>}
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
          <div style={{ marginLeft: '12px', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
            <button
              onClick={triggerAutoSync}
              disabled={isSyncing || !isDeviceOnline}
              style={{
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
                gap: '6px',
                width: '100%',
                justifyContent: 'center'
              }}
            >
              {isSyncing ? '↻ SYNCING...' : '⟳ SYNC NOW'}
            </button>
            <button
              onClick={triggerPullAllLogs}
              disabled={isSyncing || !isDeviceOnline}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #059669',
                backgroundColor: isSyncing ? 'transparent' : '#059669',
                color: isSyncing ? '#059669' : 'white',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: isSyncing || !isDeviceOnline ? 'not-allowed' : 'pointer',
                opacity: isSyncing || !isDeviceOnline ? 0.6 : 1,
                transition: '0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: '100%',
                justifyContent: 'center'
              }}
            >
              {isSyncing ? '↻ SYNCING...' : '📥 PULL ALL LOGS'}
            </button>
            {syncProgress && (
              <div style={{ fontSize: '10px', color: 'var(--primary-color)', fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>
                {syncProgress}
              </div>
            )}
          </div>
        </div>

        {cloud && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
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
            {stats?.lastDeviceSync && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, paddingRight: '8px' }}>
                Last Device Sync: {stats.lastDeviceSync}
              </span>
            )}
          </div>
        )}
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: syncError ? '12px' : '32px' }}>Real-time statistics for Head Office</p>

      {/* Sync Error Banner — shows real hardware errors instead of fake success */}
      {syncError && (
        <div style={{
          marginBottom: '24px', padding: '12px 18px', borderRadius: '8px',
          backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444',
          color: '#ef4444', fontSize: '13px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <span>⚠️</span>
          <span>{syncError}</span>
          <button onClick={() => setSyncError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {stats && stats.totalStaff > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '40px' }}>
            <div onClick={() => setActiveListModal({ title: 'Total Employees', data: [...stats.presentStaff, ...stats.absentStaff, ...stats.leaveStaff], type: 'total' })} style={{ cursor: 'pointer' }}><AnalyticalCard title="Total Employees" value={stats.totalStaff} icon={<Users size={32} />} /></div>
            <div onClick={() => setActiveListModal({ title: 'Present Today', data: stats.presentStaff, type: 'present' })} style={{ cursor: 'pointer' }}><AnalyticalCard title="Present Today" value={stats.presentToday} icon={<UserCheck size={32} />} color="var(--success)" /></div>
            <div onClick={() => setActiveListModal({ title: 'Late Today', data: stats.lateStaff, type: 'late' })} style={{ cursor: 'pointer' }}><AnalyticalCard title="Late Today" value={stats.lateToday} icon={<Clock size={32} />} color="var(--error)" /></div>
            <div onClick={() => navigate('/leave-management')} style={{ cursor: 'pointer' }}><AnalyticalCard title="Leave Requests" value={stats.onLeave} icon={<CalendarCheck size={32} />} color="var(--warning)" /></div>
            <div onClick={() => setActiveListModal({ title: 'Absent', data: stats.absentStaff, type: 'absent' })} style={{ cursor: 'pointer' }}><AnalyticalCard title="Absent" value={stats.absent} icon={<UserMinus size={32} />} color="var(--error)" /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr', gap: '32px', marginBottom: '40px' }}>
            {/* Charts Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Pie Chart */}
              <div style={{ backgroundColor: 'var(--surface-color)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700 }}>Today's Overview</h3>
                <div style={{ height: '220px' }}>
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
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[
                          { name: 'On-time', value: stats.presentToday - stats.lateToday, color: '#10b981' },
                          { name: 'Late', value: stats.lateToday, color: '#f59e0b' },
                          { name: 'Leave', value: stats.onLeave, color: '#3b82f6' },
                          { name: 'Absent', value: stats.absent, color: '#ef4444' }
                        ].filter(d => d.value > 0).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            style={{ cursor: 'pointer', outline: 'none' }}
                            onClick={() => {
                              if (entry.name === 'On-time') setActiveListModal({ title: 'On-time Today', data: stats.presentStaff.filter(s => !stats.lateStaff.find(l => l.id === s.id)), type: 'present' });
                              if (entry.name === 'Late') setActiveListModal({ title: 'Late Today', data: stats.lateStaff, type: 'late' });
                              if (entry.name === 'Leave') navigate('/leave-management');
                              if (entry.name === 'Absent') setActiveListModal({ title: 'Absent', data: stats.absentStaff, type: 'absent' });
                            }}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }} itemStyle={{ color: 'var(--text-color)', fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
                  {[{ label: 'On-time', color: '#10b981' }, { label: 'Late', color: '#f59e0b' }, { label: 'Leave', color: '#3b82f6' }, { label: 'Absent', color: '#ef4444' }].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: l.color }} />
                      <span style={{ color: 'var(--text-muted)' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Weekly Bar Chart */}
              <div style={{ backgroundColor: 'var(--surface-color)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700 }}>Weekly Attendance</h3>
                <div style={{ height: '160px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyChart} barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="present" fill="#10b981" name="Present" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="absent" fill="#ef4444" name="Absent" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
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
                      <div key={s.id} onClick={() => handleShowTodayPunches(s.id)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-color)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', transition: '0.2s', borderLeft: '3px solid var(--success)' }} className="hover-list-item">
                        <span style={{ fontWeight: '600' }}>{s.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>In: {s.time || 'N/A'}</span>
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
                      <div key={s.id} onClick={() => handleEmployeeClick(s.id)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-color)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', transition: '0.2s', borderLeft: '3px solid var(--error)' }} className="hover-list-item">
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

      {/* List Modal */}
      {activeListModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {activeListModal.type === 'present' ? <UserCheck color="var(--success)" /> :
                  activeListModal.type === 'late' ? <Clock color="var(--warning)" /> :
                    <UserMinus color="var(--error)" />}
                {activeListModal.title} ({activeListModal.data.length})
              </h2>
              <button onClick={() => setActiveListModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X /></button>
            </div>

            {activeListModal.data.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No records found.</p>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {activeListModal.data.map(s => {
                  let info = "";
                  if (activeListModal.type === 'late') {
                    // Calculate late time assuming 09:15 is the threshold
                    const inTime = s.time || "09:30";
                    info = `Late by ${isNaN(Date.parse(`1970-01-01T${inTime}`)) ? "Unknown" : Math.floor((Date.parse(`1970-01-01T${inTime}`) - Date.parse(`1970-01-01T09:15:00`)) / 60000)} mins`;
                  } else if (s.time) {
                    info = `In: ${s.time}`;
                  } else {
                    info = activeListModal.type === 'absent' ? 'Missing' : 'On Leave';
                  }

                  return (
                    <div key={s.id} onClick={() => { handleEmployeeClick(s.id); setActiveListModal(null); }} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'var(--bg-color)', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', transition: '0.2s', borderLeft: `4px solid ${activeListModal.type === 'present' ? 'var(--success)' : activeListModal.type === 'late' ? 'var(--warning)' : 'var(--error)'}` }} className="hover-list-item">
                      <span style={{ fontWeight: '600' }}>{s.name}</span>
                      <span style={{ color: activeListModal.type === 'present' ? 'var(--text-muted)' : (activeListModal.type === 'late' ? 'var(--warning)' : 'var(--error)'), fontWeight: 'bold' }}>
                        {info}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Today's Punch Detail Modal */}
      {todayPunchDetail && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: '16px', width: '90%', maxWidth: '700px', maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => setTodayPunchDetail(null)} style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-color)' }}>
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px' }}>{todayPunchDetail.name}</h2>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{todayPunchDetail.date} • {todayPunchDetail.totalPunches} punches</p>
                </div>
              </div>
              <button onClick={() => setTodayPunchDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X /></button>
            </div>

            {/* Summary Cards */}
            <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <SummaryMini label="Status" value={todayPunchDetail.status} color={todayPunchDetail.status === 'Present' ? 'var(--success)' : todayPunchDetail.status === 'Late' ? 'var(--warning)' : 'var(--error)'} />
              <SummaryMini label="First In" value={todayPunchDetail.firstIn || 'N/A'} color="var(--success)" />
              <SummaryMini label="Last Out" value={todayPunchDetail.lastOut || 'N/A'} color="var(--error)" />
              <SummaryMini label="Working Hrs" value={todayPunchDetail.workingHours} color="var(--primary-color)" />
            </div>

            {/* Punch Log Table */}
            <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
              {punchDetailLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading punches...</div>
              ) : todayPunchDetail.punches.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No punches recorded today.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-color)', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>#</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Time</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Method</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Device</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayPunchDetail.punches.map((punch, idx) => {
                      const isFace = punch.method.toUpperCase().includes('FACE') || punch.method === '1';
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 16px', fontWeight: '600', fontFamily: 'monospace', fontSize: '14px', color: 'var(--primary-color)' }}>
                            {punch.time || 'N/A'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                              backgroundColor: isFace ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                              color: isFace ? '#3b82f6' : 'var(--success)'
                            }}>
                              {isFace ? <><ScanFace size={12} /> Face</> : <><Fingerprint size={12} /> Finger</>}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{punch.device}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      );
};

