import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '@/config/supabase';
import { Download, Eye, Plus, Pencil, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface PayrollRecord {
  id: string;
  employee_id: number;
  employee_name?: string;
  basic_salary: number;
  gross_salary: number;
  allowances: number;
  total_earnings: number;
  total_deductions: number;
  net_pay: number;
  ssf_employer: number;
  ssf_employee: number;
  income_tax: number;
  month: number;
  year: number;
  is_paid: boolean;
}

interface SalaryStructure {
  id: number;
  employee_id: number;
  employee_name?: string;
  basic_salary: number;
  allowances: number;
  deductions: number;
  overtime_rate: number;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const fmt = (n: number) => `Rs. ${(n || 0).toLocaleString()}`;

export const PayrollManagement: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'records'|'salary'>('records');
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Dialogs
  const [payslipDialog, setPayslipDialog] = useState<{ open: boolean; record: PayrollRecord | null }>({ open: false, record: null });
  const [salaryDialog, setSalaryDialog] = useState<{ open: boolean; data: Partial<SalaryStructure> | null }>({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  useEffect(() => { loadAll(); }, [selectedMonth, selectedYear]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: emps } = await supabase.from('employees').select('id, first_name, last_name, employee_code').eq('status', 'Active');
      setEmployees(emps || []);

      const { data: records } = await supabase.from('payroll_records').select('*')
        .eq('month', selectedMonth).eq('year', selectedYear).order('created_at', { ascending: false });

      const enriched = (records || []).map((r: any) => {
        const emp = (emps || []).find((e: any) => e.id === r.employee_id);
        return { ...r, employee_name: emp ? `${emp.first_name} ${emp.last_name}` : `Emp #${r.employee_id}` };
      });
      setPayrollRecords(enriched);

      const { data: structs } = await supabase.from('salary_structures').select('*');
      const enrichedStructs = (structs || []).map((s: any) => {
        const emp = (emps || []).find((e: any) => e.id === s.employee_id);
        return { ...s, employee_name: emp ? `${emp.first_name} ${emp.last_name}` : `Emp #${s.employee_id}` };
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
      if (!emps || emps.length === 0) { alert('No active employees!'); return; }

      const SSF_EMP = 0.11;
      const SSF_ER = 0.20;

      const data = emps.map((emp: any) => {
        const s = (structs || []).find((x: any) => x.employee_id === emp.id);
        const basic = s?.basic_salary || 30000;
        const allowances = s?.allowances || 0;
        const gross = basic + allowances;
        const ssf_employee = Math.round(basic * SSF_EMP);
        const ssf_employer = Math.round(basic * SSF_ER);
        const taxable_annual = (gross - ssf_employee) * 12;
        let tax_annual = Math.min(taxable_annual, 600000) * 0.01;
        if (taxable_annual > 600000) tax_annual += (Math.min(taxable_annual, 800000) - 600000) * 0.10;
        if (taxable_annual > 800000) tax_annual += (Math.min(taxable_annual, 1100000) - 800000) * 0.20;
        if (taxable_annual > 1100000) tax_annual += (Math.min(taxable_annual, 2000000) - 1100000) * 0.30;
        if (taxable_annual > 2000000) tax_annual += (taxable_annual - 2000000) * 0.36;
        const income_tax = Math.round(tax_annual / 12);
        const total_deductions = ssf_employee + income_tax;
        const net_pay = gross - total_deductions;
        return { employee_id: emp.id, basic_salary: basic, gross_salary: gross, allowances, total_earnings: gross, total_deductions, ssf_employee, ssf_employer, income_tax, overtime_amount: 0, net_pay, month: selectedMonth, year: selectedYear, is_paid: false, organization_id: 2 };
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
        basic_salary: d.basic_salary, allowances: d.allowances, overtime_rate: d.overtime_rate
      }).eq('id', d.id);
    } else {
      await supabase.from('salary_structures').insert({
        employee_id: d.employee_id, basic_salary: d.basic_salary || 0,
        allowances: d.allowances || 0, overtime_rate: d.overtime_rate || 1.5, organization_id: 2
      });
    }
    setSalaryDialog({ open: false, data: null });
    loadAll();
  };

  const handleDeleteSalary = async (id: number) => {
    if (!confirm('Delete this salary structure?')) return;
    await supabase.from('salary_structures').delete().eq('id', id);
    loadAll();
  };

  const generatePayslip = (r: PayrollRecord) => {
    const txt = `
=====================================
        BIO BRIDGE PRO HR
           PAYSLIP
=====================================
Employee : ${r.employee_name}
Period   : ${MONTHS[r.month - 1]} ${r.year}
-------------------------------------
EARNINGS
  Basic Salary      : Rs. ${(r.basic_salary || 0).toLocaleString()}
  Allowances        : Rs. ${(r.allowances || 0).toLocaleString()}
  Gross Salary      : Rs. ${(r.gross_salary || 0).toLocaleString()}

DEDUCTIONS
  SSF Employee(11%) : Rs. ${(r.ssf_employee || 0).toLocaleString()}
  Income Tax (TDS)  : Rs. ${(r.income_tax || 0).toLocaleString()}
  Total Deductions  : Rs. ${(r.total_deductions || 0).toLocaleString()}

EMPLOYER CONTRIBUTION
  SSF Employer(20%) : Rs. ${(r.ssf_employer || 0).toLocaleString()}

-------------------------------------
NET PAY             : Rs. ${(r.net_pay || 0).toLocaleString()}
=====================================
Status: ${r.is_paid ? 'PAID' : 'PENDING'}
    `;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = `payslip_${r.employee_name}_${MONTHS[r.month-1]}_${r.year}.txt`;
    a.click();
  };

  const totalEarnings = payrollRecords.reduce((s, r) => s + (r.gross_salary || 0), 0);
  const totalDeductions = payrollRecords.reduce((s, r) => s + (r.total_deductions || 0), 0);
  const totalNet = payrollRecords.reduce((s, r) => s + (r.net_pay || 0), 0);
  const totalSSFTax = payrollRecords.reduce((s, r) => s + (r.ssf_employer || 0) + (r.income_tax || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Payroll Management</h1>
      <p className="text-muted-foreground mb-6">Process payroll, manage salary structures, and generate payslips</p>

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
          <Button onClick={handleProcessPayroll} disabled={processing}>
            {processing ? 'Processing...' : '⚡ Process Payroll'}
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Employees', value: payrollRecords.length, color: '' },
          { label: 'Total Earnings', value: fmt(totalEarnings), color: 'text-green-600' },
          { label: 'Deductions', value: fmt(totalDeductions), color: 'text-red-500' },
          { label: 'Net Pay', value: fmt(totalNet), color: 'text-blue-600' },
          { label: 'SSF + Tax', value: fmt(totalSSFTax), color: 'text-orange-500' },
        ].map((s, i) => (
          <Card key={i}><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <Button variant={tab === 'records' ? 'default' : 'outline'} size="sm" onClick={() => setTab('records')}>Payroll Records</Button>
        <Button variant={tab === 'salary' ? 'default' : 'outline'} size="sm" onClick={() => setTab('salary')}>Salary Structures</Button>
      </div>

      {/* Payroll Records Tab */}
      {tab === 'records' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between">
              <span>Payroll — {MONTHS[selectedMonth-1]} {selectedYear}</span>
              <Badge variant="outline">{payrollRecords.length} employees</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> :
             payrollRecords.length === 0 ? <p className="text-center py-8 text-muted-foreground">No records. Click "Process Payroll".</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Basic</TableHead>
                    <TableHead>Allowances</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>SSF(Emp)</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRecords.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.employee_name}</TableCell>
                      <TableCell>{fmt(r.basic_salary)}</TableCell>
                      <TableCell>{fmt(r.allowances)}</TableCell>
                      <TableCell className="text-green-600">{fmt(r.gross_salary)}</TableCell>
                      <TableCell>{fmt(r.ssf_employee)}</TableCell>
                      <TableCell>{fmt(r.income_tax)}</TableCell>
                      <TableCell className="font-bold text-blue-600">{fmt(r.net_pay)}</TableCell>
                      <TableCell>
                        <Badge variant={r.is_paid ? 'default' : 'secondary'}>{r.is_paid ? 'Paid' : 'Pending'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setPayslipDialog({ open: true, record: r })}><Eye className="h-3 w-3" /></Button>
                          <Button size="sm" variant="outline" onClick={() => generatePayslip(r)}><Download className="h-3 w-3" /></Button>
                          {!r.is_paid && <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleMarkPaid(r.id)}>Paid</Button>}
                          <Button size="sm" variant="outline" className="text-red-500" onClick={() => setDeleteDialog({ open: true, id: r.id })}><Trash2 className="h-3 w-3" /></Button>
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

      {/* Salary Structure Tab */}
      {tab === 'salary' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Salary Structures</span>
              <Button size="sm" onClick={() => setSalaryDialog({ open: true, data: {} })}>
                <Plus className="h-4 w-4 mr-1" /> Add Structure
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Basic Salary</TableHead>
                  <TableHead>Allowances</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>OT Rate</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryStructures.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.employee_name}</TableCell>
                    <TableCell>{fmt(s.basic_salary)}</TableCell>
                    <TableCell>{fmt(s.allowances)}</TableCell>
                    <TableCell className="text-green-600 font-bold">{fmt(s.basic_salary + s.allowances)}</TableCell>
                    <TableCell>{s.overtime_rate}x</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSalaryDialog({ open: true, data: { ...s } })}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" className="text-red-500" onClick={() => handleDeleteSalary(s.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {salaryStructures.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No salary structures found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Payslip Dialog */}
      <Dialog open={payslipDialog.open} onOpenChange={o => setPayslipDialog({ open: o, record: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Payslip — {payslipDialog.record?.employee_name}</DialogTitle></DialogHeader>
          {payslipDialog.record && (
            <div className="space-y-3 text-sm">
              <div className="bg-slate-50 p-3 rounded-lg space-y-1">
                <p className="font-semibold mb-2">Earnings</p>
                <div className="flex justify-between"><span>Basic Salary</span><span>{fmt(payslipDialog.record.basic_salary)}</span></div>
                <div className="flex justify-between"><span>Allowances</span><span>{fmt(payslipDialog.record.allowances)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1"><span>Gross</span><span className="text-green-600">{fmt(payslipDialog.record.gross_salary)}</span></div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg space-y-1">
                <p className="font-semibold mb-2">Deductions</p>
                <div className="flex justify-between"><span>SSF Employee (11%)</span><span>{fmt(payslipDialog.record.ssf_employee)}</span></div>
                <div className="flex justify-between"><span>Income Tax (IRD)</span><span>{fmt(payslipDialog.record.income_tax)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1"><span>Total Deductions</span><span className="text-red-600">{fmt(payslipDialog.record.total_deductions)}</span></div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="font-semibold mb-2">Employer Contribution</p>
                <div className="flex justify-between"><span>SSF Employer (20%)</span><span>{fmt(payslipDialog.record.ssf_employer)}</span></div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">NET PAY</p>
                <p className="text-3xl font-bold text-green-600">{fmt(payslipDialog.record.net_pay)}</p>
                <Badge variant={payslipDialog.record.is_paid ? 'default' : 'secondary'} className="mt-2">
                  {payslipDialog.record.is_paid ? 'PAID' : 'PENDING'}
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => payslipDialog.record && generatePayslip(payslipDialog.record)}>
              <Download className="h-4 w-4 mr-2" /> Download
            </Button>
            <Button onClick={() => setPayslipDialog({ open: false, record: null })}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Structure Dialog */}
      <Dialog open={salaryDialog.open} onOpenChange={o => setSalaryDialog({ open: o, data: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{salaryDialog.data?.id ? 'Edit' : 'Add'} Salary Structure</DialogTitle></DialogHeader>
          {salaryDialog.data && (
            <div className="space-y-4">
              {!salaryDialog.data.id && (
                <div>
                  <Label>Employee</Label>
                  <select className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 mt-1"
                    value={salaryDialog.data.employee_id || ''}
                    onChange={e => setSalaryDialog(prev => ({ ...prev, data: { ...prev.data, employee_id: Number(e.target.value) } }))}>
                    <option value="">Select employee</option>
                    {employees.filter(e => !salaryStructures.find(s => s.employee_id === e.id)).map(e => (
                      <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                    ))}
                  </select>
                </div>
              )}
              {salaryDialog.data.id && <p className="font-medium">{salaryDialog.data.employee_name}</p>}
              <div>
                <Label>Basic Salary (Rs.)</Label>
                <Input type="number" value={salaryDialog.data.basic_salary || ''} className="mt-1"
                  onChange={e => setSalaryDialog(prev => ({ ...prev, data: { ...prev.data, basic_salary: Number(e.target.value) } }))} />
              </div>
              <div>
                <Label>Allowances (Rs.)</Label>
                <Input type="number" value={salaryDialog.data.allowances || ''} className="mt-1"
                  onChange={e => setSalaryDialog(prev => ({ ...prev, data: { ...prev.data, allowances: Number(e.target.value) } }))} />
                <p className="text-xs text-muted-foreground mt-1">HRA + TA + Medical + DA combined</p>
              </div>
              <div>
                <Label>Overtime Rate</Label>
                <Input type="number" step="0.1" value={salaryDialog.data.overtime_rate || 1.5} className="mt-1"
                  onChange={e => setSalaryDialog(prev => ({ ...prev, data: { ...prev.data, overtime_rate: Number(e.target.value) } }))} />
              </div>
              {salaryDialog.data.basic_salary && (
                <div className="bg-green-50 p-3 rounded-lg text-sm">
                  <p className="font-semibold">Preview</p>
                  <div className="flex justify-between"><span>Gross</span><span>{fmt((salaryDialog.data.basic_salary || 0) + (salaryDialog.data.allowances || 0))}</span></div>
                  <div className="flex justify-between text-red-600"><span>SSF Employee (11%)</span><span>-{fmt(Math.round((salaryDialog.data.basic_salary || 0) * 0.11))}</span></div>
                  <div className="flex justify-between text-orange-600"><span>SSF Employer (20%)</span><span>{fmt(Math.round((salaryDialog.data.basic_salary || 0) * 0.20))}</span></div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryDialog({ open: false, data: null })}>Cancel</Button>
            <Button onClick={handleSaveSalary}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={o => setDeleteDialog({ open: o, id: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Payroll Record?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">This will permanently delete this payroll record.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, id: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePayroll}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
