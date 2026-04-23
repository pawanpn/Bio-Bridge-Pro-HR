import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '../context/AuthContext';
import {
  Calendar, Upload, UserPlus,
  Clock, CheckCircle, AlertCircle, RefreshCw, Fingerprint
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
}

interface Employee {
  id: number;
  name: string;
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

type TabType = 'daily' | 'manual' | 'import' | 'history';

// ── Main Component ──────────────────────────────────────────────────────────

export const AttendanceManagement: React.FC = () => {
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
  const [syncedLogs, setSyncedLogs] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [allHistoryLogs, setAllHistoryLogs] = useState<AttendanceLog[]>([]);

  // Manual entry
  const [manualForm, setManualForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
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
      const [branchData, empData, deviceData] = await Promise.all([
        invoke<any[]>('list_branches'),
        invoke<any[]>('list_employees'),
        invoke<any[]>('list_all_devices'),
      ]);
      setBranches(branchData);
      setEmployees(empData);
      setDevices(deviceData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load daily logs when date or branch changes
  // Load logs when tab, date, or branch changes
  useEffect(() => {
    loadDailyLogs();
  }, [activeTab, selectedDate, selectedBranch]);

  const loadDailyLogs = async () => {
    setLoading(true);
    try {
      const logs = await invoke<any[]>('get_daily_reports', {
        branchId: selectedBranch,
        date: selectedDate,
      });
      setDailyLogs(logs || []);
      
      // Also load full history if on history tab
      if (activeTab === 'history') {
        const historyRes = await invoke<any>('get_attendance_logs', {
          employeeId: null,
          startDate: null,
          endDate: null
        });
        setAllHistoryLogs(historyRes.data || []);
      }
    } catch (error) {
      console.error('Failed to load daily logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Device sync function
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
      });
      
      if (logs && logs.length > 0) {
        setSyncedLogs(logs);
        setShowPreview(true);
        setSyncStatus(`✅ Successfully pulled ${logs.length} logs from ${device.name}!`);
      } else {
        setSyncStatus(`ℹ️ No new logs found on ${device.name}.`);
      }
      loadDailyLogs();
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus(`❌ Sync failed: ${error}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncStatus(''), 8000);
    }
  };

  const handleTestDeviceConnection = async (device: Device) => {
    try {
      await invoke('test_device_connection', {
        ip: device.ip,
        port: device.port,
        commKey: device.comm_key,
        machineNumber: device.machine_number,
        brand: device.brand
      });
      alert(`✅ ${device.name} is online and reachable!`);
    } catch (error) {
      alert(`❌ Connection failed: ${error}`);
    }
  };

  // Manual attendance entry
  const handleManualEntry = async () => {
    if (!manualForm.employeeId || !manualForm.date || !manualForm.time) {
      setManualStatus('❌ Please fill all fields');
      return;
    }
    setManualStatus('');
    try {
      await invoke('add_manual_attendance', {
        employeeId: Number(manualForm.employeeId),
        date: manualForm.date,
        time: manualForm.time,
        method: manualForm.method,
      });
      setManualStatus('✅ Attendance recorded successfully!');
      setManualForm({
        employeeId: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        method: 'Manual',
      });
      loadDailyLogs();
      setTimeout(() => setManualStatus(''), 3000);
    } catch (error) {
      setManualStatus('❌ Failed: ' + error);
    }
  };

  // CSV Import
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

  // Stats calculation
  const todayStats = {
    totalPunches: dailyLogs.length,
    uniqueEmployees: new Set(dailyLogs.map(l => l.employee_id)).size,
    syncedCount: dailyLogs.filter(l => l.is_synced).length,
    pendingSync: dailyLogs.filter(l => !l.is_synced).length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Sync Status indicator */}
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

      {/* Device Connection Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {devices.length === 0 ? (
          <Card className="md:col-span-3 border-dashed bg-muted/20">
            <CardContent className="h-20 flex items-center justify-center text-sm text-muted-foreground italic">
              No attendance devices are currently configured.
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
                  <Button 
                    size="sm" 
                    className="h-7 px-4 text-xs font-bold" 
                    onClick={() => handleSyncFromDevice(device)}
                    disabled={syncing}
                  >
                    {syncing ? '...' : 'PULL LOGS'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <Label>Branch</Label>
          <select
            value={selectedBranch || ''}
            onChange={(e) => setSelectedBranch(e.target.value ? Number(e.target.value) : null)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
          >
            <option value="">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={loadDailyLogs} variant="outline" className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
        <div className="flex items-end">
          <Button 
            onClick={() => {
              const defaultDevice = devices.find(d => d.is_default) || devices[0];
              if (defaultDevice) handleSyncFromDevice(defaultDevice);
              else alert('❌ No devices configured. Please add a device in Branch/Gate/Device Management.');
            }}
            disabled={syncing || devices.length === 0}
            className="w-full"
          >
            <Fingerprint className="w-4 h-4 mr-2" />
            {syncing ? 'Syncing...' : 'Sync from Device'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
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

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-border">
        <TabButton
          icon={<Calendar className="w-4 h-4" />}
          label="Daily Attendance"
          active={activeTab === 'daily'}
          onClick={() => setActiveTab('daily')}
        />
        <TabButton
          icon={<UserPlus className="w-4 h-4" />}
          label="Manual Entry"
          active={activeTab === 'manual'}
          onClick={() => setActiveTab('manual')}
        />
        <TabButton
          icon={<Upload className="w-4 h-4" />}
          label="CSV Import"
          active={activeTab === 'import'}
          onClick={() => setActiveTab('import')}
        />
        <TabButton
          icon={<Clock className="w-4 h-4" />}
          label="All Logs History"
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
        />
      </div>

      {/* Daily Attendance Tab */}
      {activeTab === 'daily' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Attendance Logs - {selectedDate}</span>
              <Badge variant="secondary">
                {dailyLogs.length} records
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Branch / Gate</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Punch Method</TableHead>
                  <TableHead>Sync Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : dailyLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No attendance records found for this date.
                    </TableCell>
                  </TableRow>
                ) : (
                  dailyLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.employee_name || `#${log.employee_id}`}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {log.branch_name || '—'} / {log.gate_name || '—'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.timestamp}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.punch_method || 'Unknown'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.is_synced ? 'default' : 'secondary'}>
                          {log.is_synced ? '✓ Synced' : '⏳ Pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Full Attendance History (Last 1000 logs)</span>
              <Badge variant="outline">{allHistoryLogs.length} total logs</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allHistoryLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center text-muted-foreground italic">
                        No historical logs found. Pull data from your biometric device to see records.
                      </TableCell>
                    </TableRow>
                  ) : (
                    allHistoryLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/30">
                        <TableCell className="font-semibold">{log.employee_name || 'Unknown'}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">#{log.employee_id}</TableCell>
                        <TableCell className="text-xs">{log.timestamp}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px] font-normal">{log.punch_method}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={log.is_synced ? 'default' : 'outline'} className="text-[10px]">
                            {log.is_synced ? 'Cloud Synced' : 'Local Only'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Entry Tab */}
      {activeTab === 'manual' && (
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
                      <option key={e.id} value={e.id}>{e.name} (#{e.id})</option>
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
      {activeTab === 'import' && (
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
              <Button onClick={() => setShowPreview(false)}>Close Preview</Button>
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
}> = ({ icon, label, active, onClick }) => (
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
  </button>
);
