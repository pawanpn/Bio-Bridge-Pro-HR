import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Download, Search, RefreshCw, Calculator, Fingerprint, ScanFace, Database } from 'lucide-react';

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AppConfig } from '../config/appConfig';

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


  return (
    <div style={{ padding: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
           <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: 'var(--text-color)' }}>HR Reporting Engine</h1>
           <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>Enterprise attendance analysis and payroll reconciliation</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
             <button onClick={fetchData} style={secondaryBtnStyle} disabled={loading}><RefreshCw size={14} className={loading?"animate-spin":""} /> Recalculate</button>
             {activeTab === 'raw' && (
                <button onClick={exportUSB} style={{...secondaryBtnStyle, borderColor: '#3b82f6', color: '#3b82f6'}} disabled={loading}>
                  <Database size={14} /> Export to USB (.db)
                </button>
             )}
             <button onClick={exportExcel} style={primaryBtnStyle}><Download size={14} /> XLSX</button>
             <button onClick={exportPDF} style={primaryBtnStyle}><Download size={14} /> PDF</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', padding: '4px', backgroundColor: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
       <Tab active={activeTab === 'daily'} onClick={() => setActiveTab('daily')}>Daily Attendance</Tab>
         <Tab active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')}>Monthly Ledger</Tab>
         <Tab active={activeTab === 'salary'} onClick={() => setActiveTab('salary')}>Salary Sheet</Tab>
         <Tab active={activeTab === 'raw'} onClick={() => setActiveTab('raw')}>Attendance Logs</Tab>
      </div>

      {/* Filters Card */}
      <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: '12px', padding: '20px', marginBottom: '24px', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Branch</label>
            <select style={inputStyle} value={branch || ''} onChange={e => setBranch(Number(e.target.value) || null)}>
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Gate / Location</label>
            <select style={inputStyle} value={gate || ''} onChange={e => setGate(Number(e.target.value) || null)} disabled={!branch}>
                <option value="">All Gates</option>
                {gates.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Department</label>
            <select style={inputStyle} value={department} onChange={e => setDepartment(e.target.value)}>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          
          {activeTab === 'ledger' || activeTab === 'salary' ? (
              <div>
                <label style={labelStyle}>Month</label>
                <input type="month" style={inputStyle} value={month} onChange={e => setMonth(e.target.value)} />
              </div>
          ) : (
              <>
                <div>
                  <label style={labelStyle}>From {calendarMode==='BS'?'(AD)':''}</label>
                  <input type="date" style={inputStyle} value={fromDate} onChange={e => setFromDate(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>To {calendarMode==='BS'?'(AD)':''}</label>
                  <input type="date" style={inputStyle} value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
              </>
          )}

          <div>
             <label style={labelStyle}>Employee Search</label>
             <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                <input style={{ ...inputStyle, paddingLeft: '32px' }} placeholder="Name or ID..." value={search} onChange={e => setSearch(e.target.value)} />
             </div>
          </div>
      </div>

      {/* Data Section */}
      <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          {loading ? (
              <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                  <RefreshCw size={40} color="var(--primary-color)" className="animate-spin" />
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Crunching attendance data...</span>
              </div>
          ) : (
              <div style={{ overflowX: 'auto' }}>
                   {activeTab === 'daily' && (
                      dailyData.length === 0 ? (
                        <NoDataView message="No daily attendance logs found for selected filters." />
                      ) : (
                        <table style={tableStyle}>
                            <thead>
                                <tr style={rowStyle}>
                                    <th style={thStyle}>Employee</th>
                                    <th style={thStyle}>In Time</th>
                                    <th style={thStyle}>Out Time</th>
                                    <th style={thStyle}>Work Hrs</th>
                                    <th style={thStyle}>Late</th>
                                    <th style={thStyle}>Early</th>
                                    <th style={thStyle}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyData.map((d, i) => (
                                    <tr key={i} style={trStyle}>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: '600' }}>{d.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{d.department}</div>
                                        </td>
                                        <td style={tdStyle}>{d.check_in.split(' ')[1] || d.check_in}</td>
                                        <td style={tdStyle}>{d.check_out.split(' ')[1] || d.check_out}</td>
                                        <td style={{ ...tdStyle, fontWeight: '700' }}>{d.working_hours}</td>
                                        <td style={{ ...tdStyle, color: d.late_entry==='Yes'?'var(--error)':'var(--success)' }}>{d.late_entry}</td>
                                        <td style={{ ...tdStyle, color: d.early_exit==='Yes'?'var(--error)':'var(--success)' }}>{d.early_exit}</td>
                                        <td style={tdStyle}>
                                            <Badge type={d.status}>{d.status}</Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                      )
                  )}

                  {activeTab === 'ledger' && (
                      ledgerData.length === 0 ? (
                        <NoDataView message="No monthly statistics found for this month." />
                      ) : (
                        <table style={{ ...tableStyle, tableLayout: 'fixed' }}>
                            <thead>
                                <tr style={rowStyle}>
                                    <th style={{ ...thStyle, width: '150px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-color)', zIndex: 10 }}>Employee</th>
                                    {Array.from({ length: getDaysInMonth() }).map((_, i) => (
                                        <th key={i} style={{ ...thStyle, width: '35px', textAlign: 'center' }}>{(i + 1).toString().padStart(2, '0')}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {ledgerData.map((l, i) => (
                                    <tr key={i} style={trStyle}>
                                        <td style={{ ...tdStyle, position: 'sticky', left: 0, backgroundColor: 'var(--surface-color)', zIndex: 5, borderRight: '1px solid var(--border-color)' }}>
                                            <div style={{ fontWeight: '600', fontSize: '12px' }}>{l.name}</div>
                                        </td>
                                        {Array.from({ length: getDaysInMonth() }).map((_, di) => {
                                            const day = (di + 1).toString().padStart(2, '0');
                                            const status = l.attendance[day] || 'A';
                                            return (
                                                <td key={di} style={{ ...tdStyle, padding: '4px', textAlign: 'center' }}>
                                                    <div style={{ 
                                                        width: '24px', height: '24px', borderRadius: '4px', margin: '0 auto',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold',
                                                        backgroundColor: status === 'P' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                                        color: status === 'P' ? 'var(--success)' : 'var(--error)'
                                                    }}>
                                                        {status}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                      )
                  )}

                  {activeTab === 'salary' && (
                      salaryData.length === 0 ? (
                        <NoDataView message="No salary sheet data available for selected month." />
                      ) : (
                        <table style={tableStyle}>
                            <thead>
                                <tr style={rowStyle}>
                                    <th style={thStyle}>Employee</th>
                                    <th style={thStyle}>Present Days</th>
                                    <th style={thStyle}>Paid Leaves</th>
                                    <th style={thStyle}>Total Payable</th>
                                    <th style={thStyle}>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {salaryData.map((s, i) => (
                                    <tr key={i} style={trStyle}>
                                        <td style={tdStyle}>
                                           <div style={{ fontWeight: '600' }}>{s.name}</div>
                                           <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.department}</div>
                                        </td>
                                        <td style={tdStyle}>{s.present_days}</td>
                                        <td style={tdStyle}>{s.paid_leaves}</td>
                                        <td style={{ ...tdStyle, fontSize: '16px', fontWeight: 'bold', color: 'var(--primary-color)' }}>{s.payable_days}</td>
                                        <td style={tdStyle}>
                                            <button style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calculator size={12} /> Adjustment
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                      )
                  )}

                  {activeTab === 'raw' && (
                      rawData.length === 0 ? (
                        <NoDataView message="No attendance logs found. Sync your device to populate records." />
                      ) : (
                        <table style={tableStyle}>
                            <thead>
                                 <tr style={rowStyle}>
                                     <th style={thStyle}>#</th>
                                     <th style={thStyle}>Employee Name</th>
                                     <th style={thStyle}>Date</th>
                                     <th style={thStyle}>Time</th>
                                     <th style={thStyle}>Punch Method</th>
                                     <th style={thStyle}>Device</th>
                                 </tr>
                            </thead>
                            <tbody>
                                 {rawData.map((r, i) => {
                                   const dt = r.timestamp || '';
                                   const datePart = dt.length >= 10 ? dt.substring(0, 10) : dt;
                                   const timePart = dt.length >= 16 ? dt.substring(11, 16) : '';
                                   const method = (r.type || 'FINGER').toUpperCase();
                                   const isFace = method.includes('FACE') || method === '1';
                                   return (
                                     <tr key={i} style={trStyle}>
                                         <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '11px', width: '40px' }}>{i + 1}</td>
                                         <td style={tdStyle}>
                                           <div style={{ fontWeight: 700 }}>{r.name}</div>
                                           <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID #{r.id}</div>
                                         </td>
                                         <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{datePart}</td>
                                         <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-color)' }}>{timePart}</td>
                                         <td style={tdStyle}>
                                           <div style={{ display: 'flex', alignItems: 'center', gap: '6px',
                                             padding: '4px 10px', borderRadius: '20px', width: 'fit-content',
                                             backgroundColor: isFace ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                                             color: isFace ? '#3b82f6' : 'var(--success)'
                                           }}>
                                             {isFace
                                               ? <><ScanFace size={14} /><span style={{ fontSize: '11px', fontWeight: 700 }}>Face</span></>
                                               : <><Fingerprint size={14} /><span style={{ fontSize: '11px', fontWeight: 700 }}>Finger</span></>
                                             }
                                           </div>
                                         </td>
                                         <td style={{ ...tdStyle, fontSize: '12px', color: 'var(--text-muted)' }}>{r.device}</td>
                                     </tr>
                                   );
                                 })}
                            </tbody>
                        </table>
                      )
                  )}
              </div>
          )}
      </div>
    </div>
  );
};

// UI Components
const Tab = ({ active, onClick, children }: any) => (
    <button 
        onClick={onClick}
        style={{
            flex: 1, padding: '10px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
            backgroundColor: active ? 'white' : 'transparent',
            color: active ? 'var(--primary-color)' : 'var(--text-muted)',
            boxShadow: active ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
            transition: '0.2s'
        }}
    >{children}</button>
);

const NoDataView = ({ message }: { message: string }) => (
    <div style={{ 
        padding: '60px 20px', textAlign: 'center', 
        backgroundColor: 'var(--surface-color)', borderRadius: '12px',
        border: '1px dashed var(--border-color)', margin: '20px 0'
    }}>
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📂</div>
        <h3 style={{ margin: 0, color: 'var(--text-color)' }}>No Records Found</h3>
        <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>{message}</p>
    </div>
);

const Badge = ({ type, children }: any) => {
    const isP = type === 'On-time' || type === 'P';
    const isL = type === 'Late';
    return (
        <span style={{ 
            padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
            backgroundColor: isP ? 'rgba(16,185,129,0.1)' : (isL ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'),
            color: isP ? 'var(--success)' : (isL ? 'var(--warning)' : 'var(--error)')
        }}>{children}</span>
    );
};

// Styles
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '13px', outline: 'none' };
const secondaryBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '6px', border: '1px solid var(--primary-color)', backgroundColor: 'transparent', color: 'var(--primary-color)', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' };
const primaryBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary-color)', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' };

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const rowStyle: React.CSSProperties = { textAlign: 'left', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)' };
const thStyle: React.CSSProperties = { padding: '16px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' };
const trStyle: React.CSSProperties = { borderBottom: '1px solid var(--border-color)', transition: '0.1s' };
const tdStyle: React.CSSProperties = { padding: '16px', fontSize: '13px' };
