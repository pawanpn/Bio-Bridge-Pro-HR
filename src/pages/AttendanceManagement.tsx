import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import branchService from '../services/branchService';
import { useAuth } from '../context/AuthContext';
import {
  Calendar, Upload, UserPlus,
  Clock, CheckCircle, AlertCircle, RefreshCw, Fingerprint, Database,
  Search, Download, Play, FolderOpen, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AppConfig } from '../config/appConfig';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Types

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

type TabType = 'daily' | 'manual' | 'import' | 'history';
type DailyViewMode = 'logs' | 'summary' | 'report';

// Main Component

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

  // Daily Report state
  const [reportFromDate, setReportFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportToDate, setReportToDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportDept, setReportDept] = useState('All');
  const [reportBranch, setReportBranch] = useState<number | null>(null);
  const [reportSearch, setReportSearch] = useState('');
  const [reportEmployeeId, setReportEmployeeId] = useState<string>('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [departments, setDepartments] = useState<string[]>(['All']);

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
      // Detect desktop (Tauri) vs web (browser) mode
      const isDesktop = typeof window !== 'undefined' && '__TAURI__' in window;

      if (isDesktop) {
        // Desktop mode: query local SQLite via Tauri invoke
        const { invoke } = await import('@tauri-apps/api/core');
        const [branchList, deviceList, empList] = await Promise.all([
          invoke<any[]>('list_branches'),
          invoke<any[]>('list_all_devices'),
          invoke<any[]>('list_employees_for_select'),
        ]);
        setBranches(branchList.map((b: any) => ({ id: b.id, name: b.name })));
        setDevices(deviceList.map((d: any) => ({
          id: d.id, name: d.name, brand: d.brand, ip: d.ip,
          port: d.port, comm_key: d.comm_key, machine_number: d.machine_number,
          branch_id: d.branch_id, branch_name: d.branch_name,
          gate_id: d.gate_id, gate_name: d.gate_name,
          status: d.status, is_default: d.is_default,
        })));
        setEmployees(empList.map((e: any) => ({
          id: e.id,
          name: e.name || `Employee #${e.id}`,
          full_name: e.name,
          department: e.department || '',
          branch_id: e.branch_id || 0,
        })));
        setGates([]);
        setLocalDefaultId(null);
      } else {
        // Web mode: query Supabase
        const [branchData, deviceData] = await Promise.all([
          supabase.from('branches').select('*'),
          supabase.from('devices').select('*'),
        ]);
        const { data: empData } = await supabase.from('employees').select('*').eq('status', 'Active');
        const mapped = (empData || []).map((e: any) => ({
          id: e.id,
          name: e.first_name ? `${e.first_name} ${e.last_name || ''}`.trim() : (e.name || e.full_name || `Employee #${e.id}`),
          full_name: e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim(),
          department: e.department || '',
          branch_id: e.branch_id || 0,
        }));
        setBranches(branchData.data || []);
        setEmployees(mapped as Employee[]);
        setDevices(deviceData.data || []);
        setGates([]);
        setLocalDefaultId(null);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  const handleSetLocalDefault = async (deviceId: number) => {
    try {
      setLocalDefaultId(deviceId);
      setSyncStatus('Device set as local sync target');
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

  const buildAttendanceSummary = (raw: any[], isRange: boolean) => {
    const mapped = raw.map((r: any) => ({
      id: r.employee_id,
      name: r.employees?.first_name ? `${r.employees.first_name} ${r.employees.last_name || ''}`.trim() : (r.employee_name || 'Unknown'),
      department: r.employees?.department || r.department || '-',
      first_punch: r.first_in ? new Date(r.first_in).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '-',
      shift_start: r.shifts?.shift_start || r.shift_start || '09:00',
      status: r.status || 'Absent',
      days_present: r.days_present || 0,
      days_late: r.days_late || 0,
    }));
    const present = mapped.filter((e: any) => e.status === 'Present' || e.status === 'On-time');
    const late = mapped.filter((e: any) => e.status === 'Late');
    const absent = mapped.filter((e: any) => e.status === 'Absent' || e.status === 'On Leave');
    setAttendanceSummary({ data: mapped, present, late, absent, isRange, total: mapped.length, summary: mapped });
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const isDesktop = typeof window !== 'undefined' && '__TAURI__' in window;

      if (isDesktop) {
        // Desktop mode: use Tauri invoke to get summary from local DB
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<any>('get_attendance_summary', {
          date: selectedDate,
          branchId: selectedBranch || null,
        });
        setAttendanceSummary({
          data: result.data || [],
          present: result.present || [],
          late: result.late || [],
          absent: result.absent || [],
          isRange: false,
          total: (result.data || []).length,
        });
      } else {
        // Web mode: query Supabase
        if (rangeMode) {
          const { data: attData } = await supabase.from('attendance_daily').select('*, employees(first_name, last_name, employee_code, department), shifts(shift_start)').gte('date', dateFrom).lte('date', dateTo);
          buildAttendanceSummary(attData || [], true);
        } else {
          const { data: attData } = await supabase.from('attendance_daily').select('*, employees(first_name, last_name, employee_code, department), shifts(shift_start)').eq('date', selectedDate);
          buildAttendanceSummary(attData || [], false);
        }
      }
    } catch (err) {
      console.error('Summary load failed:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadDailyLogs = async () => {
    setLoading(true);
    try {
      const isDesktop = typeof window !== 'undefined' && '__TAURI__' in window;

      if (isDesktop) {
        // Desktop mode: use Tauri invoke to get logs from local SQLite
        const { invoke } = await import('@tauri-apps/api/core');
        const start = `${selectedDate}T00:00:00`;
        const end = `${selectedDate}T23:59:59`;
        const result = await invoke<any>('get_attendance_logs', {
          startDate: start,
          endDate: end,
        });
        const logs = (result.data || []).map((l: any) => ({
          ...l,
          id: l.id,
          name: l.employee_name || 'Unknown',
          employee_id: l.employee_id,
          employee_name: l.employee_name || 'Unknown',
          employee_code: l.employee_id,
          branch_name: l.branch_name || '-',
          all_punches: l.timestamp,
          timestamp: l.timestamp,
          punch_method: l.punch_method || 'Device',
          is_synced: l.is_synced || false,
        }));
        setDailyLogs(logs);

        // Also load history from local DB
        const histResult = await invoke<any>('get_attendance_logs', {});
        const histLogs = (histResult.data || []).map((l: any) => ({
          ...l,
          id: l.id,
          name: l.employee_name || 'Unknown',
          employee_id: l.employee_id,
          employee_name: l.employee_name || 'Unknown',
          timestamp: l.timestamp,
          punch_method: l.punch_method || 'Device',
          is_synced: l.is_synced || false,
        }));
        setAllHistoryLogs(histLogs);
      } else {
        // Web mode: query Supabase attendance_logs (raw punches)
        const startTime = `${selectedDate}T00:00:00`;
        const endTime = `${selectedDate}T23:59:59`;
        const { data } = await supabase
          .from('attendance_logs')
          .select('*, employees(first_name, last_name, employee_code, biometric_id), branches(name)')
          .gte('punch_time', startTime)
          .lte('punch_time', endTime)
          .order('punch_time', { ascending: false });
        const mapped = (data || []).map((l: any) => ({
          id: l.id,
          name: l.employees?.first_name ? `${l.employees.first_name} ${l.employees.last_name || ''}`.trim() : (l.employee_name || 'Unknown'),
          employee_id: l.employee_id,
          employee_name: l.employees?.first_name ? `${l.employees.first_name} ${l.employees.last_name || ''}`.trim() : 'Unknown',
          employee_code: l.employees?.employee_code || l.employee_id,
          branch_id: l.branch_id || 0,
          branch_name: l.branches?.name || l.branch_name || '-',
          gate_id: l.gate_id || 0,
          gate_name: l.gate_name || '-',
          device_id: l.device_id || 0,
          all_punches: l.punch_time ? new Date(l.punch_time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) + '::' + (l.punch_method || 'Device') : '',
          timestamp: l.punch_time,
          punch_method: l.punch_method || 'Device',
          is_synced: l.is_synced || false,
        }));
        setDailyLogs(mapped as any);

        if (activeTab === 'history') {
          supabase
            .from('attendance_logs')
            .select('*, employees(first_name, last_name, employee_code), branches(name)')
            .order('punch_time', { ascending: false })
            .limit(500)
            .then(({ data }) => {
              const histMapped = (data || []).map((l: any) => ({
                id: l.id,
                name: l.employees?.first_name ? `${l.employees.first_name} ${l.employees.last_name || ''}`.trim() : 'Unknown',
                employee_id: l.employee_id,
                employee_name: l.employees?.first_name ? `${l.employees.first_name} ${l.employees.last_name || ''}`.trim() : 'Unknown',
                branch_id: l.branch_id || 0,
                branch_name: l.branches?.name || l.branch_name || '-',
                gate_id: l.gate_id || 0,
                gate_name: l.gate_name || '-',
                device_id: l.device_id || 0,
                timestamp: l.punch_time,
                punch_method: l.punch_method || 'Device',
                is_synced: l.is_synced || false,
              }));
              setAllHistoryLogs(histMapped as any);
            });
        }
      }
    } catch (error) {
      console.error('Failed to load daily logs:', error);
    } finally {
      setLoading(false);
    }
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
    setSyncStatus(`Syncing logs from ${device.name}...`);
    try {
      // Pull logs directly from the biometric device via Tauri
      const { invoke } = await import('@tauri-apps/api/core');
      const logs = await invoke<any[]>('sync_device_logs', {
        ip: device.ip,
        port: device.port,
        deviceId: device.id,
        brand: device.brand,
        targetBranchId: device.branch_id || 1,
        targetGateId: device.gate_id || 1,
      });
      
      if (logs && logs.length > 0) {
        setSyncedLogs(logs);
        setShowPreview(true);
        setSyncStatus(`Pulled ${logs.length} logs from ${device.name}`);
      } else {
        setSyncStatus(`No new logs found on ${device.name}`);
      }
      loadDailyLogs();
      window.dispatchEvent(new CustomEvent('data-synced', { detail: { table: 'employees' } }));
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus(`Sync failed: ${error}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncStatus(''), 8000);
    }
  };

  const handleManualEntry = async () => {
    if (!manualForm.employeeId || !manualForm.date || !manualForm.time) {
      setManualStatus('Error: Please fill all fields');
      return;
    }
    setManualStatus('');
    try {
      const isDesktop = typeof window !== 'undefined' && '__TAURI__' in window;
      const timestamp = `${manualForm.date}T${manualForm.time}:00`;

      if (isDesktop) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('add_manual_attendance', {
          employeeId: Number(manualForm.employeeId),
          timestamp,
          punchMethod: manualForm.method,
        });
      } else {
        await supabase.from('attendance_logs').insert({
          employeeId: Number(manualForm.employeeId),
          timestamp: `${manualForm.date} ${manualForm.time}:00`,
          punchMethod: manualForm.method,
        });
      }
      setManualStatus('Attendance recorded successfully!');
      setManualForm({
        employeeId: '',
        date: new Date().toLocaleDateString('en-CA'),
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        method: 'Manual',
      });
      loadDailyLogs();
      setTimeout(() => setManualStatus(''), 3000);
    } catch (error) {
      setManualStatus('Failed: ' + error);
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
      setCsvStatus('Error: Please select a CSV file');
      return;
    }
    setCsvStatus('');
    try {
      const isDesktop = typeof window !== 'undefined' && '__TAURI__' in window;

      if (isDesktop) {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<any>('import_csv_attendance', { csvContent });
        setCsvStatus(`Imported ${result.imported}, Skipped ${result.skipped}`);
      } else {
        // Web mode: process CSV rows and insert via Supabase
        const lines = csvContent.trim().split('\n');
        let imported = 0;
        let skipped = 0;
        for (const line of lines) {
          const parts = line.split(',');
          if (parts.length >= 3) {
            const empId = parseInt(parts[0].trim());
            const date = parts[1].trim();
            const time = parts[2].trim();
            const method = parts[3]?.trim() || 'CSV';
            if (!isNaN(empId) && date && time) {
              const { error } = await supabase.from('attendance_logs').insert({
                employeeId: empId,
                timestamp: `${date} ${time}`,
                punchMethod: method,
              });
              if (error) skipped++;
              else imported++;
            } else {
              skipped++;
            }
          }
        }
        setCsvStatus(`Imported ${imported}, Skipped ${skipped}`);
      }
      loadDailyLogs();
      setTimeout(() => {
        setCsvStatus('');
        setCsvContent('');
      }, 3000);
    } catch (error) {
      setCsvStatus('Import failed: ' + error);
    }
  };

  const loadDepartments = async () => {
    try {
      const isDesktop = typeof window !== 'undefined' && '__TAURI__' in window;
      if (isDesktop) {
        const { invoke } = await import('@tauri-apps/api/core');
        const depts = await invoke<any[]>('list_departments');
        setDepartments(['All', ...depts.map((d: any) => d.name)]);
      } else {
        const { data } = await supabase.from('employees').select('department');
        const uniqueDepts = [...new Set((data || []).map((e: any) => e.department).filter(Boolean))];
        setDepartments(['All', ...uniqueDepts]);
      }
    } catch (e) { console.error(e); }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    setReportGenerated(true);
    try {
      const isDesktop = typeof window !== 'undefined' && '__TAURI__' in window;
      if (isDesktop) {
        const { invoke } = await import('@tauri-apps/api/core');
        const data = await invoke<any[]>('get_daily_reports', {
          fromDate: reportFromDate,
          toDate: reportToDate,
          dept: reportDept,
          search: reportSearch,
          employeeId: reportEmployeeId ? Number(reportEmployeeId) : null,
          branchId: reportBranch,
          gateId: null,
        });
        setReportData(data);
      } else {
        let query = supabase.from('attendance_daily').select('*, employees(first_name, last_name, employee_code, department)').order('date', { ascending: false }).order('employee_id');
        if (reportFromDate) query = query.gte('date', reportFromDate);
        if (reportToDate) query = query.lte('date', reportToDate);
        if (reportEmployeeId) query = query.eq('employee_id', Number(reportEmployeeId));
        if (reportBranch) query = query.eq('branch_id', reportBranch);
        const { data } = await query;
        let mapped = (data || []).map((d: any) => ({
          id: d.id,
          name: d.employees?.first_name ? `${d.employees.first_name} ${d.employees.last_name || ''}`.trim() : (d.employee_name || 'Unknown'),
          employee_code: d.employees?.employee_code || d.employee_id,
          department: d.employees?.department || d.department || '-',
          branch_name: d.branch_name || '-',
          date: d.date,
          all_punches: d.all_punches || d.first_in || '',
          method: d.punch_method || 'Device',
        }));
        if (reportDept !== 'All') mapped = mapped.filter((d: any) => d.department === reportDept);
        if (reportSearch) {
          const s = reportSearch.toLowerCase();
          mapped = mapped.filter((d: any) => d.name.toLowerCase().includes(s) || String(d.employee_code).includes(s));
        }
        setReportData(mapped);
      }
    } catch (e) { console.error(e); }
    setReportLoading(false);
  };

  const exportReportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4') as any;
    doc.setFontSize(16);
    doc.setTextColor(44, 62, 80);
    doc.text(AppConfig.appName.toUpperCase(), 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Daily Attendance Report', 14, 20);
    doc.line(14, 22, 280, 22);
    doc.setFontSize(11);
    doc.text(`Period: ${reportFromDate} to ${reportToDate}`, 14, 28);
    doc.autoTable({
      head: [['Device ID', 'User', 'Dept', 'Date', 'All Punches', 'Method', 'Branch']],
      body: reportData.map((d: any) => [d.employee_code || d.id, d.name, d.department, d.date, (d.all_punches || '').replace(/::/g, ' ').replace(/ \| /g, ', '), d.method, d.branch_name]),
      startY: 33,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [79, 70, 229] },
    });
    doc.save(`BioBridge_DailyReport_${Date.now()}.pdf`);
  };

  const exportReportExcel = () => {
    const wsData = reportData.map((d: any) => ({
      'Device ID': d.employee_code || d.id,
      'User': d.name,
      'Department': d.department,
      'Date': d.date,
      'All Punches': (d.all_punches || '').replace(/::/g, ' ').replace(/ \| /g, ', '),
      'Method': d.method,
      'Branch': d.branch_name,
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Report');
    XLSX.writeFile(wb, `BioBridge_DailyReport_${Date.now()}.xlsx`);
  };

  const todayStats = {
    totalPunches: dailyLogs.length,
    uniqueEmployees: new Set(dailyLogs.map(l => l.employee_id)).size,
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {devices.length === 0 ? (
            <Card className="md:col-span-3 border-dashed bg-muted/20">
              <CardContent className="h-20 flex items-center justify-center text-sm text-muted-foreground italic">
                No attendance devices found. Add a device in Device Settings first.
              </CardContent>
            </Card>
          ) : (
            devices
              .filter(device => !selectedBranch || device.branch_id === selectedBranch)
              .map(device => (
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

      <div className="flex gap-2 mb-6 border-b border-border">
        <TabButton
          icon={<Calendar className="w-4 h-4" />}
          label="Daily Attendance"
          active={activeTab === 'daily'}
          onClick={() => setActiveTab('daily')}
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
              >Logs View</button>
              <button
                onClick={() => { setDailyViewMode('summary'); loadSummary(); }}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  dailyViewMode === 'summary' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'
                }`}
              >Present / Absent / Late</button>
              <button
                onClick={() => setDailyViewMode('report')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  dailyViewMode === 'report' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'
                }`}
              >Daily Report</button>
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
                  <Button size="sm" className="h-9 text-xs" onClick={async () => {
                    if (dailyViewMode === 'logs') {
                    await loadDailyLogs();
                    } else {
                      loadSummary();
                    }
                  }}>Apply</Button>
                </>
              )}
            </div>
          </div>

          {/* SUMMARY VIEW */}
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
                          ? (attendanceSummary.summary || []).filter((s: any) => s.days_present > 0).length
                          : (attendanceSummary.present || []).filter((e: any) => !empFilter || String(e.id) === empFilter).length}
                      </p>
                      <p className="text-xs font-bold text-green-500 mt-1">{attendanceSummary.isRange ? 'Ever Present' : 'On Time'}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                      <p className="text-3xl font-black text-amber-600">
                        {attendanceSummary.isRange
                          ? (attendanceSummary.summary || []).reduce((acc: number, s: any) => acc + (s.days_late || 0), 0)
                          : (attendanceSummary.late || []).filter((e: any) => !empFilter || String(e.id) === empFilter).length}
                      </p>
                      <p className="text-xs font-bold text-amber-500 mt-1"> {attendanceSummary.isRange ? 'Total Late Days' : 'Late'}</p>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                      <p className="text-3xl font-black text-red-600">
                        {attendanceSummary.isRange
                          ? (attendanceSummary.summary || []).filter((s: any) => s.days_present === 0).length
                          : (attendanceSummary.absent || []).filter((e: any) => !empFilter || String(e.id) === empFilter).length}
                      </p>
                      <p className="text-xs font-bold text-red-500 mt-1"> {attendanceSummary.isRange ? 'Always Absent' : 'Absent'}</p>
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
                            <CheckCircle className="w-4 h-4" /> On Time ({(attendanceSummary.present || []).filter((e: any) => !empFilter || String(e.id) === empFilter).length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 max-h-72 overflow-y-auto">
                          {(attendanceSummary.present || [])
                            .filter((e: any) => !empFilter || String(e.id) === empFilter)
                            .map((emp: any) => (
                            <div key={emp.id} className="flex items-center justify-between px-4 py-2 border-b border-green-50 hover:bg-green-50/50">
                              <div>
                                <p className="text-sm font-semibold text-slate-700">{emp.name}</p>
                                <p className="text-[10px] text-slate-400">{emp.department || '-'}</p>
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
                            <Clock className="w-4 h-4" /> Late ({(attendanceSummary.late || []).filter((e: any) => !empFilter || String(e.id) === empFilter).length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 max-h-72 overflow-y-auto">
                          {(attendanceSummary.late || [])
                            .filter((e: any) => !empFilter || String(e.id) === empFilter)
                            .map((emp: any) => (
                            <div key={emp.id} className="flex items-center justify-between px-4 py-2 border-b border-amber-50 hover:bg-amber-50/50">
                              <div>
                                <p className="text-sm font-semibold text-slate-700">{emp.name}</p>
                                <p className="text-[10px] text-slate-400">{emp.department || '-'}</p>
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
                            <AlertCircle className="w-4 h-4" /> Absent ({(attendanceSummary.absent || []).filter((e: any) => !empFilter || String(e.id) === empFilter).length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 max-h-72 overflow-y-auto">
                          {(attendanceSummary.absent || [])
                            .filter((e: any) => !empFilter || String(e.id) === empFilter)
                            .map((emp: any) => (
                            <div key={emp.id} className="flex items-center justify-between px-4 py-2 border-b border-red-50 hover:bg-red-50/50">
                              <div>
                                <p className="text-sm font-semibold text-slate-700">{emp.name}</p>
                                <p className="text-[10px] text-slate-400">{emp.department || '-'}</p>
                              </div>
                              <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">-"</Badge>
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

          // LOGS VIEW
          {dailyViewMode === 'logs' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Attendance Logs - {rangeMode ? `${dateFrom} -> ${dateTo}` : selectedDate}</span>
                  <Badge variant="secondary">{dailyLogs.length} records</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => setSortConfig({key: 'name', direction: sortConfig?.key === 'name' && sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>
                        Member Name {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? '^' : 'v')}
                      </TableHead>
                      <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => setSortConfig({key: 'branch_name', direction: sortConfig?.key === 'branch_name' && sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>
                        Branch {sortConfig?.key === 'branch_name' && (sortConfig.direction === 'asc' ? '^' : 'v')}
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
                            <TableCell className="text-slate-500 text-sm">{log.branch_name || '-'}</TableCell>
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
                              <Badge variant="default" className="bg-green-50 text-green-700 border-green-100 text-[10px]"> Saved Log</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
           )}
          {/* REPORT VIEW */}
          {dailyViewMode === 'report' && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[130px]">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Branch</Label>
                      <select
                        value={reportBranch?.toString() || ''}
                        onChange={e => setReportBranch(e.target.value ? Number(e.target.value) : null)}
                        className="h-9 px-3 text-xs rounded-lg border border-slate-200 bg-white w-full"
                      >
                        <option value="">All Branches</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="min-w-[130px]">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Department</Label>
                      <select
                        value={reportDept}
                        onChange={e => setReportDept(e.target.value)}
                        className="h-9 px-3 text-xs rounded-lg border border-slate-200 bg-white w-full"
                        onFocus={() => { if (departments.length <= 1) loadDepartments(); }}
                      >
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="min-w-[140px]">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">From</Label>
                      <Input type="date" value={reportFromDate} onChange={e => setReportFromDate(e.target.value)} className="h-9 font-mono text-xs" />
                    </div>
                    <div className="min-w-[140px]">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">To</Label>
                      <Input type="date" value={reportToDate} onChange={e => setReportToDate(e.target.value)} className="h-9 font-mono text-xs" />
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Employee</Label>
                      <select
                        value={reportEmployeeId}
                        onChange={e => { const v = e.target.value; setReportEmployeeId(v); if (v) setReportSearch(''); }}
                        className="h-9 px-3 text-xs rounded-lg border border-slate-200 bg-white w-full"
                      >
                        <option value="">All Employees</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name || emp.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          placeholder="Name or Bio-ID..."
                          value={reportSearch}
                          onChange={e => { setReportSearch(e.target.value); if (reportEmployeeId) setReportEmployeeId(''); }}
                          className="pl-8 h-9 text-xs"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleGenerateReport}
                      disabled={reportLoading}
                      className="h-9 bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-md shadow-primary/10 rounded-lg px-6 flex items-center gap-2"
                    >
                      {reportLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <><Play className="h-4 w-4" /> GENERATE</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {!reportGenerated ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <FolderOpen className="h-16 w-16 text-slate-200" />
                  <p className="text-slate-400 text-sm italic">Configure filters above and click GENERATE to fetch the attendance report.</p>
                </div>
              ) : reportLoading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary opacity-30" />
                </div>
              ) : (
                <Card className="border-2 border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="bg-slate-50 dark:bg-slate-900 border-b p-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-bold text-sm">Attendance Report Ready</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono text-xs">{reportData.length} Records</Badge>
                      <Button variant="outline" size="sm" onClick={exportReportExcel} className="h-8 text-xs">
                        <Download className="h-3 w-3 mr-1" /> XLSX
                      </Button>
                      <Button variant="default" size="sm" onClick={exportReportPDF} className="h-8 text-xs bg-slate-900 hover:bg-slate-800">
                        <Download className="h-3 w-3 mr-1" /> PDF
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                          <TableHead className="font-bold text-[9px] uppercase">Device ID</TableHead>
                          <TableHead className="font-bold text-[9px] uppercase">User</TableHead>
                          <TableHead className="font-bold text-[9px] uppercase">Date</TableHead>
                          <TableHead className="font-bold text-[9px] uppercase">All Punches</TableHead>
                          <TableHead className="font-bold text-[9px] uppercase">Method</TableHead>
                          <TableHead className="font-bold text-[9px] uppercase text-right">Branch</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.map((d: any, i: number) => (
                          <TableRow key={i} className="hover:bg-slate-50/80 transition-colors">
                            <TableCell className="font-mono text-xs text-slate-400 font-bold">#{d.employee_code || d.id}</TableCell>
                            <TableCell className="py-3">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{d.name}</div>
                              <div className="text-[10px] text-slate-400 font-medium uppercase">{d.department}</div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{d.date}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1.5">
                                {(d.all_punches ? d.all_punches.split(' | ') : []).map((p_str: string, pi: number) => {
                                  const parts = p_str.split('::');
                                  const p = parts[0];
                                  return (
                                    <div key={pi} className="flex flex-col items-center">
                                      <Badge variant="outline" className="text-[10px] font-black py-0.5 px-2 border-primary/20 bg-primary/5 text-primary">
                                        {p}
                                      </Badge>
                                      {pi === 0 && <span className="text-[8px] text-slate-400 font-bold uppercase">In</span>}
                                      {pi === (d.all_punches.split(' | ').length - 1) && pi > 0 && <span className="text-[8px] text-slate-400 font-bold uppercase">Out</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[9px] font-black uppercase px-2">{d.method || 'Device'}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-xs text-slate-500 uppercase">{d.branch_name || 'Main Office'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </div>
          )}
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
                manualStatus.includes('Error') || manualStatus.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
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
                  csvStatus.includes('Error') || csvStatus.includes('Failed') || csvStatus.includes('failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
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
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>X</Button>
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
              }}>Save and Close</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// Tab Button Component

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

