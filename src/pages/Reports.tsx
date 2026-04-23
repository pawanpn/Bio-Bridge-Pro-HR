import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Download, Search, RefreshCw, Calculator, Fingerprint, ScanFace, Database, FolderOpen, Play, CheckCircle2, ChevronRight, FileText, Calendar, Wallet } from 'lucide-react';

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
  employee_code: string;
  department: string;
  branch_name: string;
  date: string;
  first_in: string;
  last_out: string;
  all_punches: string;
  method: string;
  status: string;
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
  { key: 'daily' as const, label: 'Daily Attendance', icon: <Calendar className="h-4 w-4" /> },
  { key: 'ledger' as const, label: 'Monthly Ledger', icon: <FileText className="h-4 w-4" /> },
  { key: 'salary' as const, label: 'Salary Sheet', icon: <Wallet className="h-4 w-4" /> },
  { key: 'raw' as const, label: 'Attendance Logs', icon: <Database className="h-4 w-4" /> },
];

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'daily' | 'ledger' | 'salary' | 'raw'>('daily');
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
  const [hasGenerated, setHasGenerated] = useState(false);

  const [dailyData, setDailyData] = useState<DailyAttendance[]>([]);
  const [ledgerData, setLedgerData] = useState<MonthlyLedger[]>([]);
  const [salaryData, setSalaryData] = useState<SalarySheet[]>([]);
  const [rawData, setRawData] = useState<RawLog[]>([]);

  const calendarMode = localStorage.getItem('calendarMode') || 'AD';

  useEffect(() => {
    loadMetadata();
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
      const depts = await invoke<any[]>('list_departments');
      setDepartments(['All', ...depts.map(d => d.name)]);
      const brs = await invoke<Branch[]>('list_branches');
      setBranches(brs);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setHasGenerated(true);
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
    const doc = new jsPDF('l', 'mm', 'a4') as any;
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
      headStyles: { fillColor: [79, 70, 229] }
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

  // Ledger Helper: Days in month
  const getDaysInMonth = () => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'success' | 'warning' | 'destructive' => {
    if (status === 'On-time' || status === 'P' || status === 'Present') return 'success';
    if (status === 'Late' || status === 'L') return 'warning';
    return 'destructive';
  };

  return (
    <div className="p-4 pt-2 max-w-[1700px] mx-auto space-y-4 animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="-mt-4">
           <Badge variant="outline" className="mb-0.5 px-2 py-0 border-primary/20 text-primary bg-primary/5 text-[9px]">
              <Database className="h-2.5 w-2.5 mr-1" /> HR Reporting Engine
           </Badge>
           <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">Workforce Insights</h1>
           <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-xs">Precision analytics for payroll and operational visibility.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {hasGenerated && (
            <>
              <Button variant="outline" onClick={exportExcel} className="h-11 shadow-sm px-6">
                <Download className="h-4 w-4 mr-2" /> Export XLSX
              </Button>
              <Button variant="default" onClick={exportPDF} className="h-11 shadow-md px-6 bg-slate-900 hover:bg-slate-800">
                <Download className="h-4 w-4 mr-2" /> PDF Report
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Horizontal Configuration Bar */}
        <Card className="border-none shadow-xl bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-30">
           <CardContent className="p-3">
              <div className="flex flex-col lg:flex-row items-start gap-4">
                 {/* Step 1: Style Selection */}
                 <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                       <span className="bg-primary text-white h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold">1</span>
                       <h3 className="font-bold text-slate-500 uppercase tracking-widest text-[9px]">Style</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                       {tabs.map(tab => (
                          <button
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); setHasGenerated(false); }}
                            className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left ${
                              activeTab === tab.key
                                ? 'bg-white dark:bg-slate-800 border-primary shadow-sm ring-2 ring-primary/5'
                                : 'bg-slate-100/50 dark:bg-slate-800/30 border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                             <div className={`p-1.5 rounded flex-shrink-0 ${activeTab === tab.key ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                {React.cloneElement(tab.icon as React.ReactElement, { size: 14 })}
                             </div>
                             <span className={`text-[10px] font-bold leading-tight ${activeTab === tab.key ? 'text-primary' : 'text-slate-600 dark:text-slate-400'}`}>{tab.label}</span>
                          </button>
                       ))}
                    </div>
                 </div>

                 {/* Step 2: Parameters */}
                 <div className="flex-[2] space-y-3">
                    <div className="flex items-center gap-2">
                       <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                       <h3 className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Configure Parameters</h3>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[120px]">
                           <Label className="text-[9px] uppercase font-bold text-slate-400 mb-1 block">Branch</Label>
                           <Select value={branch?.toString() || ''} onChange={e => setBranch(Number(e.target.value) || null)} className="h-9 text-xs">
                              <option value="">All Branches</option>
                              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                           </Select>
                        </div>
                        <div className="min-w-[120px]">
                           <Label className="text-[9px] uppercase font-bold text-slate-400 mb-1 block">Department</Label>
                           <Select value={department} onChange={e => setDepartment(e.target.value)} className="h-9 text-xs">
                              {departments.map(d => <option key={d} value={d}>{d}</option>)}
                           </Select>
                        </div>

                        {activeTab === 'ledger' || activeTab === 'salary' ? (
                          <div className="min-w-[150px]">
                             <Label className="text-[9px] uppercase font-bold text-slate-400 mb-1 block">Period</Label>
                             <div className="relative">
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="pl-8 h-9 text-xs font-mono font-bold" />
                             </div>
                          </div>
                        ) : (
                          <>
                             <div className="min-w-[130px]">
                                <Label className="text-[9px] uppercase font-bold text-slate-400 mb-1 block">From</Label>
                                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-9 font-mono text-xs" />
                             </div>
                             <div className="min-w-[130px]">
                                <Label className="text-[9px] uppercase font-bold text-slate-400 mb-1 block">To</Label>
                                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-9 font-mono text-xs" />
                             </div>
                          </>
                        )}

                        <div className="flex-1 min-w-[180px]">
                           <Label className="text-[9px] uppercase font-bold text-slate-400 mb-1 block">Search Employee</Label>
                           <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                              <Input 
                                 placeholder="Name or ID..." 
                                 value={search} 
                                 onChange={e => setSearch(e.target.value)}
                                 className="pl-8 h-9 text-xs italic" 
                              />
                           </div>
                        </div>

                        <Button 
                           onClick={handleGenerate} 
                           disabled={loading}
                           className="h-9 bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-md shadow-primary/10 rounded-lg px-6 flex items-center justify-center gap-2"
                        >
                           {loading ? (
                             <RefreshCw className="h-4 w-4 animate-spin" />
                           ) : (
                             <><Play className="h-4 w-4" /> GENERATE</>
                           )}
                        </Button>
                    </div>
                 </div>
              </div>
           </CardContent>
        </Card>

        {/* Full Width Report Preview Area */}
        <div className="w-full flex flex-col min-h-[600px]">
           <Card className="flex-1 border-2 border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
              {!hasGenerated ? (
                 <div className="flex flex-col items-center justify-center h-full text-center p-12 space-y-6">
                    <div className="relative">
                       <FolderOpen className="h-24 w-24 text-slate-200 dark:text-slate-800 opacity-50" />
                       <ChevronRight className="h-10 w-10 text-primary absolute -bottom-2 -right-2 animate-bounce" />
                    </div>
                    <div className="space-y-2 max-w-sm">
                       <h3 className="text-2xl font-bold text-slate-400">Live Preview Container</h3>
                       <p className="text-slate-400 dark:text-slate-600 text-sm italic">
                          Click <strong>GENERATE REVIEW</strong> in the sidebar to fetch real-time data from the database and calculate attendance trends.
                       </p>
                    </div>
                 </div>
              ) : loading ? (
                 <div className="flex flex-col items-center justify-center h-full space-y-6 bg-slate-50/50">
                    <div className="relative">
                       <div className="h-16 w-16 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
                       <RefreshCw className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-primary font-bold animate-pulse text-lg tracking-widest uppercase">Crunching Real-Time Logs...</p>
                 </div>
              ) : (
                 <div className="p-0 animate-in slide-in-from-bottom-5 duration-500">
                    <div className="bg-slate-50 dark:bg-slate-900 border-b p-4 flex justify-between items-center">
                       <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <span className="font-bold text-sm tracking-tight capitalize">{activeTab.replace('_', ' ')} Calculations Ready</span>
                       </div>
                       <Badge variant="outline" className="font-mono text-xs text-slate-400 border-slate-200">
                          {activeTab === 'daily' ? dailyData.length : activeTab === 'ledger' ? ledgerData.length : activeTab === 'salary' ? salaryData.length : rawData.length} Records Found
                       </Badge>
                    </div>

                    <div className="overflow-x-auto">
                       {activeTab === 'daily' && <DailyTable data={dailyData} />}
                       {activeTab === 'ledger' && <LedgerTable data={ledgerData} days={getDaysInMonth()} />}
                       {activeTab === 'salary' && <SalaryTable data={salaryData} />}
                       {activeTab === 'raw' && <RawTable data={rawData} />}
                    </div>
                 </div>
              )}
           </Card>
        </div>
      </div>
    </div>
  );
};

// --- Sub Tables ---

const DailyTable = ({ data }: { data: DailyAttendance[] }) => (
  <Table>
    <TableHeader className="bg-slate-100 dark:bg-slate-800">
      <TableRow>
        <TableHead className="font-bold text-[9px] uppercase w-[100px]">Device ID</TableHead>
        <TableHead className="font-bold text-[9px] uppercase w-[200px]">User</TableHead>
        <TableHead className="font-bold text-[9px] uppercase w-[120px]">Date</TableHead>
        <TableHead className="font-bold text-[9px] uppercase min-w-[250px]">Time (All Punches)</TableHead>
        <TableHead className="font-bold text-[9px] uppercase w-[100px]">Method</TableHead>
        <TableHead className="font-bold text-[9px] uppercase text-right w-[150px]">Branch</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {data.map((d, i) => {
        const punchArray = d.all_punches.split(' | ');
        return (
          <TableRow key={i} className="hover:bg-slate-50/80 transition-colors">
            <TableCell className="font-mono text-xs text-slate-400 font-bold">#{d.employee_code || d.id}</TableCell>
            <TableCell className="py-4">
              <div className="font-bold text-slate-900 dark:text-slate-100">{d.name}</div>
              <div className="text-[10px] text-slate-400 font-medium uppercase">{d.department}</div>
            </TableCell>
            <TableCell className="font-mono text-xs">{d.date}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1.5">
                {punchArray.map((p, pi) => (
                  <div key={pi} className="flex flex-col">
                    <Badge variant="outline" className="text-[10px] font-black py-0.5 px-2 border-primary/20 bg-primary/5 text-primary">
                      {p}
                    </Badge>
                    {pi === 0 && <span className="text-[8px] text-center text-slate-400 font-bold uppercase">In</span>}
                    {pi === punchArray.length - 1 && pi > 0 && <span className="text-[8px] text-center text-slate-400 font-bold uppercase">Out</span>}
                  </div>
                ))}
              </div>
            </TableCell>
            <TableCell>
               <Badge variant="secondary" className="text-[9px] font-black uppercase px-2">
                  {d.method || 'Finger'}
               </Badge>
            </TableCell>
            <TableCell className="text-right font-bold text-xs text-slate-500 uppercase tracking-tighter">
               {d.branch_name || 'Main Office'}
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  </Table>
);

const LedgerTable = ({ data, days }: { data: MonthlyLedger[], days: number }) => (
  <div className="w-full">
    <Table className="border-collapse">
      <TableHeader className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-20 shadow-sm">
        <TableRow>
          <TableHead className="sticky left-0 bg-slate-100 dark:bg-slate-800 z-30 min-w-[150px] font-black uppercase text-[10px]">Staff Profile</TableHead>
          {Array.from({ length: days }).map((_, i) => (
            <TableHead key={i} className="w-[30px] text-center p-2 text-[9px] font-bold border-l border-slate-200">
              {(i + 1).toString().padStart(2, '0')}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((l, i) => (
          <TableRow key={i} className="border-b">
            <TableCell className="sticky left-0 bg-white dark:bg-slate-900 z-10 border-r-4 border-primary font-bold text-xs py-3">
              {l.name}
            </TableCell>
            {Array.from({ length: days }).map((_, di) => {
              const day = (di + 1).toString().padStart(2, '0');
              const status = l.attendance[day] || 'A';
              return (
                <TableCell key={di} className="p-1 text-center border-l border-slate-50 dark:border-slate-800">
                  <div className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[9px] font-black shadow-sm ${
                    status === 'P'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-rose-50 text-rose-300 dark:bg-rose-900/20 dark:text-rose-800'
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
);

const SalaryTable = ({ data }: { data: SalarySheet[] }) => (
  <Table>
    <TableHeader className="bg-slate-100 dark:bg-slate-800">
      <TableRow>
        <TableHead className="font-bold text-xs">EMPLOYEE</TableHead>
        <TableHead className="font-bold text-xs">PRESENT DAYS</TableHead>
        <TableHead className="font-bold text-xs">PAID LEAVES</TableHead>
        <TableHead className="font-bold text-xs">TOTAL PAYABLE</TableHead>
        <TableHead className="font-bold text-xs text-right">ACTION</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {data.map((s, i) => (
        <TableRow key={i}>
          <TableCell className="py-4">
            <div className="font-bold">{s.name}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">{s.department}</div>
          </TableCell>
          <TableCell className="font-bold text-blue-600">{s.present_days}</TableCell>
          <TableCell className="italic text-slate-400">{s.paid_leaves}</TableCell>
          <TableCell className="text-lg font-black text-primary p-4 bg-primary/5">{s.payable_days}</TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm" className="text-primary font-black text-xs hover:bg-primary/10">
              ADJUSTMENT
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

const RawTable = ({ data }: { data: RawLog[] }) => (
  <Table>
    <TableHeader className="bg-slate-100 dark:bg-slate-800">
      <TableRow>
        <TableHead className="font-extrabold text-[10px]">PUNCH ID</TableHead>
        <TableHead className="font-extrabold text-[10px]">USER</TableHead>
        <TableHead className="font-extrabold text-[10px]">DATETIME</TableHead>
        <TableHead className="font-extrabold text-[10px]">METHOD</TableHead>
        <TableHead className="font-extrabold text-[10px]">BRANCH/GATE</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {data.map((r, i) => {
        const dt = r.timestamp || '';
        const method = (r.type || 'FINGER').toUpperCase();
        const isFace = method.includes('FACE') || method === '1';
        return (
          <TableRow key={i} className="font-mono text-xs">
            <TableCell className="text-slate-300">#{(i+1).toString().padStart(4, '0')}</TableCell>
            <TableCell className="font-bold text-slate-800 dark:text-slate-200">{r.name}</TableCell>
            <TableCell className="text-blue-500 font-bold">{dt}</TableCell>
            <TableCell>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black ${
                isFace ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white'
              }`}>
                {isFace ? <ScanFace size={12} /> : <Fingerprint size={12} />}
                {isFace ? 'FACE' : 'FINGER'}
              </div>
            </TableCell>
            <TableCell className="text-slate-400 font-bold tracking-tight">{r.device || 'Head Office'}</TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  </Table>
);
