import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '@/config/supabase';
import { Download, Eye, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────
interface PayrollRecord {
  id: string;
  employee_id: number;
  employee_name?: string;
  designation?: string;
  // Resimator-style (EUR/NPR freelancers)
  gross_salary_eur?: number;
  gross_salary_npr?: number;
  overtime_normal_hrs?: number;
  overtime_weekend_hrs?: number;
  overtime_rate_normal?: number;
  overtime_rate_weekend?: number;
  overtime_amount?: number;
  cursor_pro?: number;
  internet_allowance?: number;
  lunch_allowance?: number;
  other_payment?: number;
  total_payable_eur?: number;
  previous_due?: number;
  bank_charge?: number;
  net_amount?: number;
  // IDN-style (NPR salaried)
  basic_salary: number;
  allowance: number;
  gross_salary: number;
  reserve_fund?: number;
  provident_fund?: number;
  cit_percent?: number;
  cit_amount?: number;
  tds: number;
  net_salary: number;
  lunch_days?: number;
  lunch_amount?: number;
  total_amount: number;
  // Common
  month: number;
  year: number;
  is_paid: boolean;
  currency: 'NPR' | 'EUR';
  marital_status?: 'M' | 'U';
  annual_salary?: number;
  taxable_income?: number;
  bank_name?: string;
  account_number?: string;
  pan_number?: string;
  organization_id: number;
}

interface SalaryStructure {
  id: number;
  employee_id: number;
  employee_name?: string;
  designation?: string;
  basic_salary: number;
  allowances: number;
  reserve_fund_percent: number;
  provident_fund: number;
  cit_percent: number;
  overtime_rate: number;
  currency: 'NPR' | 'EUR';
  lunch_rate: number;
  bank_name?: string;
  account_number?: string;
  pan_number?: string;
  marital_status: 'M' | 'U';
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const fmtNPR = (n: number) => `Rs. ${(n || 0).toLocaleString()}`;
const fmtEUR = (n: number) => `EUR ${(n || 0).toLocaleString()}`;
const fmt = (n: number, cur: string) => cur === 'EUR' ? fmtEUR(n) : fmtNPR(n);

// Nepal IRD Tax Slabs FY 2081/82
function calcNepalTax(taxableAnnual: number, marital: 'M' | 'U'): number {
  const freeLimit = marital === 'M' ? 650000 : 600000;
  let tax = 0;
  const income = taxableAnnual;
  tax += Math.min(income, freeLimit) * 0.01;
  if (income > freeLimit) tax += (Math.min(income, freeLimit + 200000) - freeLimit) * 0.10;
  if (income > freeLimit + 200000) tax += (Math.min(income, freeLimit + 500000) - (freeLimit + 200000)) * 0.20;
  if (income > freeLimit + 500000) tax += (Math.min(income, freeLimit + 1400000) - (freeLimit + 500000)) * 0.30;
  if (income > freeLimit + 1400000) tax += (income - (freeLimit + 1400000)) * 0.36;
  return Math.round(tax / 12);
}

export const PayrollManagement: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'records'|'salary'|'report'>('records');
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [payslipDialog, setPayslipDialog] = useState<{ open: boolean; record: PayrollRecord | null }>({ open: false, record: null });
  const [salaryDialog, setSalaryDialog] = useState<{ open: boolean; data: Partial<SalaryStructure> | null }>({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  useEffect(() => { loadAll(); }, [selectedMonth, selectedYear]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: emps } = await supabase.from('employees')
        .select('id, first_name, last_name, employee_code, department').eq('status', 'Active');
      setEmployees(emps || []);

      const { data: records } = await supabase.from('payroll_records').select('*')
        .eq('month', selectedMonth).eq('year', selectedYear).order('created_at', { ascending: false });

      const enriched = (records || []).map((r: any) => {
        const emp = (emps || []).find((e: any) => e.id === r.employee_id);
        return { ...r, employee_name: emp ? `${emp.first_name} ${emp.last_name}` : `Emp #${r.employee_id}`, designation: emp?.department };
      });
      setPayrollRecords(enriched);

      const { data: structs } = await supabase.from('salary_structures').select('*');
      const enrichedStructs = (structs || []).map((s: any) => {
        const emp = (emps || []).find((e: any) => e.id === s.employee_id);
        return { ...s, employee_name: emp ? `${emp.first_name} ${emp.last_name}` : `Emp #${s.employee_id}`, designation: emp?.department };
      });
      setSalaryStructures(enrichedStructs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayroll = async () => {
    setProcessing(true);
    try {
      const { data: emps } = await supabase.from('employees').select('id, first_name, last_name').eq('status', 'Active');
      const { data: structs } = await supabase.from('salary_structures').select('*');
      if (!emps || emps.length === 0) { alert('No active employees!'); setProcessing(false); return; }

      const data = emps.map((emp: any) => {
        const s = (structs || []).find((x: any) => x.employee_id === emp.id);
        const basic = s?.basic_salary || 30000;
        const allowance = s?.allowances || 0;
        const gross = basic + allowance;
        const reserve_fund = Math.round(basic * (s?.reserve_fund_percent || 10) / 100);
        const provident_fund = s?.provident_fund || 0;
        const cit_percent = s?.cit_percent || 0;
        const cit_amount = Math.round(gross * cit_percent / 100);
        const marital = s?.marital_status || 'U';
        const currency = s?.currency || 'NPR';
        // Taxable = Gross - Reserve Fund - CIT
        const annual_salary = gross * 12;
        const eligible_deduction = provident_fund + cit_amount * 12;
        const taxable_income = annual_salary - eligible_deduction;
        const tds = calcNepalTax(taxable_income, marital);
        const net_salary = gross - reserve_fund - tds - cit_amount;
        const total_amount = net_salary;

        return {
          employee_id: emp.id,
          basic_salary: basic,
          allowance,
          gross_salary: gross,
          reserve_fund,
          provident_fund,
          cit_percent,
          cit_amount,
          tds,
          net_salary,
          total_amount,
          annual_salary,
          taxable_income,
          marital_status: marital,
          currency,
          month: selectedMonth,
          year: selectedYear,
          is_paid: false,
          organization_id: 2,
          // Ensure these exist for display
          ssf_employee: reserve_fund,
          ssf_employer: Math.round(basic * 0.20),
          income_tax: tds,
          net_pay: net_salary,
          total_earnings: gross,
          total_deductions: reserve_fund + tds + cit_amount,
        };
      });

      const { error } = await supabase.from('payroll_records').upsert(data, { onConflict: 'employee_id,month,year' });
      if (error) throw error;
      alert(`Payroll processed for ${emps.length} employees!`);
      loadAll();
    } catch (err) {
      alert('Failed: ' + JSON.stringify(err));
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    await supabase.from('payroll_records').update({ is_paid: true }).eq('id', id);
    loadAll();
  };

  const handleDeletePayroll = async () => {
    if (!deleteDialog.id) return;
    await supabase.from('payroll_records').delete().eq('id', deleteDialog.id);
    setDeleteDialog({ open: false, id: null });
    loadAll();
  };

  const handleSaveSalary = async () => {
    if (!salaryDialog.data) return;
    const d = salaryDialog.data;
    if (d.id) {
      await supabase.from('salary_structures').update({
        basic_salary: d.basic_salary,
        allowances: d.allowances,
        overtime_rate: d.overtime_rate,
        reserve_fund_percent: d.reserve_fund_percent,
        cit_percent: d.cit_percent,
        provident_fund: d.provident_fund,
        currency: d.currency,
        lunch_rate: d.lunch_rate,
        marital_status: d.marital_status,
        bank_name: d.bank_name,
        account_number: d.account_number,
        pan_number: d.pan_number,
      }).eq('id', d.id);
    } else {
      await supabase.from('salary_structures').insert({
        employee_id: d.employee_id,
        basic_salary: d.basic_salary || 0,
        allowances: d.allowances || 0,
        reserve_fund_percent: d.reserve_fund_percent || 10,
        provident_fund: d.provident_fund || 0,
        cit_percent: d.cit_percent || 0,
        overtime_rate: d.overtime_rate || 1.5,
        currency: d.currency || 'NPR',
        lunch_rate: d.lunch_rate || 200,
        marital_status: d.marital_status || 'U',
        bank_name: d.bank_name || '',
        account_number: d.account_number || '',
        pan_number: d.pan_number || '',
        organization_id: 2,
      });
    }
    setSalaryDialog({ open: false, data: null });
    loadAll();
  };

  const generatePayslip = (r: PayrollRecord) => {
    const cur = r.currency || 'NPR';
    const f = (n: number) => cur === 'EUR' ? `EUR ${(n||0).toFixed(2)}` : `Rs. ${(n||0).toLocaleString()}`;
    const txt = `
================================================================
                    BIO BRIDGE PRO HR
                  SALARY PAYSLIP / TLAB BHUGTAN
================================================================
Employee Name : ${r.employee_name}
Designation   : ${r.designation || '-'}
PAN Number    : ${r.pan_number || '-'}
Period        : ${MONTHS[r.month - 1]} ${r.year}
Currency      : ${cur}
Marital Status: ${r.marital_status === 'M' ? 'Married' : 'Unmarried'}
----------------------------------------------------------------
EARNINGS (AAMDANI)
  Basic Salary (Mul Talab)    : ${f(r.basic_salary)}
  Allowance (Bhatta)          : ${f(r.allowance || 0)}
  Overtime Amount             : ${f(r.overtime_amount || 0)}
  Lunch Allowance             : ${f(r.lunch_amount || 0)}
  Other Payment               : ${f(r.other_payment || 0)}
                               ─────────────────
  GROSS SALARY (Kul Talab)   : ${f(r.gross_salary)}
----------------------------------------------------------------
DEDUCTIONS (KATTI)
  Reserve Fund (10%)          : ${f(r.reserve_fund || 0)}
  CIT (${r.cit_percent || 0}%)                   : ${f(r.cit_amount || 0)}
  TDS / Income Tax            : ${f(r.tds || 0)}
                               ─────────────────
  TOTAL DEDUCTIONS            : ${f((r.reserve_fund||0)+(r.cit_amount||0)+(r.tds||0))}
----------------------------------------------------------------
EMPLOYER CONTRIBUTION
  SSF Employer (20%)          : ${f(r.ssf_employer || 0)}
================================================================
NET SALARY (Khalis Talab)    : ${f(r.net_salary || r.net_pay || 0)}
================================================================
Bank Name     : ${r.bank_name || '-'}
Account No.   : ${r.account_number || '-'}
Status        : ${r.is_paid ? 'PAID (Bhugtan Bhaeko)' : 'PENDING (Baki)'}
================================================================
Annual Salary     : ${f(r.annual_salary || 0)}
Taxable Income    : ${f(r.taxable_income || 0)}
Annual TDS        : ${f((r.tds || 0) * 12)}
================================================================
    `;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = `payslip_${r.employee_name}_${MONTHS[r.month-1]}_${r.year}.txt`;
    a.click();
  };

  // Stats
  const totalGross = payrollRecords.reduce((s, r) => s + (r.gross_salary || 0), 0);
  const totalDeductions = payrollRecords.reduce((s, r) => s + ((r.reserve_fund||0)+(r.cit_amount||0)+(r.tds||0)), 0);
  const totalNet = payrollRecords.reduce((s, r) => s + (r.net_salary || r.net_pay || 0), 0);
  const totalTDS = payrollRecords.reduce((s, r) => s + (r.tds || 0), 0);
  const totalSSF = payrollRecords.reduce((s, r) => s + (r.ssf_employer || 0), 0);

  // Salary preview calculator
  const previewSalary = (d: Partial<SalaryStructure>) => {
    const basic = d.basic_salary || 0;
    const allowance = d.allowances || 0;
    const gross = basic + allowance;
    const reserve = Math.round(basic * (d.reserve_fund_percent || 10) / 100);
    const cit = Math.round(gross * (d.cit_percent || 0) / 100);
    const annual = gross * 12;
    const taxable = annual - (reserve * 12) - (cit * 12);
    const tds = calcNepalTax(taxable, d.marital_status || 'U');
    return { gross, reserve, cit, tds, net: gross - reserve - cit - tds };
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Payroll Management</h1>
      <p className="text-muted-foreground mb-6">Nepal IRD compliant | Reserve Fund | CIT | TDS | Overtime</p>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div>
            <Label>Month</Label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
              className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white ml-2">
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <Label>Year</Label>
            <Input type="number" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-24 ml-2" />
          </div>
          <Button onClick={handleProcessPayroll} disabled={processing} className="ml-2">
            {processing ? 'Processing...' : 'Process Payroll'}
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Employees', value: payrollRecords.length, color: '' },
          { label: 'Gross Salary', value: fmtNPR(totalGross), color: 'text-green-600' },
          { label: 'Total Deductions', value: fmtNPR(totalDeductions), color: 'text-red-500' },
          { label: 'Net Pay', value: fmtNPR(totalNet), color: 'text-blue-600' },
          { label: 'TDS + SSF', value: fmtNPR(totalTDS + totalSSF), color: 'text-orange-500' },
        ].map((s, i) => (
          <Card key={i}><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['records','salary','report'] as const).map(t => (
          <Button key={t} variant={tab === t ? 'default' : 'outline'} size="sm" onClick={() => setTab(t)}>
            {t === 'records' ? 'Payroll Records' : t === 'salary' ? 'Salary Structures' : 'Summary Report'}
          </Button>
        ))}
      </div>

      {/* ── Payroll Records ── */}
      {tab === 'records' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between">
              <span>Payroll - {MONTHS[selectedMonth-1]} {selectedYear}</span>
              <Badge variant="outline">{payrollRecords.length} employees</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> :
             payrollRecords.length === 0 ? <p className="text-center py-8 text-muted-foreground">No records. Click "Process Payroll".</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.N.</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Basic</TableHead>
                    <TableHead>Allowance</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Reserve(10%)</TableHead>
                    <TableHead>CIT</TableHead>
                    <TableHead>TDS</TableHead>
                    <TableHead>Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRecords.map((r, idx) => (
                    <TableRow key={r.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-medium">{r.employee_name}</TableCell>
                      <TableCell>{fmtNPR(r.basic_salary)}</TableCell>
                      <TableCell>{fmtNPR(r.allowance || 0)}</TableCell>
                      <TableCell className="text-green-600 font-medium">{fmtNPR(r.gross_salary)}</TableCell>
                      <TableCell>{fmtNPR(r.reserve_fund || 0)}</TableCell>
                      <TableCell>{fmtNPR(r.cit_amount || 0)}</TableCell>
                      <TableCell>{fmtNPR(r.tds || 0)}</TableCell>
                      <TableCell className="font-bold text-blue-600">{fmtNPR(r.net_salary || r.net_pay || 0)}</TableCell>
                      <TableCell>
                        <Badge variant={r.is_paid ? 'default' : 'secondary'}>{r.is_paid ? 'Paid' : 'Pending'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setPayslipDialog({ open: true, record: r })} title="View"><Eye className="h-3 w-3" /></Button>
                          <Button size="sm" variant="outline" onClick={() => generatePayslip(r)} title="Download"><Download className="h-3 w-3" /></Button>
                          {!r.is_paid && <Button size="sm" variant="outline" className="text-green-600 text-xs" onClick={() => handleMarkPaid(r.id)}>Paid</Button>}
                          <Button size="sm" variant="outline" className="text-red-500" onClick={() => setDeleteDialog({ open: true, id: r.id })} title="Delete"><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Salary Structures ── */}
      {tab === 'salary' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Salary Structures</span>
              <Button size="sm" onClick={() => setSalaryDialog({ open: true, data: { currency: 'NPR', marital_status: 'U', reserve_fund_percent: 10, overtime_rate: 1.5, lunch_rate: 200, cit_percent: 0 } })}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Basic</TableHead>
                  <TableHead>Allowance</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Reserve%</TableHead>
                  <TableHead>CIT%</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Marital</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryStructures.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.employee_name}</TableCell>
                    <TableCell>{fmtNPR(s.basic_salary)}</TableCell>
                    <TableCell>{fmtNPR(s.allowances)}</TableCell>
                    <TableCell className="text-green-600 font-bold">{fmtNPR(s.basic_salary + s.allowances)}</TableCell>
                    <TableCell>{s.reserve_fund_percent || 10}%</TableCell>
                    <TableCell>{s.cit_percent || 0}%</TableCell>
                    <TableCell><Badge variant="outline">{s.currency || 'NPR'}</Badge></TableCell>
                    <TableCell>{s.marital_status === 'M' ? 'Married' : 'Unmarried'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.bank_name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSalaryDialog({ open: true, data: { ...s } })}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" className="text-red-500" onClick={async () => { if(confirm('Delete?')) { await supabase.from('salary_structures').delete().eq('id', s.id); loadAll(); } }}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {salaryStructures.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No salary structures. Add one to get started.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Summary Report ── */}
      {tab === 'report' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Salary Summary - {MONTHS[selectedMonth-1]} {selectedYear}</span>
              <Button size="sm" variant="outline" onClick={() => {
                const rows = ['S.N.,Employee,Basic,Allowance,Gross,Reserve Fund,CIT,TDS,Net Salary,Status'];
                payrollRecords.forEach((r, i) => {
                  rows.push(`${i+1},${r.employee_name},${r.basic_salary},${r.allowance||0},${r.gross_salary},${r.reserve_fund||0},${r.cit_amount||0},${r.tds||0},${r.net_salary||r.net_pay||0},${r.is_paid?'Paid':'Pending'}`);
                });
                rows.push(`,,,,${totalGross},${payrollRecords.reduce((s,r)=>s+(r.reserve_fund||0),0)},${payrollRecords.reduce((s,r)=>s+(r.cit_amount||0),0)},${totalTDS},${totalNet},`);
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
                a.download = `salary_report_${MONTHS[selectedMonth-1]}_${selectedYear}.csv`;
                a.click();
              }}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Employees', value: payrollRecords.length },
                { label: 'Total Gross', value: fmtNPR(totalGross) },
                { label: 'Total Reserve Fund', value: fmtNPR(payrollRecords.reduce((s,r)=>s+(r.reserve_fund||0),0)) },
                { label: 'Total CIT', value: fmtNPR(payrollRecords.reduce((s,r)=>s+(r.cit_amount||0),0)) },
                { label: 'Total TDS (IRD)', value: fmtNPR(totalTDS) },
                { label: 'SSF Employer', value: fmtNPR(totalSSF) },
                { label: 'Total Net Pay', value: fmtNPR(totalNet) },
                { label: 'Paid', value: payrollRecords.filter(r=>r.is_paid).length + ' / ' + payrollRecords.length },
              ].map((s, i) => (
                <div key={i} className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="font-bold text-sm">{s.value}</p>
                </div>
              ))}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S.N.</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Reserve</TableHead>
                  <TableHead>CIT</TableHead>
                  <TableHead>TDS</TableHead>
                  <TableHead>Net Salary</TableHead>
                  <TableHead>Annual TDS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollRecords.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell>{i+1}</TableCell>
                    <TableCell className="font-medium">{r.employee_name}</TableCell>
                    <TableCell>{fmtNPR(r.gross_salary)}</TableCell>
                    <TableCell>{fmtNPR(r.reserve_fund||0)}</TableCell>
                    <TableCell>{fmtNPR(r.cit_amount||0)}</TableCell>
                    <TableCell>{fmtNPR(r.tds||0)}</TableCell>
                    <TableCell className="font-bold text-blue-600">{fmtNPR(r.net_salary||r.net_pay||0)}</TableCell>
                    <TableCell>{fmtNPR((r.tds||0)*12)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-slate-50">
                  <TableCell colSpan={2}>TOTAL</TableCell>
                  <TableCell>{fmtNPR(totalGross)}</TableCell>
                  <TableCell>{fmtNPR(payrollRecords.reduce((s,r)=>s+(r.reserve_fund||0),0))}</TableCell>
                  <TableCell>{fmtNPR(payrollRecords.reduce((s,r)=>s+(r.cit_amount||0),0))}</TableCell>
                  <TableCell>{fmtNPR(totalTDS)}</TableCell>
                  <TableCell>{fmtNPR(totalNet)}</TableCell>
                  <TableCell>{fmtNPR(totalTDS*12)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Payslip Dialog ── */}
      <Dialog open={payslipDialog.open} onOpenChange={o => setPayslipDialog({ open: o, record: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Payslip - {payslipDialog.record?.employee_name}</DialogTitle></DialogHeader>
          {payslipDialog.record && (() => {
            const r = payslipDialog.record;
            return (
              <div className="space-y-3 text-sm">
                <div className="text-center bg-slate-800 text-white p-3 rounded-lg">
                  <p className="text-xs">BIO BRIDGE PRO HR</p>
                  <p className="font-bold">{MONTHS[r.month-1]} {r.year}</p>
                  <p className="text-xs">{r.employee_name} | {r.marital_status === 'M' ? 'Married' : 'Unmarried'}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg space-y-1">
                  <p className="font-semibold text-green-800">Earnings</p>
                  <div className="flex justify-between"><span>Basic Salary</span><span>{fmtNPR(r.basic_salary)}</span></div>
                  <div className="flex justify-between"><span>Allowance</span><span>{fmtNPR(r.allowance||0)}</span></div>
                  {(r.overtime_amount||0) > 0 && <div className="flex justify-between"><span>Overtime</span><span>{fmtNPR(r.overtime_amount||0)}</span></div>}
                  {(r.lunch_amount||0) > 0 && <div className="flex justify-between"><span>Lunch Allowance</span><span>{fmtNPR(r.lunch_amount||0)}</span></div>}
                  <div className="flex justify-between font-bold border-t pt-1"><span>Gross Salary</span><span className="text-green-600">{fmtNPR(r.gross_salary)}</span></div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg space-y-1">
                  <p className="font-semibold text-red-800">Deductions</p>
                  <div className="flex justify-between"><span>Reserve Fund ({r.reserve_fund ? Math.round((r.reserve_fund/r.basic_salary)*100) : 10}%)</span><span>-{fmtNPR(r.reserve_fund||0)}</span></div>
                  <div className="flex justify-between"><span>CIT ({r.cit_percent||0}%)</span><span>-{fmtNPR(r.cit_amount||0)}</span></div>
                  <div className="flex justify-between"><span>TDS / Income Tax</span><span>-{fmtNPR(r.tds||0)}</span></div>
                  <div className="flex justify-between font-bold border-t pt-1"><span>Total Deductions</span><span className="text-red-600">-{fmtNPR((r.reserve_fund||0)+(r.cit_amount||0)+(r.tds||0))}</span></div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <p className="font-semibold text-yellow-800 mb-1">Employer Contribution</p>
                  <div className="flex justify-between"><span>SSF Employer (20%)</span><span>{fmtNPR(r.ssf_employer||0)}</span></div>
                </div>
                <div className="bg-blue-600 text-white p-4 rounded-lg text-center">
                  <p className="text-xs opacity-80">NET SALARY (Khalis Talab)</p>
                  <p className="text-2xl font-bold">{fmtNPR(r.net_salary||r.net_pay||0)}</p>
                  <Badge variant="outline" className="mt-1 text-white border-white">{r.is_paid ? 'PAID' : 'PENDING'}</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between"><span>Annual Salary</span><span>{fmtNPR(r.annual_salary||r.gross_salary*12)}</span></div>
                  <div className="flex justify-between"><span>Taxable Income</span><span>{fmtNPR(r.taxable_income||0)}</span></div>
                  <div className="flex justify-between"><span>Annual TDS</span><span>{fmtNPR((r.tds||0)*12)}</span></div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => payslipDialog.record && generatePayslip(payslipDialog.record)}><Download className="h-4 w-4 mr-2" />Download</Button>
            <Button onClick={() => setPayslipDialog({ open: false, record: null })}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Salary Structure Dialog ── */}
      <Dialog open={salaryDialog.open} onOpenChange={o => setSalaryDialog({ open: o, data: null })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{salaryDialog.data?.id ? 'Edit' : 'Add'} Salary Structure</DialogTitle></DialogHeader>
          {salaryDialog.data && (() => {
            const d = salaryDialog.data;
            const preview = previewSalary(d);
            const set = (key: keyof SalaryStructure, val: any) => setSalaryDialog(prev => ({ ...prev, data: { ...prev.data, [key]: val } }));
            return (
              <div className="space-y-4">
                {!d.id && (
                  <div>
                    <Label>Employee *</Label>
                    <select className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 mt-1"
                      value={d.employee_id || ''} onChange={e => set('employee_id', Number(e.target.value))}>
                      <option value="">Select employee</option>
                      {employees.filter(e => !salaryStructures.find(s => s.employee_id === e.id)).map(e => (
                        <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {d.id && <p className="font-medium text-lg">{d.employee_name}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Basic Salary (Rs.) *</Label>
                    <Input type="number" value={d.basic_salary||''} className="mt-1" onChange={e => set('basic_salary', Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Allowance (Rs.)</Label>
                    <Input type="number" value={d.allowances||''} className="mt-1" onChange={e => set('allowances', Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Reserve Fund %</Label>
                    <Input type="number" value={d.reserve_fund_percent||10} className="mt-1" onChange={e => set('reserve_fund_percent', Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>CIT % (optional)</Label>
                    <Input type="number" step="0.1" value={d.cit_percent||0} className="mt-1" onChange={e => set('cit_percent', Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Provident Fund (Rs.)</Label>
                    <Input type="number" value={d.provident_fund||0} className="mt-1" onChange={e => set('provident_fund', Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Overtime Rate</Label>
                    <Input type="number" step="0.1" value={d.overtime_rate||1.5} className="mt-1" onChange={e => set('overtime_rate', Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Lunch Rate/Day</Label>
                    <Input type="number" value={d.lunch_rate||200} className="mt-1" onChange={e => set('lunch_rate', Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <select className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 mt-1"
                      value={d.currency||'NPR'} onChange={e => set('currency', e.target.value as 'NPR'|'EUR')}>
                      <option value="NPR">NPR (Nepali Rupee)</option>
                      <option value="EUR">EUR (Euro)</option>
                    </select>
                  </div>
                  <div>
                    <Label>Marital Status</Label>
                    <select className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 mt-1"
                      value={d.marital_status||'U'} onChange={e => set('marital_status', e.target.value as 'M'|'U')}>
                      <option value="U">Unmarried</option>
                      <option value="M">Married</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label>Bank Name</Label>
                    <Input value={d.bank_name||''} className="mt-1" onChange={e => set('bank_name', e.target.value)} placeholder="e.g. Nabil Bank" />
                  </div>
                  <div>
                    <Label>Account Number</Label>
                    <Input value={d.account_number||''} className="mt-1" onChange={e => set('account_number', e.target.value)} />
                  </div>
                  <div>
                    <Label>PAN Number</Label>
                    <Input value={d.pan_number||''} className="mt-1" onChange={e => set('pan_number', e.target.value)} />
                  </div>
                </div>

                {(d.basic_salary || 0) > 0 && (
                  <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1">
                    <p className="font-semibold text-slate-700">Live Preview</p>
                    <div className="flex justify-between"><span>Gross</span><span className="text-green-600 font-medium">{fmtNPR(preview.gross)}</span></div>
                    <div className="flex justify-between"><span>Reserve Fund</span><span className="text-red-500">-{fmtNPR(preview.reserve)}</span></div>
                    <div className="flex justify-between"><span>CIT</span><span className="text-red-500">-{fmtNPR(preview.cit)}</span></div>
                    <div className="flex justify-between"><span>TDS (monthly)</span><span className="text-red-500">-{fmtNPR(preview.tds)}</span></div>
                    <div className="flex justify-between font-bold border-t pt-1"><span>Net Salary</span><span className="text-blue-600">{fmtNPR(preview.net)}</span></div>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryDialog({ open: false, data: null })}>Cancel</Button>
            <Button onClick={handleSaveSalary}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={deleteDialog.open} onOpenChange={o => setDeleteDialog({ open: o, id: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Payroll Record?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">This will permanently delete this record.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, id: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePayroll}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
