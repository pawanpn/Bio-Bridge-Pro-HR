import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DeviceScanner } from '../components/DeviceScanner';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '../context/AuthContext';
import { 
  Users, UserCheck, UserMinus, Cloud, CloudOff, Clock, X, CalendarCheck, 
  Fingerprint, ScanFace, ArrowLeft, DollarSign, TrendingUp, TrendingDown,
  ShoppingCart, Package, FileText, Briefcase, Calendar, Activity,
  CreditCard, Wallet, BarChart3, PieChart as PieChartIcon,
  Layers, Truck, Settings, ClipboardList, CheckCircle, AlertCircle,
  CalendarDays, UserPlus, Building2, MapPin, Phone, Mail, DoorOpen, Monitor
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area, LineChart, Line 
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ERPStats {
  // HR Module
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  onLeave: number;
  pendingLeaveRequests: number;
  newHiresThisMonth: number;
  resignationsThisMonth: number;
  absent: number;
  totalStaff: number;
  
  // Finance Module
  totalRevenue: number;
  totalExpenses: number;
  pendingInvoices: number;
  pendingPayments: number;
  profitMargin: number;
  
  // Inventory Module
  totalItems: number;
  lowStockItems: number;
  totalWarehouses: number;
  pendingPOs: number;
  
  // Project Module
  activeProjects: number;
  completedProjects: number;
  overdueTasks: number;
  totalTasks: number;
  
  // CRM Module
  totalLeads: number;
  activeOpportunities: number;
  expectedRevenue: number;
  totalCustomers: number;
  
  // Attendance
  lastDeviceSync?: string;
  presentStaff: Staff[];
  absentStaff: Staff[];
  lateStaff: Staff[];
  leaveStaff: Staff[];
  branches: BranchInfo[];
}

interface BranchInfo {
  id: number;
  name: string;
  location?: string;
  employee_count: number;
  gate_count: number;
  device_count: number;
}

interface Staff {
  id: number;
  name: string;
  time?: string;
}

interface CloudConfig {
  configured: boolean;
  clientEmail?: string;
  projectId?: string;
  rootFolderId?: string;
}

interface DeviceConfig {
  id: number;
  name: string;
  ip_address: string;
  ip: string;
  port: number;
  brand: string;
  status: string;
  is_default: boolean;
}

interface Stats {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  onLeave: number;
  lateToday: number;
  pendingLeaveRequests: number;
  newHiresThisMonth: number;
  resignationsThisMonth: number;
  absent: number;
  totalStaff: number;
  lastDeviceSync?: string;
  presentStaff: Staff[];
  absentStaff: Staff[];
  lateStaff: Staff[];
  leaveStaff: Staff[];
  branches: BranchInfo[];
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

// Stat Card Component with gradient backgrounds
const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  iconColor: string;
  onClick?: () => void;
}> = ({ title, value, icon, gradient, iconColor, onClick }) => (
  <Card
    className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden border-0"
    onClick={onClick}
  >
    <div className={`relative p-6 bg-gradient-to-br ${gradient}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
        <div className={`p-3 rounded-xl bg-white/20 backdrop-blur-sm ${iconColor}`}>
          {icon}
        </div>
      </div>
    </div>
  </Card>
);

// Summary Mini Card for Punch Detail Modal
const SummaryMini: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <Card className="border-0 shadow-sm">
    <CardContent className="p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
    </CardContent>
  </Card>
);

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  
  const [stats, setStats] = useState<ERPStats | null>(null);
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
    invoke<Stats>('get_dashboard_stats').then(s => { 
      setStats(s as unknown as ERPStats); 
      buildWeeklyChart(s); 
    });
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
    invoke<Stats>('get_dashboard_stats').then(s => { 
      // Cast Stats to ERPStats
      setStats(s as unknown as ERPStats); 
      buildWeeklyChart(s); 
    });
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
      invoke<Stats>('get_dashboard_stats').then(s => { 
        setStats(s as unknown as ERPStats); 
        buildWeeklyChart(s); 
      });
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
    setSyncProgress('Pulling ALL logs from device...');
    try {
      await invoke('pull_all_logs', {
        ip: device.ip,
        port: device.port,
        deviceId: device.id,
        brand: device.brand,
      });
      setSyncProgress(null);
      invoke<Stats>('get_dashboard_stats').then(s => { 
        setStats(s as unknown as ERPStats); 
        buildWeeklyChart(s); 
      });
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
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Dashboard Overview</h1>
            <div
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                Date.now() - lastPulse < 2000
                  ? 'bg-green-500 shadow-lg shadow-green-500/50'
                  : isRealtimeEnabled
                  ? 'bg-green-500/25'
                  : 'bg-gray-500/25'
              }`}
              title="Live Pulse (Flashes on activity)"
            />
          </div>

          {device && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
              isDeviceOnline
                ? 'bg-green-50 border-green-500 dark:bg-green-950/20 dark:border-green-500'
                : isDeviceOnline === false
                ? 'bg-red-50 border-red-500 dark:bg-red-950/20 dark:border-red-500'
                : 'bg-gray-50 border-gray-300 dark:bg-gray-900/20 dark:border-gray-600'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isDeviceOnline ? 'bg-green-500' : isDeviceOnline === false ? 'bg-red-500' : 'bg-gray-400'
              }`} />
              <span className={`text-xs font-semibold ${
                isDeviceOnline ? 'text-green-600 dark:text-green-400' : isDeviceOnline === false ? 'text-red-600 dark:text-red-400' : 'text-gray-500'
              }`}>
                {device.is_default && (
                  <Badge variant="default" className="text-[9px] px-1.5 py-0 mr-1.5">DEFAULT</Badge>
                )}
                {device.name}: {isDeviceOnline ? 'CONNECTED' : isDeviceOnline === false ? 'OFFLINE' : 'CHECKING...'}
              </span>
            </div>
          )}

          {/* Toggles Row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <Label
                htmlFor="realtime-toggle"
                className={`text-xs font-bold cursor-pointer ${
                  isRealtimeEnabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                }`}
              >
                LIVE PUSH {isRealtimeEnabled ? 'ON' : 'OFF'}
              </Label>
              <Switch
                id="realtime-toggle"
                checked={isRealtimeEnabled}
                onCheckedChange={handleToggleRealtime}
              />
            </div>

            <div className="flex items-center gap-2.5">
              <Label
                htmlFor="quicksync-toggle"
                className={`text-xs font-bold cursor-pointer ${
                  isQuickSyncEnabled ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                QUICK-SYNC {isQuickSyncEnabled ? 'ON' : 'OFF'}
              </Label>
              <Switch
                id="quicksync-toggle"
                checked={isQuickSyncEnabled}
                onCheckedChange={handleToggleQuickSync}
              />
              {isQuickSyncEnabled && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  {isSyncing ? 'SYNCING...' : `NEXT IN ${secondsUntilSync}s`}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <Button
              onClick={triggerAutoSync}
              disabled={isSyncing || !isDeviceOnline}
              variant="outline"
              size="sm"
              className={`text-xs font-bold w-full ${
                isSyncing || !isDeviceOnline ? 'opacity-60 cursor-not-allowed' : ''
              } ${!isSyncing && isDeviceOnline ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
            >
              {isSyncing ? (
                <><Clock className="w-3.5 h-3.5 mr-1.5 animate-spin" /> SYNCING...</>
              ) : (
                <><Clock className="w-3.5 h-3.5 mr-1.5" /> SYNC NOW</>
              )}
            </Button>
            <Button
              onClick={triggerPullAllLogs}
              disabled={isSyncing || !isDeviceOnline}
              variant="outline"
              size="sm"
              className={`text-xs font-bold w-full ${
                isSyncing || !isDeviceOnline ? 'opacity-60 cursor-not-allowed' : ''
              } ${!isSyncing && isDeviceOnline ? 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600' : ''}`}
            >
              {isSyncing ? (
                <><Clock className="w-3.5 h-3.5 mr-1.5 animate-spin" /> SYNCING...</>
              ) : (
                <><Cloud className="w-3.5 h-3.5 mr-1.5" /> PULL ALL LOGS</>
              )}
            </Button>
            {syncProgress && (
              <p className="text-[10px] text-primary font-semibold text-center leading-tight">
                {syncProgress}
              </p>
            )}
          </div>
        </div>

        {cloud && (
          <div className="flex flex-col items-end gap-1">
            <div className={`flex items-center gap-2.5 px-4 py-2 rounded-full border ${
              cloud.configured
                ? 'bg-green-50 border-green-500 dark:bg-green-950/20 dark:border-green-500'
                : 'bg-red-50 border-red-500 dark:bg-red-950/20 dark:border-red-500'
            }`}>
              {cloud.configured ? (
                <Cloud className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : (
                <CloudOff className="w-4 h-4 text-red-600 dark:text-red-400" />
              )}
              <span className={`text-sm font-medium ${
                cloud.configured ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {cloud.configured ? 'Cloud Sync Active' : 'Cloud Not Configured'}
              </span>
            </div>
            {stats?.lastDeviceSync && (
              <span className="text-[11px] text-muted-foreground font-semibold pr-2">
                Last Device Sync: {stats.lastDeviceSync}
              </span>
            )}
          </div>
        )}
      </div>

      <p className="text-muted-foreground">Real-time statistics for Head Office</p>

      {/* Sync Error Banner */}
      {syncError && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400">
              <span className="text-lg">⚠️</span>
              <span className="text-sm font-semibold flex-1">{syncError}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600 dark:text-red-400" onClick={() => setSyncError(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stats && stats.totalStaff > 0 ? (
        <>
          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <StatCard
              title="Total Employees"
              value={stats.totalStaff}
              icon={<Users size={28} />}
              gradient="from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20"
              iconColor="text-blue-600 dark:text-blue-400"
              onClick={() => setActiveListModal({ title: 'Total Employees', data: [...stats.presentStaff, ...stats.absentStaff, ...stats.leaveStaff], type: 'total' })}
            />
            <StatCard
              title="Present Today"
              value={stats.presentToday}
              icon={<UserCheck size={28} />}
              gradient="from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20"
              iconColor="text-green-600 dark:text-green-400"
              onClick={() => setActiveListModal({ title: 'Present Today', data: stats.presentStaff, type: 'present' })}
            />
            <StatCard
              title="Late Today"
              value={stats.lateToday}
              icon={<Clock size={28} />}
              gradient="from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20"
              iconColor="text-amber-600 dark:text-amber-400"
              onClick={() => setActiveListModal({ title: 'Late Today', data: stats.lateStaff, type: 'late' })}
            />
            <StatCard
              title="Leave Requests"
              value={stats.onLeave}
              icon={<CalendarCheck size={28} />}
              gradient="from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/20"
              iconColor="text-yellow-600 dark:text-yellow-400"
              onClick={() => navigate('/leave-management')}
            />
            <StatCard
              title="Absent"
              value={stats.absent}
              icon={<UserMinus size={28} />}
              gradient="from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/20"
              iconColor="text-red-600 dark:text-red-400"
              onClick={() => setActiveListModal({ title: 'Absent', data: stats.absentStaff, type: 'absent' })}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Charts Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Branches Overview - Super Admin Only */}
              {isSuperAdmin && stats.branches && stats.branches.length > 0 && (
                <Card className="border border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold">Organization Structure - Branches</CardTitle>
                      <Button variant="outline" size="sm" onClick={() => navigate('/branch-gate-device')}>
                        Manage
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {stats.branches.map((branch) => (
                        <div
                          key={branch.id}
                          className="p-3 rounded-lg border border-border bg-card hover:bg-accent/10 cursor-pointer transition-colors"
                          onClick={() => navigate(`/branch-gate-device?branch=${branch.id}`)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-4 h-4 text-primary" />
                            <span className="font-semibold text-sm">{branch.name}</span>
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {branch.employee_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <DoorOpen className="w-3 h-3" /> {branch.gate_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <Monitor className="w-3 h-3" /> {branch.device_count}
                            </span>
                          </div>
                          {branch.location && (
                            <p className="text-xs text-muted-foreground mt-1">{branch.location}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pie Chart */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold">Today's Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[220px]">
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
                              className="cursor-pointer outline-none"
                              onClick={() => {
                                if (entry.name === 'On-time') setActiveListModal({ title: 'On-time Today', data: stats.presentStaff.filter(s => !stats.lateStaff.find(l => l.id === s.id)), type: 'present' });
                                if (entry.name === 'Late') setActiveListModal({ title: 'Late Today', data: stats.lateStaff, type: 'late' });
                                if (entry.name === 'Leave') navigate('/leave-management');
                                if (entry.name === 'Absent') setActiveListModal({ title: 'Absent', data: stats.absentStaff, type: 'absent' });
                              }}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}
                          itemStyle={{ color: 'var(--text-color)', fontWeight: 'bold' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend */}
                  <div className="flex gap-3 flex-wrap justify-center mt-2">
                    {[{ label: 'On-time', color: '#10b981' }, { label: 'Late', color: '#f59e0b' }, { label: 'Leave', color: '#3b82f6' }, { label: 'Absent', color: '#ef4444' }].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="text-muted-foreground">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Bar Chart */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold">Weekly Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[160px]">
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
                </CardContent>
              </Card>
            </div>

            {/* List Section */}
            <div className="space-y-6 max-h-[420px] overflow-y-auto">
              {/* Present Today */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex justify-between items-center">
                    <span>Present Today</span>
                    <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
                      {stats.presentToday}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {stats.presentStaff.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No one present yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.presentStaff.map(s => (
                        <div
                          key={s.id}
                          onClick={() => handleShowTodayPunches(s.id)}
                          className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50 border-l-4 border-green-500"
                        >
                          <span className="text-sm font-semibold">{s.name}</span>
                          <span className="text-xs text-muted-foreground">In: {s.time || 'N/A'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Absent */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex justify-between items-center">
                    <span>Absent</span>
                    <Badge variant="destructive" className="hover:bg-destructive/90">
                      {stats.absent}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {stats.absentStaff.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Everyone is present or on leave!</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.absentStaff.map(s => (
                        <div
                          key={s.id}
                          onClick={() => handleEmployeeClick(s.id)}
                          className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50 border-l-4 border-red-500"
                        >
                          <span className="text-sm font-semibold">{s.name}</span>
                          <Badge variant="destructive" className="text-xs">Missing</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
            <p className="text-sm text-muted-foreground">Sync your device to see real-time workforce statistics.</p>
          </CardContent>
        </Card>
      )}

      <DeviceScanner />

      {/* List Modal - using shadcn Dialog */}
      <Dialog open={!!activeListModal} onOpenChange={() => setActiveListModal(null)}>
        <DialogContent className="max-w-[500px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              {activeListModal?.type === 'present' ? (
                <UserCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : activeListModal?.type === 'late' ? (
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <UserMinus className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
              {activeListModal?.title} ({activeListModal?.data.length})
            </DialogTitle>
          </DialogHeader>

          {!activeListModal || activeListModal.data.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No records found.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {activeListModal.data.map(s => {
                let info = "";
                if (activeListModal.type === 'late') {
                  const inTime = s.time || "09:30";
                  info = `Late by ${isNaN(Date.parse(`1970-01-01T${inTime}`)) ? "Unknown" : Math.floor((Date.parse(`1970-01-01T${inTime}`) - Date.parse(`1970-01-01T09:15:00`)) / 60000)} mins`;
                } else if (s.time) {
                  info = `In: ${s.time}`;
                } else {
                  info = activeListModal.type === 'absent' ? 'Missing' : 'On Leave';
                }

                const borderColor = activeListModal.type === 'present'
                  ? 'border-green-500'
                  : activeListModal.type === 'late'
                  ? 'border-amber-500'
                  : 'border-red-500';

                const textColor = activeListModal.type === 'present'
                  ? 'text-muted-foreground'
                  : activeListModal.type === 'late'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400';

                return (
                  <div
                    key={s.id}
                    onClick={() => { handleEmployeeClick(s.id); setActiveListModal(null); }}
                    className={`flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50 border-l-4 ${borderColor}`}
                  >
                    <span className="font-semibold">{s.name}</span>
                    <span className={`text-sm font-bold ${textColor}`}>{info}</span>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Today's Punch Detail Modal - using shadcn Dialog */}
      <Dialog open={!!todayPunchDetail} onOpenChange={() => setTodayPunchDetail(null)}>
        <DialogContent className="max-w-[700px] max-h-[85vh]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="w-9 h-9 p-0"
                onClick={() => setTodayPunchDetail(null)}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <DialogTitle className="text-lg">{todayPunchDetail?.name}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {todayPunchDetail?.date} • {todayPunchDetail?.totalPunches} punches
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Summary Cards */}
          {todayPunchDetail && (
            <div className="grid grid-cols-4 gap-3">
              <SummaryMini
                label="Status"
                value={todayPunchDetail.status}
                color={
                  todayPunchDetail.status === 'Present' ? 'var(--success)' :
                  todayPunchDetail.status === 'Late' ? 'var(--warning)' : 'var(--error)'
                }
              />
              <SummaryMini label="First In" value={todayPunchDetail.firstIn || 'N/A'} color="var(--success)" />
              <SummaryMini label="Last Out" value={todayPunchDetail.lastOut || 'N/A'} color="var(--error)" />
              <SummaryMini label="Working Hrs" value={todayPunchDetail.workingHours} color="var(--primary-color)" />
            </div>
          )}

          <Separator />

          {/* Punch Log Table */}
          <div className="max-h-[400px] overflow-y-auto">
            {punchDetailLoading ? (
              <div className="py-10 text-center text-muted-foreground">Loading punches...</div>
            ) : !todayPunchDetail || todayPunchDetail.punches.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">No punches recorded today.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase">#</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase">Time</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase">Method</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase">Device</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayPunchDetail.punches.map((punch, idx) => {
                    const isFace = punch.method.toUpperCase().includes('FACE') || punch.method === '1';
                    return (
                      <TableRow key={idx}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-sm font-semibold text-primary">
                          {punch.time || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-xs font-semibold ${
                              isFace
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100'
                            }`}
                          >
                            {isFace ? (
                              <><ScanFace className="w-3 h-3 mr-1" /> Face</>
                            ) : (
                              <><Fingerprint className="w-3 h-3 mr-1" /> Finger</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{punch.device}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
