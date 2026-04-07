import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Download, Search, RefreshCw, Calculator, Fingerprint, ScanFace, Database, FolderOpen } from 'lucide-react';

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AppConfig } from '../config/appConfig';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

// Types
interface DailyAttendance {
  id: number;
  name: string;
  department: string;
  date: string;
  check_in: string;
  check_out: string;
  status: string;
  late_entry: string;
  early_exit: string;
  working_hours: string;
}

interface MonthlyLedger {
  id: number;
  name: string;
  attendance: { [day: string]: string };
}

interface SalarySheet {
  id: number;
  name: string;
  department: string;
  present_days: number;
  paid_leaves: number;
  payable_days: number;
}

interface RawLog {
  id: number;
  name: string;
  timestamp: string;
  type: string;
  device: string;
}

interface Branch {
  id: number;
  name: string;
}

const tabs = [
  { key: 'daily' as const, label: 'Daily Attendance' },
  { key: 'ledger' as const, label: 'Monthly Ledger' },
  { key: 'salary' as const, label: 'Salary Sheet' },
  { key: 'raw' as const, label: 'Attendance Logs' },
];

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'daily' | 'ledger' | 'salary' | 'raw' | 'absent'>('daily');
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [department, setDepartment] = useState('All');
  const [branch, setBranch] = useState<number | null>(null);
  const [gate, setGate] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [gates, setGates] = useState<{id: number, name: string}[]>([]);
  const [departments, setDepartments] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(false);

  const [dailyData, setDailyData] = useState<DailyAttendance[]>([]);
  const [ledgerData, setLedgerData] = useState<MonthlyLedger[]>([]);
  const [salaryData, setSalaryData] = useState<SalarySheet[]>([]);
  const [rawData, setRawData] = useState<RawLog[]>([]);

  const calendarMode = localStorage.getItem('calendarMode') || 'AD';

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab, fromDate, toDate, month, department, branch, gate]);

  useEffect(() => {
     const unlisten = listen('attendance-sync-complete', (event) => {
        console.log('Attendance sync event:', event.payload);
        fetchData();
     });
     return () => { unlisten.then(f => f()); };
  }, []);

  useEffect(() => {
    if (branch) {
      invoke<{id: number, name: string}[]>('list_gates', { branchId: branch })
        .then(res => { setGates(res || []); setGate(null); })
        .catch(console.error);
    } else {
      setGates([]);
      setGate(null);
    }
  }, [branch]);

  const loadMetadata = async () => {
    try {
      const depts = await invoke<string[]>('get_departments');
      setDepartments(depts);
      const brs = await invoke<Branch[]>('list_branches');
      setBranches(brs);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'daily') {
        const data = await invoke<DailyAttendance[]>('get_daily_reports', { fromDate, toDate, dept: department, search, branchId: branch, gateId: gate });
        setDailyData(data);
      } else if (activeTab === 'ledger') {
        const data = await invoke<MonthlyLedger[]>('get_monthly_ledger', { yearMonth: month, branchId: branch, gateId: gate, dept: department });
        setLedgerData(data);
      } else if (activeTab === 'salary') {
        const data = await invoke<SalarySheet[]>('get_salary_sheet', { yearMonth: month, branchId: branch, gateId: gate });
        setSalaryData(data);
      } else if (activeTab === 'raw') {
        const data = await invoke<RawLog[]>('get_raw_logs', { fromDate, toDate, search, branchId: branch, gateId: gate });
        setRawData(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4') as any; // Landscape

    // Company Header
    doc.setFontSize(18);
    doc.setTextColor(44, 62, 80);
    doc.text(AppConfig.appName.toUpperCase(), 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Organization Attendance & HR Report", 14, 20);
    doc.line(14, 22, 280, 22);

    const title = activeTab.toUpperCase() + " REPORT";
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(title, 14, 30);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 230, 20);

    const tableHeaders =
        activeTab === 'daily' ? [['Name', 'Dept', 'Date', 'In', 'Out', 'Late', 'Early', 'Hours', 'Status']] :
        activeTab === 'ledger' ? [['Name', ...Array.from({length: 31}, (_, i) => (i+1).toString())]] :
        activeTab === 'salary' ? [['Name', 'Dept', 'Present', 'Leaves', 'Payable Days']] :
        [['Name', 'Timestamp', 'Device']];

    const tableData =
        activeTab === 'daily' ? dailyData.map(d => [d.name, d.department, d.date, d.check_in, d.check_out, d.late_entry, d.early_exit, d.working_hours, d.status]) :
        activeTab === 'ledger' ? ledgerData.map(l => [l.name, ...Array.from({length: 31}, (_, i) => l.attendance[(i+1).toString().padStart(2, '0')] || 'A')]) :
        activeTab === 'salary' ? salaryData.map(s => [s.name, s.department, s.present_days, s.paid_leaves, s.payable_days]) :
        rawData.map(r => [r.name, r.timestamp, r.device]);

    doc.autoTable({
      head: tableHeaders,
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillStyle: 'var(--primary-color)' }
    });

    doc.save(`BioBridge_${activeTab}_${new Date().getTime()}.pdf`);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
        activeTab === 'daily' ? dailyData :
        activeTab === 'ledger' ? ledgerData.map(l => ({ Employee: l.name, ...l.attendance })) :
        activeTab === 'salary' ? salaryData : rawData
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `BioBridge_${activeTab}_Report.xlsx`);
  };

  const exportUSB = async () => {
    try {
      setLoading(true);
      const path = await invoke<string>('export_usb_db');
      alert(`USB Backup Database created successfully at:\n${path}`);
    } catch (e) {
      alert(`Export Failed: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Ledger Helper: Days in month
  const getDaysInMonth = () => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'success' | 'warning' | 'destructive' => {
    if (status === 'On-time' || status === 'P') return 'success';
    if (status === 'Late' || status === 'L') return 'warning';
    return 'destructive';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold tracking-tight">HR Reporting Engine</h1>
           <p className="text-sm text-muted-foreground mt-1">Enterprise attendance analysis and payroll reconciliation</p>
        </div>
        <div className="flex flex-wrap gap-2">
             <Button variant="outline" onClick={fetchData} disabled={loading}>
               <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Recalculate
             </Button>
             {activeTab === 'raw' && (
                <Button variant="outline" className="text-blue-500 border-blue-500/30 hover:bg-blue-500/10" onClick={exportUSB} disabled={loading}>
                  <Database className="h-4 w-4" /> Export to USB (.db)
                </Button>
             )}
             <Button variant="secondary" onClick={exportExcel}>
               <Download className="h-4 w-4" /> XLSX
             </Button>
             <Button onClick={exportPDF}>
               <Download className="h-4 w-4" /> PDF
             </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg border">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide">Branch</Label>
              <Select value={branch?.toString() || ''} onChange={e => setBranch(Number(e.target.value) || null)}>
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide">Gate / Location</Label>
              <Select value={gate?.toString() || ''} onChange={e => setGate(Number(e.target.value) || null)} disabled={!branch}>
                <option value="">All Gates</option>
                {gates.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide">Department</Label>
              <Select value={department} onChange={e => setDepartment(e.target.value)}>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>

            {activeTab === 'ledger' || activeTab === 'salary' ? (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide">Month</Label>
                  <Input type="month" value={month} onChange={e => setMonth(e.target.value)} />
                </div>
            ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide">From {calendarMode === 'BS' ? '(AD)' : ''}</Label>
                    <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide">To {calendarMode === 'BS' ? '(AD)' : ''}</Label>
                    <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
                  </div>
                </>
            )}

            <div className="space-y-2">
               <Label className="text-xs uppercase tracking-wide">Employee Search</Label>
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Name or ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
               </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Section */}
      <Card className="shadow-sm">
        {loading ? (
          <CardContent className="flex flex-col items-center justify-center h-64 gap-4">
            <RefreshCw className="h-10 w-10 text-primary animate-spin" />
            <span className="text-sm text-muted-foreground">Crunching attendance data...</span>
          </CardContent>
        ) : (
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {activeTab === 'daily' && (
                dailyData.length === 0 ? (
                  <NoDataView message="No daily attendance logs found for selected filters." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>In Time</TableHead>
                        <TableHead>Out Time</TableHead>
                        <TableHead>Work Hrs</TableHead>
                        <TableHead>Late</TableHead>
                        <TableHead>Early</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyData.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <div>
                              <div className="font-semibold">{d.name}</div>
                              <div className="text-xs text-muted-foreground">{d.department}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{d.check_in.split(' ')[1] || d.check_in}</TableCell>
                          <TableCell className="font-mono text-sm">{d.check_out.split(' ')[1] || d.check_out}</TableCell>
                          <TableCell className="font-bold">{d.working_hours}</TableCell>
                          <TableCell className={d.late_entry === 'Yes' ? 'text-red-500 font-medium' : 'text-green-500 font-medium'}>
                            {d.late_entry}
                          </TableCell>
                          <TableCell className={d.early_exit === 'Yes' ? 'text-red-500 font-medium' : 'text-green-500 font-medium'}>
                            {d.early_exit}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(d.status)} className="uppercase text-xs">
                              {d.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              )}

              {activeTab === 'ledger' && (
                ledgerData.length === 0 ? (
                  <NoDataView message="No monthly statistics found for this month." />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-muted z-10 min-w-[150px]">Employee</TableHead>
                          {Array.from({ length: getDaysInMonth() }).map((_, i) => (
                            <TableHead key={i} className="w-[35px] text-center p-2">
                              {(i + 1).toString().padStart(2, '0')}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerData.map((l, i) => (
                          <TableRow key={i}>
                            <TableCell className="sticky left-0 bg-card z-5 border-r min-w-[150px]">
                              <div className="font-semibold text-sm">{l.name}</div>
                            </TableCell>
                            {Array.from({ length: getDaysInMonth() }).map((_, di) => {
                              const day = (di + 1).toString().padStart(2, '0');
                              const status = l.attendance[day] || 'A';
                              return (
                                <TableCell key={di} className="p-1 text-center">
                                  <div className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${
                                    status === 'P'
                                      ? 'bg-green-500/10 text-green-500'
                                      : 'bg-red-500/10 text-red-500'
                                  }`}>
                                    {status}
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}

              {activeTab === 'salary' && (
                salaryData.length === 0 ? (
                  <NoDataView message="No salary sheet data available for selected month." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Present Days</TableHead>
                        <TableHead>Paid Leaves</TableHead>
                        <TableHead>Total Payable</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaryData.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <div className="font-semibold">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.department}</div>
                          </TableCell>
                          <TableCell>{s.present_days}</TableCell>
                          <TableCell>{s.paid_leaves}</TableCell>
                          <TableCell className="text-lg font-bold text-primary">{s.payable_days}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="text-primary font-semibold text-xs gap-1 h-7">
                              <Calculator className="h-3 w-3" /> Adjustment
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              )}

              {activeTab === 'raw' && (
                rawData.length === 0 ? (
                  <NoDataView message="No attendance logs found. Sync your device to populate records." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead>Employee Name</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Punch Method</TableHead>
                        <TableHead>Device</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rawData.map((r, i) => {
                        const dt = r.timestamp || '';
                        const datePart = dt.length >= 10 ? dt.substring(0, 10) : dt;
                        const timePart = dt.length >= 16 ? dt.substring(11, 16) : '';
                        const method = (r.type || 'FINGER').toUpperCase();
                        const isFace = method.includes('FACE') || method === '1';
                        return (
                          <TableRow key={i}>
                            <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                            <TableCell>
                              <div className="font-bold">{r.name}</div>
                              <div className="text-xs text-muted-foreground">ID #{r.id}</div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{datePart}</TableCell>
                            <TableCell className="font-mono font-bold text-primary">{timePart}</TableCell>
                            <TableCell>
                              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                                isFace
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : 'bg-green-500/10 text-green-500'
                              }`}>
                                {isFace
                                  ? <><ScanFace className="h-3.5 w-3.5" /> Face</>
                                  : <><Fingerprint className="h-3.5 w-3.5" /> Finger</>
                                }
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{r.device}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

// UI Components
const NoDataView = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-16 px-5 text-center border border-dashed border-border m-5 rounded-lg">
    <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
    <h3 className="text-lg font-semibold">No Records Found</h3>
    <p className="text-sm text-muted-foreground mt-2">{message}</p>
  </div>
);
