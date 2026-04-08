import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '../context/AuthContext';
import {
  Calendar, Upload, UserPlus, Download,
  Clock, CheckCircle, AlertCircle, RefreshCw
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

type TabType = 'daily' | 'manual' | 'import' | 'reports';

// ── Main Component ──────────────────────────────────────────────────────────

export const AttendanceManagement: React.FC = () => {
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Daily attendance
  const [dailyLogs, setDailyLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Manual entry
  const [manualDialog, setManualDialog] = useState(false);
  const [manualForm, setManualForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    method: 'Manual',
  });
  const [manualStatus, setManualStatus] = useState('');

  // CSV Import
  const [csvDialog, setCsvDialog] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [csvStatus, setCsvStatus] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [branchData, empData] = await Promise.all([
        invoke<any[]>('list_branches'),
        invoke<any[]>('list_employees'),
      ]);
      setBranches(branchData);
      setEmployees(empData);
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
  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailyLogs();
    }
  }, [activeTab, selectedDate, selectedBranch]);

  const loadDailyLogs = async () => {
    setLoading(true);
    try {
      const logs = await invoke<any[]>('get_daily_reports', {
        branchId: selectedBranch,
        date: selectedDate,
      });
      setDailyLogs(logs || []);
    } catch (error) {
      console.error('Failed to load daily logs:', error);
    } finally {
      setLoading(false);
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
    setCsvFile(file);
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
        setCsvDialog(false);
        setCsvContent('');
        setCsvFile(null);
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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Attendance Management</h1>
        <p className="text-muted-foreground">
          Manage daily attendance, manual entries, and CSV imports
        </p>
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
