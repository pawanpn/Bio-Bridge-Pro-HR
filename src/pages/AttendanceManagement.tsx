import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '../context/AuthContext';
import {
  Calendar, Upload, UserPlus,
  Clock, CheckCircle, AlertCircle, RefreshCw, Fingerprint, Database, Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ── Types ───────────────────────────────────────────────────────────────────

interface AttendanceLog {
  id: number;
  employee_id: number;
  employee_name: string;
  branch_id: number;
  branch_name: string;
  gate_id: number;
  gate_name: string;
  device_id: number;
  timestamp: string;
  punch_method: string;
  is_synced: boolean;
  name?: string;
}

interface Employee {
  id: number;
  employee_code?: string;
  name: string;
  full_name?: string;
  department: string;
  branch_id: number;
}

interface Branch {
  id: number;
  name: string;
}

interface Gate {
  id: number;
  name: string;
}

interface Device {
  id: number;
  name: string;
  brand: string;
  ip: string;
  port: number;
  comm_key: number;
  machine_number: number;
  branch_id: number;
  branch_name: string;
  gate_id: number;
  gate_name: string;
  status: string;
  is_default: boolean;
}

interface UnknownEmployee {
  id: number;
  device_user_id: number | null;
  name: string;
  employee_code?: string | null;
  branch_id?: number | null;
  branch_name?: string | null;
  log_count?: number;
  last_seen?: string | null;
  sync_status?: string | null;
}

type TabType = 'daily' | 'unknown' | 'manual' | 'import' | 'history';
type DailyViewMode = 'logs' | 'summary';

// ── Main Component ──────────────────────────────────────────────────────────

export const AttendanceManagement: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Daily attendance
  const [dailyLogs, setDailyLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Device sync
  const [devices, setDevices] = useState<Device[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [localDefaultId, setLocalDefaultId] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [syncedLogs, setSyncedLogs] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [syncBranch, setSyncBranch] = useState<string>("1");
  const [syncGate, setSyncGate] = useState<string>("1");
  const [gates, setGates] = useState<any[]>([]);
  const [unknownIds, setUnknownIds] = useState<UnknownEmployee[]>([]);
  const [unknownForms, setUnknownForms] = useState<Record<number, { name: string; employeeId: string }>>({});
  const [unknownSearch, setUnknownSearch] = useState('');
  const [mergeConfirmItem, setMergeConfirmItem] = useState<UnknownEmployee | null>(null);
  const [mergeConfirmForm, setMergeConfirmForm] = useState<{ name: string; employeeId: string } | null>(null);
  const [allHistoryLogs, setAllHistoryLogs] = useState<AttendanceLog[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  // Summary / Absent-Present-Late view
  const [dailyViewMode, setDailyViewMode] = useState<DailyViewMode>('logs');
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Employee + date range filter for logs
  const [empFilter, setEmpFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [rangeMode, setRangeMode] = useState(false);

  // Manual entry
  const [manualForm, setManualForm] = useState({
    employeeId: '',
    date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD in local time
    time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    method: 'Manual',
  });
  const [manualStatus, setManualStatus] = useState('');

  // CSV Import
  const [csvContent, setCsvContent] = useState('');
  const [csvStatus, setCsvStatus] = useState('');

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [branchData, empResult, deviceData, gateData, localId, unknownData] = await Promise.all([
        invoke<any[]>('list_branches'),
        invoke<any>('list_employees'),
        invoke<any[]>('list_all_devices', { branchId: selectedBranch }),
        invoke<any[]>('list_gates', { branchId: selectedBranch }),
        invoke<number | null>('get_local_sync_target'),
        invoke<UnknownEmployee[]>('get_unmapped_logs').catch(() => []),
      ]);
      setBranches(branchData);
      
      const empData = Array.isArray(empResult) ? empResult : (empResult as any)?.data || [];
      setEmployees(empData);
      
      setDevices(deviceData);
      setGates(gateData);
      setLocalDefaultId(localId);
      setUnknownIds(Array.isArray(unknownData) ? unknownData : []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  const handleSetLocalDefault = async (deviceId: number) => {
    try {
      await invoke('set_local_sync_target', { deviceId });
      setLocalDefaultId(deviceId);
      setSyncStatus(`Device #${deviceId} set as local sync target`);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    const handleDataSynced = () => loadData();
    window.addEventListener('data-synced', handleDataSynced);
    return () => window.removeEventListener('data-synced', handleDataSynced);
  }, [loadData]);

  // Load daily logs when date or branch changes
  useEffect(() => {
    loadDailyLogs();
  }, [activeTab, selectedDate, selectedBranch]);

  // Auto-reload summary when date or branch changes
  useEffect(() => {
    if (dailyViewMode === 'summary') {
      loadSummary();
    }
  }, [selectedDate, selectedBranch, dailyViewMode]);

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      if (rangeMode) {
        const result = await invoke<any>('get_attendance_range_summary', {
          fromDate: dateFrom,
          toDate: dateTo,
          branchId: selectedBranch,
          employeeId: empFilter ? Number(empFilter) : null,
          lateThreshold: null,
        });
        setAttendanceSummary({ ...result, isRange: true });
      } else {
        const result = await invoke<any>('get_attendance_summary', {
          date: selectedDate,
          branchId: selectedBranch,
          lateThreshold: null,
        });
        setAttendanceSummary({ ...result, isRange: false });
      }
    } catch (err) {
      console.error('Summary load failed:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadDailyLogs = async () => {
    const loadHistory = async () => {
      try {
        const historyRes = await invoke<any>('get_attendance_logs', {
          employeeId: null,
          startDate: null,
          endDate: null
        });
        const logs = historyRes.data || [];
        const filtered = selectedBranch 
          ? logs.filter((l: any) => l.branch_id === selectedBranch)
          : logs;
        setAllHistoryLogs(filtered);
      } catch (err) {
        console.error(err);
      }
    };

    setLoading(true);
    try {
      const logs = await invoke<any[]>('get_daily_reports', {
        fromDate: selectedDate,
        toDate: selectedDate,
        dept: 'All',
        search: '',
        branchId: selectedBranch,
      });
      setDailyLogs(logs || []);
      
      if (activeTab === 'history') {
        await loadHistory();
      }
    } catch (error) {
      console.error('Failed to load daily logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignUnknown = async (item: UnknownEmployee) => {
    const form = unknownForms[item.id] || { name: '', employeeId: '' };
    const targetEmployeeId = form.employeeId ? Number(form.employeeId) : null;
    const nextName = (form.name || item.name || '').trim();

    if (!item.device_user_id) {
      setSyncStatus('❌ Missing device user ID');
      return;
    }

    if (!nextName && !targetEmployeeId) {
      setSyncStatus('❌ Enter a name or select an employee to merge');
      return;
    }

    try {
      await invoke('assign_name_to_id', {
        deviceUserId: item.device_user_id,
        name: nextName || item.name || `Employee ${item.device_user_id}`,
        employeeId: targetEmployeeId,
        branchId: item.branch_id || selectedBranch || 1,
      });
      setUnknownForms(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      await loadData();
      await loadDailyLogs();
      setSyncStatus(`✅ ID #${item.device_user_id} assigned successfully`);
    } catch (error) {
      console.error('Failed to assign unknown ID:', error);
      setSyncStatus(`❌ Assign failed: ${error}`);
    } finally {
      setTimeout(() => setSyncStatus(''), 5000);
    }
  };

  const requestUnknownAssignment = (item: UnknownEmployee) => {
    const form = unknownForms[item.id] || { name: '', employeeId: '' };
    if (form.employeeId) {
      setMergeConfirmItem(item);
      setMergeConfirmForm(form);
      return;
    }

    void handleAssignUnknown(item);
  };

  const confirmMergeAssignment = async () => {
    if (!mergeConfirmItem || !mergeConfirmForm) return;
    const item = mergeConfirmItem;
    const form = mergeConfirmForm;
    setMergeConfirmItem(null);
    setMergeConfirmForm(null);
    await handleAssignUnknown({
      ...item,
      name: form.name || item.name,
    });
  };

  const filteredHistory = allHistoryLogs.filter(log => {
    const name = (log as any).name || log.employee_name || "";
    const id = log.employee_id?.toString() || "";
    const search = historySearch.toLowerCase();
    return name.toLowerCase().includes(search) || id.includes(search);
  });

  const handleSyncFromDevice = async (device: Device) => {
    setSyncing(true);
    setSyncedLogs([]);
    setSyncStatus(`🔄 Syncing logs from ${device.name}...`);
    try {
      const logs = await invoke<any[]>('sync_device_logs', {
        ip: device.ip,
        port: Number(device.port),
        deviceId: Number(device.id),
        brand: device.brand,
        targetBranchId: device.branch_id || parseInt(syncBranch),
        targetGateId: device.gate_id || parseInt(syncGate)
      });
      
      if (logs && logs.length > 0) {
        setSyncedLogs(logs);
        setShowPreview(true);
        setSyncStatus(`✅ Successfully pulled ${logs.length} logs from ${device.name}!`);
      } else {
        setSyncStatus(`ℹ️ No new logs found on ${device.name}.`);
      }
      loadDailyLogs();
      window.dispatchEvent(new CustomEvent('data-synced', { detail: { table: 'employees' } }));
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus(`❌ Sync failed: ${error}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncStatus(''), 8000);
    }
  };

  const handleManualEntry = async () => {
    if (!manualForm.employeeId || !manualForm.date || !manualForm.time) {
      setManualStatus('❌ Please fill all fields');
      return;
    }
    setManualStatus('');
    try {
      await invoke('add_manual_attendance', {
        employeeId: Number(manualForm.employeeId),
        timestamp: `${manualForm.date} ${manualForm.time}:00`,
        punchMethod: manualForm.method,
      });
      setManualStatus('✅ Attendance recorded successfully!');
      setManualForm({
        employeeId: '',
        date: new Date().toLocaleDateString('en-CA'),
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        method: 'Manual',
      });
      loadDailyLogs();
      setTimeout(() => setManualStatus(''), 3000);
    } catch (error) {
      setManualStatus('❌ Failed: ' + error);
    }
  };

  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    if (!csvContent) {
      setCsvStatus('❌ Please select a CSV file');
      return;
    }
    setCsvStatus('');
    try {
      await invoke('import_csv_attendance', {
        csvContent,
        branchId: selectedBranch || 1,
      });
      setCsvStatus('✅ CSV imported successfully!');
      loadDailyLogs();
      setTimeout(() => {
        setCsvStatus('');
        setCsvContent('');
      }, 2000);
    } catch (error) {
      setCsvStatus('❌ Import failed: ' + error);
    }
  };

  const todayStats = {
    totalPunches: dailyLogs.length,
    uniqueEmployees: new Set(dailyLogs.map(l => (l as any).id)).size,
    syncedCount: dailyLogs.filter(l => (l as any).is_synced).length,
    pendingSync: dailyLogs.filter(l => !(l as any).is_synced).length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance Management</h1>
          <p className="text-muted-foreground">Monitor daily attendance and sync data from biometric devices</p>
        </div>
        
        <div className="flex items-center gap-2">
          {syncing && (
            <div className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-xs font-medium animate-pulse flex items-center gap-2">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {syncStatus}
            </div>
          )}
          {!syncing && syncStatus && (
            <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-[10px] font-medium text-green-700 flex items-center gap-2">
              {syncStatus}
            </div>
          )}
          <Button onClick={loadData} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-3 h-3 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {selectedBranch && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {devices.length === 0 ? (
            <Card className="md:col-span-3 border-dashed bg-muted/20">
              <CardContent className="h-20 flex items-center justify-center text-sm text-muted-foreground italic">
                No attendance devices found for this branch.
              </CardContent>
            </Card>
          ) : (
            devices.map(device => (
              <Card key={device.id} className="shadow-sm border-muted/60">
                <CardContent className="p-4 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${device.status === 'Online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                      <span className="font-bold text-sm tracking-tight">{device.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold">
                      {device.brand}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                      {device.ip}:{device.port}
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={localDefaultId === device.id ? "default" : "outline"}
                        className={`h-7 px-3 text-[10px] font-bold ${localDefaultId === device.id ? 'bg-primary' : 'text-slate-400'}`}
                        onClick={() => handleSetLocalDefault(device.id)}
                      >
                        {localDefaultId === device.id ? <CheckCircle className="w-3 h-3 mr-1" /> : <Database className="w-3 h-3 mr-1" />}
                        {localDefaultId === device.id ? 'ACTIVE' : 'SET SYNC'}
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-7 px-4 text-xs font-bold" 
                        onClick={() => handleSyncFromDevice(device)}
                        disabled={syncing}
                      >
                        {syncing ? '...' : 'PULL LOGS'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          ))}
        </div>
      )}
      <Card className="border-none shadow-sm bg-slate-50 dark:bg-black/20 my-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <Label className="text-[10px] font-bold text-primary uppercase tracking-wider">Active Branch & Sync Target</Label>
              <select
                value={selectedBranch || ''}
                onChange={(e) => {
                   const bid = e.target.value ? Number(e.target.value) : null;
                   setSelectedBranch(bid);
                   if (bid) setSyncBranch(bid.toString());
                }}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="flex-1 min-w-[180px] space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Gate</Label>
              <select
                value={syncGate}
                onChange={(e) => setSyncGate(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
              >
                {gates.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div className="flex-1 min-w-[180px] space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sync Device</Label>
              <select
                value={localDefaultId || ''}
                onChange={(e) => setLocalDefaultId(e.target.value ? Number(e.target.value) : null)}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="">Select Device</option>
                {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.ip})</option>)}
              </select>
            </div>

            <div className="min-w-[150px] space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-11 rounded-xl font-mono text-sm border-slate-200 shadow-none"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={loadDailyLogs} 
                variant="outline" 
                className="h-11 px-6 rounded-xl border-slate-200 hover:bg-white hover:shadow-md transition-all flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button 
                className={`h-11 px-8 rounded-xl border-none font-bold shadow-lg transition-all ${localDefaultId ? 'bg-blue-900 hover:bg-blue-800 text-white shadow-blue-900/20' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                onClick={() => {
                   const target = devices.find(d => d.id === localDefaultId);
                   if (target) handleSyncFromDevice(target);
                   else alert("Please select a Sync Device first.");
                }}
                disabled={!localDefaultId || syncing}
              >
                <Fingerprint className="w-4 h-4 mr-2" />
                {syncing ? 'Syncing...' : 'Sync Selected'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Punches</p>
              <p className="text-2xl font-bold">{todayStats.totalPunches}</p>
            </div>
            <Clock className="w-8 h-8 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Unique Employees</p>
              <p className="text-2xl font-bold">{todayStats.uniqueEmployees}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Synced to Cloud</p>
              <p className="text-2xl font-bold text-green-600">{todayStats.syncedCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Sync</p>
              <p className="text-2xl font-bold text-orange-600">{todayStats.pendingSync}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </CardContent>
        </Card>
      </div>

      {unknownIds.length > 0 && activeTab !== 'unknown' && (
        <Card className="mb-6 border-amber-200 bg-amber-50/40">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Unresolved device IDs are waiting</p>
              <p className="text-xs text-amber-800">
                {unknownIds.length} ID{unknownIds.length === 1 ? '' : 's'} need mapping so future attendance shows the right employee names.
              </p>
            </div>
            <Button
              onClick={() => setActiveTab('unknown')}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Open ID Mapping
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 mb-6 border-b border-border">
        <TabButton
          icon={<Calendar className="w-4 h-4" />}
          label="Daily Attendance"
          active={activeTab === 'daily'}
          onClick={() => setActiveTab('daily')}
        />
        <TabButton
          icon={<Fingerprint className="w-4 h-4" />}
          label="ID Mapping"
          active={activeTab === 'unknown'}
          onClick={() => setActiveTab('unknown')}
          count={unknownIds.length}
        />
        {user?.role?.toUpperCase() === 'SUPER_ADMIN' && (
          <TabButton
            icon={<UserPlus className="w-4 h-4" />}
            label="Manual Entry"
            active={activeTab === 'manual'}
            onClick={() => setActiveTab('manual')}
          />
        )}
        {user?.role?.toUpperCase() === 'SUPER_ADMIN' && (
          <TabButton
            icon={<Upload className="w-4 h-4" />}
            label="CSV Import"
            active={activeTab === 'import'}
            onClick={() => setActiveTab('import')}
          />
        )}
        <TabButton
          icon={<Clock className="w-4 h-4" />}
          label="All Logs History"
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
        />
      </div>

      {activeTab === 'daily' && (
        <div className="space-y-4">
          {/* View Mode Toggle + Employee/Date Range Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setDailyViewMode('logs')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  dailyViewMode === 'logs' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'
                }`}
              >📋 Logs View</button>
              <button
                onClick={() => { setDailyViewMode('summary'); loadSummary(); }}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  dailyViewMode === 'summary' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'
                }`}
              >📊 Present / Absent / Late</button>
            </div>

            {/* Employee + Date Range filter (Common) */}
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Employee</label>
                <select
                  value={empFilter}
                  onChange={e => setEmpFilter(e.target.value)}
                  className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All Employees</option>
                  {employees.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.name || e.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <input type="checkbox" id="range-toggle" checked={rangeMode}
                  onChange={e => setRangeMode(e.target.checked)}
                  className="w-3.5 h-3.5 accent-blue-600"
                />
                <label htmlFor="range-toggle" className="text-[10px] font-bold text-slate-500 uppercase">Date Range</label>
              </div>
              {rangeMode && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">From</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">To</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <Button size="sm" className="h-9 text-xs" onClick={() => {
                    if (dailyViewMode === 'logs') {
                      invoke<any[]>('get_daily_reports', {
                        fromDate: dateFrom, toDate: dateTo, dept: 'All', search: '',
                        branchId: selectedBranch, employeeId: empFilter ? Number(empFilter) : null, gateId: null
                      }).then(logs => setDailyLogs(logs || [])).catch(console.error);
                    } else {
                      // We'll update the summary for range if we can, 
                      // for now it will use the range to maybe show multiple days?
                      // Actually, let's keep it daily for summary but consistent UI.
                      loadSummary();
                    }
                  }}>Apply</Button>
                </>
              )}
            </div>
          </div>

          {/* ── SUMMARY VIEW ── */}
          {dailyViewMode === 'summary' && (
            <div className="space-y-4">
              {summaryLoading ? (
                <div className="flex items-center justify-center h-40">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary opacity-30" />
                </div>
              ) : attendanceSummary ? (
                <>
                  {/* Summary KPI Row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                      <p className="text-3xl font-black text-green-600">
                        {attendanceSummary.isRange 
                          ? attendanceSummary.summary.filter((s: any) => s.days_present > 0).length
                          : attendanceSummary.present.filter((e: any) => !empFilter || String(e.id) === empFilter).length}
                      </p>
                      <p className="text-xs font-bold text-green-500 mt-1">✓ {attendanceSummary.isRange ? 'Ever Present' : 'On Time'}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                      <p className="text-3xl font-black text-amber-600">
                        {attendanceSummary.isRange
                          ? attendanceSummary.summary.reduce((acc: number, s: any) => acc + s.days_late, 0)
                          : attendanceSummary.late.filter((e: any) => !empFilter || String(e.id) === empFilter).length}
                      </p>
                      <p className="text-xs font-bold text-amber-500 mt-1">⏰ {attendanceSummary.isRange ? 'Total Late Days' : 'Late'}</p>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                      <p className="text-3xl font-black text-red-600">
                        {attendanceSummary.isRange
                          ? attendanceSummary.summary.filter((s: any) => s.days_present === 0).length
                          : attendanceSummary.absent.filter((e: any) => !empFilter || String(e.id) === empFilter).length}
                      </p>
                      <p className="text-xs font-bold text-red-500 mt-1">✗ {attendanceSummary.isRange ? 'Always Absent' : 'Absent'}</p>
                    </div>
                  </div>

                  {/* Range vs Daily Lists */}
                  {attendanceSummary.isRange ? (
                    <Card>
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-sm">Range Summary ({attendanceSummary.from} to {attendanceSummary.to})</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/50">
                              <TableHead>Employee</TableHead>
                              <TableHead>Days Present</TableHead>
                              <TableHead>Days Late</TableHead>
                              <TableHead>Shift Start</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {attendanceSummary.summary.map((s: any) => (
                              <TableRow key={s.id}>
                                <TableCell className="font-bold">{s.name}</TableCell>
                                <TableCell>{s.days_present}</TableCell>
                                <TableCell className={s.days_late > 0 ? 'text-amber-600 font-bold' : ''}>{s.days_late}</TableCell>
                                <TableCell className="text-xs text-slate-500 font-mono">{s.shift_start}</TableCell>
                                <TableCell>
                                  {s.days_present > 0 ? (
                                    <Badge className="bg-green-50 text-green-700">Present</Badge>
                                  ) : (
                                    <Badge variant="destructive">Absent Entire Range</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Present */}
                      <Card className="border-green-100">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-sm text-green-700 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" /> On Time ({attendanceSummary.present.filter((e: any) => !empFilter || String(e.id) === empFilter).length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 max-h-72 overflow-y-auto">
                          {attendanceSummary.present
                            .filter((e: any) => !empFilter || String(e.id) === empFilter)
                            .map((emp: any) => (
                            <div key={emp.id} className="flex items-center justify-between px-4 py-2 border-b border-green-50 hover:bg-green-50/50">
                              <div>
                                <p className="text-sm font-semibold text-slate-700">{emp.name}</p>
                                <p className="text-[10px] text-slate-400">{emp.department || '—'}</p>
                              </div>
                              <div className="text-right">
                                <Badge className="bg-green-100 text-green-700 border-0 text-[10px] font-mono">{emp.first_punch}</Badge>
                                <p className="text-[9px] text-slate-400 mt-0.5">Shift: {emp.shift_start}</p>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      {/* Late */}
                      <Card className="border-amber-100">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-sm text-amber-700 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Late ({attendanceSummary.late.filter((e: any) => !empFilter || String(e.id) === empFilter).length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 max-h-72 overflow-y-auto">
                          {attendanceSummary.late
                            .filter((e: any) => !empFilter || String(e.id) === empFilter)
                            .map((emp: any) => (
                            <div key={emp.id} className="flex items-center justify-between px-4 py-2 border-b border-amber-50 hover:bg-amber-50/50">
                              <div>
                                <p className="text-sm font-semibold text-slate-700">{emp.name}</p>
                                <p className="text-[10px] text-slate-400">{emp.department || '—'}</p>
                              </div>
                              <div className="text-right">
                                <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] font-mono">{emp.first_punch}</Badge>
                                <p className="text-[9px] text-slate-400 mt-0.5 font-bold">Shift: {emp.shift_start}</p>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      {/* Absent */}
                      <Card className="border-red-100">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-sm text-red-700 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> Absent ({attendanceSummary.absent.filter((e: any) => !empFilter || String(e.id) === empFilter).length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 max-h-72 overflow-y-auto">
                          {attendanceSummary.absent
                            .filter((e: any) => !empFilter || String(e.id) === empFilter)
                            .map((emp: any) => (
                            <div key={emp.id} className="flex items-center justify-between px-4 py-2 border-b border-red-50 hover:bg-red-50/50">
                              <div>
                                <p className="text-sm font-semibold text-slate-700">{emp.name}</p>
                                <p className="text-[10px] text-slate-400">{emp.department || '—'}</p>
                              </div>
                              <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">—</Badge>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground italic">Select a date and click "Present / Absent / Late" to load summary.</div>
              )}
            </div>
          )}

          {/* ── LOGS VIEW ── */}
          {dailyViewMode === 'logs' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Attendance Logs — {rangeMode ? `${dateFrom} → ${dateTo}` : selectedDate}</span>
                  <Badge variant="secondary">{dailyLogs.length} records</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => setSortConfig({key: 'name', direction: sortConfig?.key === 'name' && sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>
                        Member Name {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => setSortConfig({key: 'branch_name', direction: sortConfig?.key === 'branch_name' && sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>
                        Branch {sortConfig?.key === 'branch_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead>Timestamps (In/Out History)</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-12">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary opacity-20" />
                      </TableCell></TableRow>
                    ) : dailyLogs.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">
                        No attendance records found for this date.
                      </TableCell></TableRow>
                    ) : (
                      [...dailyLogs]
                        .filter((log: any) => !empFilter || String(log.id) === empFilter)
                        .sort((a: any, b: any) => {
                          if (!sortConfig) return 0;
                          const aVal = a[sortConfig.key] || '';
                          const bVal = b[sortConfig.key] || '';
                          return sortConfig.direction === 'asc'
                            ? aVal.toString().localeCompare(bVal.toString())
                            : bVal.toString().localeCompare(aVal.toString());
                        })
                        .map((log: any) => (
                          <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="font-bold text-slate-700">
                              {log.name || 'Unknown'}
                              <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-mono">#{log.employee_code || log.id}</span>
                            </TableCell>
                            <TableCell className="text-slate-500 text-sm">{log.branch_name || '—'}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {log.all_punches?.split(' | ').map((p_str: string, i: number) => {
                                  const [p, method] = p_str.split('::');
                                  return (
                                    <Badge key={i} variant="secondary"
                                      className="bg-blue-50 text-blue-700 border-blue-100 font-mono text-[10px] cursor-help"
                                      title={`Source: ${method || 'Device'}`}>{p}</Badge>
                                  );
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-[10px]">{log.punch_method || 'Device'}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="default" className="bg-green-50 text-green-700 border-green-100 text-[10px]">✓ Saved Log</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'unknown' && (
        <div className="space-y-4">
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2 text-amber-900">
                  <AlertCircle className="w-5 h-5" />
                  Unknown ID Mapping
                </span>
                <Badge variant="secondary" className="w-fit bg-amber-100 text-amber-800">
                  {unknownIds.length} unresolved
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-medium text-slate-700">
                    Map device IDs once. After assignment, the same attendance source will resolve to the employee name automatically.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Unknown IDs stay in the database until you map or merge them, so attendance is never dropped.
                  </p>
                </div>
                <div className="relative w-full lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={unknownSearch}
                    onChange={(e) => setUnknownSearch(e.target.value)}
                    placeholder="Search ID, name, branch..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Unresolved IDs</p>
                  <p className="mt-1 text-2xl font-black text-amber-600">{unknownIds.length}</p>
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Total logs</p>
                  <p className="mt-1 text-2xl font-black text-slate-800">
                    {unknownIds.reduce((acc, item) => acc + (item.log_count || 0), 0)}
                  </p>
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Latest seen</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {unknownIds[0]?.last_seen || 'No data yet'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {unknownIds
                  .filter(item => {
                    const term = unknownSearch.trim().toLowerCase();
                    if (!term) return true;
                    return [
                      String(item.device_user_id ?? ''),
                      item.name || '',
                      item.employee_code || '',
                      item.branch_name || '',
                      item.sync_status || '',
                    ].some(value => value.toLowerCase().includes(term));
                  })
                  .map(item => {
                    const currentForm = unknownForms[item.id] || { name: item.name || '', employeeId: '' };
                    return (
                      <div key={item.id} className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                          <div className="flex-1 min-w-[180px]">
                            <p className="text-xs font-semibold text-amber-900">Device User ID</p>
                            <div className="font-mono text-sm text-slate-700">
                              #{item.device_user_id ?? 'Unknown'} <span className="text-muted-foreground">({item.log_count || 0} logs)</span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-[220px]">
                            <Label className="text-xs font-semibold text-amber-900">Assign / Rename</Label>
                            <Input
                              value={currentForm.name}
                              onChange={(e) => setUnknownForms(prev => ({
                                ...prev,
                                [item.id]: { ...currentForm, name: e.target.value }
                              }))}
                              placeholder="New name"
                              className="mt-1 bg-white"
                            />
                          </div>
                          <div className="flex-1 min-w-[220px]">
                            <Label className="text-xs font-semibold text-amber-900">Merge Into Existing</Label>
                            <select
                              value={currentForm.employeeId}
                              onChange={(e) => setUnknownForms(prev => ({
                                ...prev,
                                [item.id]: { ...currentForm, employeeId: e.target.value }
                              }))}
                              className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-white text-sm"
                            >
                              <option value="">Create / keep placeholder</option>
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name || emp.full_name || emp.employee_code || `#${emp.id}`}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="shrink-0">
                            <Button
                              onClick={() => requestUnknownAssignment(item)}
                              className="w-full lg:w-auto bg-amber-600 hover:bg-amber-700 text-white"
                            >
                              Assign
                            </Button>
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Branch: {item.branch_name || 'N/A'} · Last seen: {item.last_seen || 'N/A'}
                        </p>
                      </div>
                    );
                  })}

                {unknownIds.filter(item => {
                  const term = unknownSearch.trim().toLowerCase();
                  if (!term) return true;
                  return [
                    String(item.device_user_id ?? ''),
                    item.name || '',
                    item.employee_code || '',
                    item.branch_name || '',
                    item.sync_status || '',
                  ].some(value => value.toLowerCase().includes(term));
                }).length === 0 && (
                  <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/30 p-8 text-center text-sm text-muted-foreground">
                    No unresolved IDs match your search.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Full Attendance History (Last 1000 logs)</h3>
              <div className="flex items-center gap-3">
                 <div className="relative">
                    <Input 
                      placeholder="Search employee..." 
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="h-9 w-64 pl-8 text-xs rounded-lg border-slate-200 focus:ring-primary/20"
                    />
                    <div className="absolute left-2.5 top-2.5 text-slate-400">
                       <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </div>
                 </div>
                 <Badge variant="secondary" className="text-[10px] py-0.5">{filteredHistory.length} total logs</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border rounded-xl overflow-hidden bg-white">
              <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase">Employee</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">ID</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Timestamp</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Method</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((log, i) => (
                      <TableRow key={i} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="py-3 font-bold text-slate-700">{(log as any).employee_name || (log as any).name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">#{log.employee_id}</TableCell>
                        <TableCell className="font-mono text-xs">{log.timestamp}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px] uppercase">{log.punch_method}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={log.is_synced ? 'default' : 'outline'} className="bg-slate-50 text-slate-700 border-slate-200 text-[9px] font-bold">
                            {log.is_synced ? 'Cloud Synced' : 'Local Only'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredHistory.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                          No logs found matching your search.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Entry Tab */}
      {activeTab === 'manual' && user?.role?.toUpperCase() === 'SUPER_ADMIN' && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Attendance Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
              <div>
                <Label>Employee</Label>
                <select
                  value={manualForm.employeeId}
                  onChange={(e) => setManualForm({ ...manualForm, employeeId: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
                >
                  <option value="">Select Employee</option>
                  {employees
                    .filter(e => !selectedBranch || e.branch_id === selectedBranch)
                      .map(e => (
                        <option key={e.id} value={e.id}>
                          {e.full_name || e.name || `Employee #${e.id}`}
                        </option>
                      ))}
                </select>
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={manualForm.date}
                  onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={manualForm.time}
                  onChange={(e) => setManualForm({ ...manualForm, time: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Punch Method</Label>
                <select
                  value={manualForm.method}
                  onChange={(e) => setManualForm({ ...manualForm, method: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
                >
                  <option value="Manual">Manual Entry</option>
                  <option value="Card">Card Swipe</option>
                  <option value="Pin">PIN Entry</option>
                </select>
              </div>
            </div>

            {manualStatus && (
              <div className={`mt-4 p-3 rounded-md ${
                manualStatus.includes('❌') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
              }`}>
                {manualStatus}
              </div>
            )}

            <div className="mt-6">
              <Button onClick={handleManualEntry}>
                <UserPlus className="w-4 h-4 mr-2" />
                Record Attendance
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSV Import Tab */}
      {activeTab === 'import' && user?.role?.toUpperCase() === 'SUPER_ADMIN' && (
        <Card>
          <CardHeader>
            <CardTitle>Import Attendance from CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-2xl">
              <div className="mb-4 p-4 bg-muted rounded-md">
                <h3 className="font-semibold mb-2">CSV Format</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Your CSV should have the following columns:
                </p>
                <code className="text-xs bg-background p-2 rounded block">
                  employee_id,date,time,method
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  Example: 101,2026-04-07,09:15,Finger
                </p>
              </div>

              <div className="mb-4">
                <Label>Upload CSV File</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileSelect}
                  className="mt-1"
                />
              </div>

              {csvStatus && (
                <div className={`mb-4 p-3 rounded-md ${
                  csvStatus.includes('❌') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                }`}>
                  {csvStatus}
                </div>
              )}

              <Button onClick={handleImportCsv} disabled={!csvContent}>
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!mergeConfirmItem}
        onOpenChange={(open) => {
          if (!open) {
            setMergeConfirmItem(null);
            setMergeConfirmForm(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-amber-600" />
              Confirm Merge & Reassign
            </DialogTitle>
            <DialogDescription>
              This will move the attendance history for device user ID{' '}
              <span className="font-mono font-semibold text-foreground">
                #{mergeConfirmItem?.device_user_id ?? 'Unknown'}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-foreground">
                {mergeConfirmForm?.employeeId
                  ? employees.find(emp => emp.id === Number(mergeConfirmForm.employeeId))?.name ||
                    employees.find(emp => emp.id === Number(mergeConfirmForm.employeeId))?.full_name ||
                    `Employee #${mergeConfirmForm.employeeId}`
                  : 'the selected employee'}
              </span>
              . Use this only when the device ID already belongs to that employee.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
            <p className="font-semibold">What will happen</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• The employee record will keep the selected name.</li>
              <li>• Attendance logs for this device ID will be reassigned.</li>
              <li>• Future punches from the device will resolve to the same employee.</li>
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setMergeConfirmItem(null)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => void confirmMergeAssignment()}
              disabled={!mergeConfirmItem}
            >
              Confirm Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Device Sync Result</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Showing logs pulled from the biometric device. These have been automatically mapped to employees.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>✕</Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncedLogs.map((log, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-xs">
                        {log.employee_name} <span className="text-muted-foreground font-mono">(#{log.employee_id})</span>
                      </TableCell>
                      <TableCell className="text-xs">{log.timestamp}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{log.punch_method}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] text-green-600 bg-green-50">Saved</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <div className="p-4 border-t bg-muted/10 flex justify-end">
              <Button onClick={() => {
                setShowPreview(false);
                loadDailyLogs();
                // If we are on history tab, refresh that as well
                if (activeTab === 'history') {
                    invoke<any>('get_attendance_logs', {
                        employeeId: null,
                        startDate: null,
                        endDate: null
                    }).then(res => setAllHistoryLogs(res.data || []));
                }
              }}>Save and Close</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// ── Tab Button Component ────────────────────────────────────────────────────

const TabButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}> = ({ icon, label, active, onClick, count }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? 'border-primary text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`}
  >
    {icon}
    {label}
    {typeof count === 'number' && count > 0 && (
      <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
        {count}
      </span>
    )}
  </button>
);
