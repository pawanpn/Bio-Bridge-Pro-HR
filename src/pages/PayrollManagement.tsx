import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '@/config/supabase';
import {
  DollarSign, Calculator, Download, FileText, Users, TrendingUp,
  Plus, Eye, Clock, AlertCircle
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

type TabType = 'overview' | 'process' | 'history' | 'loans';

interface PayrollRecord {
  id: string;
  employee_id: number;
  employee_name?: string;
  basic_salary: number;
  gross_salary: number;
  total_earnings: number;
  total_deductions: number;
  net_pay: number;
  ssf_employer: number;
  ssf_employee: number;
  income_tax: number;
  overtime_amount: number;
  month: number;
  year: number;
  is_paid: boolean;
  organization_id: number;
}

export const PayrollManagement: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [processingDialog, setProcessingDialog] = useState(false);
  const [payslipDialog, setPayslipDialog] = useState({ open: false, record: null as PayrollRecord | null });
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    loadPayrollData();
  }, [selectedMonth, selectedYear]);

  const loadPayrollData = async () => {
    setLoading(true);
    try {
      const { data: records } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .order('created_at', { ascending: false });

      const { data: emps } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code')
        .eq('status', 'Active');

      setEmployees(emps || []);

      const enriched = (records || []).map((r: any) => {
        const emp = (emps || []).find((e: any) => e.id === r.employee_id);
        return {
          ...r,
          employee_name: emp ? `${emp.first_name} ${emp.last_name}` : `Employee #${r.employee_id}`,
        };
      });

      setPayrollRecords(enriched);
    } catch (error) {
      console.error('Failed to load payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalEmployees = payrollRecords.length;
  const totalEarnings = payrollRecords.reduce((sum, r) => sum + (r.total_earnings || 0), 0);
  const totalDeductions = payrollRecords.reduce((sum, r) => sum + (r.total_deductions || 0), 0);
  const totalNetPay = payrollRecords.reduce((sum, r) => sum + (r.net_pay || 0), 0);
  const totalSSF = payrollRecords.reduce((sum, r) => sum + (r.ssf_employer || 0) + (r.ssf_employee || 0), 0);
  const totalTax = payrollRecords.reduce((sum, r) => sum + (r.income_tax || 0), 0);

  const handleProcessPayroll = async () => {
    setProcessingDialog(true);
    try {
      const { data: emps } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code')
        .eq('status', 'Active');

      if (!emps || emps.length === 0) {
        alert('No active employees found!');
        setProcessingDialog(false);
        return;
      }

      const { data: salaryStructures } = await supabase
        .from('salary_structures')
        .select('*');

      const SSF_EMPLOYEE = 0.11;
      const SSF_EMPLOYER = 0.20;

      const payrollData = emps.map((emp: any) => {
        const structure = (salaryStructures || []).find((s: any) => s.employee_id === emp.id);
        const basic_salary = structure?.basic_salary || 30000;
        const allowances = structure?.allowances || 0;
        const gross_salary = basic_salary + allowances;

        const ssf_employee = Math.round(basic_salary * SSF_EMPLOYEE);
        const ssf_employer = Math.round(basic_salary * SSF_EMPLOYER);

        const annual_taxable = (gross_salary - ssf_employee) * 12;
        let income_tax_annual = 0;
        income_tax_annual += Math.min(annual_taxable, 600000) * 0.01;
        if (annual_taxable > 600000) income_tax_annual += (Math.min(annual_taxable, 800000) - 600000) * 0.10;
        if (annual_taxable > 800000) income_tax_annual += (Math.min(annual_taxable, 1100000) - 800000) * 0.20;
        if (annual_taxable > 1100000) income_tax_annual += (Math.min(annual_taxable, 2000000) - 1100000) * 0.30;
        if (annual_taxable > 2000000) income_tax_annual += (annual_taxable - 2000000) * 0.36;

        const income_tax = Math.round(income_tax_annual / 12);
        const total_deductions = ssf_employee + income_tax;
        const total_earnings = gross_salary;
        const net_pay = gross_salary - total_deductions;

        return {
          employee_id: emp.id,
          basic_salary,
          gross_salary,
          total_earnings,
          total_deductions,
          ssf_employee,
          ssf_employer,
          income_tax,
          overtime_amount: 0,
          net_pay,
          month: selectedMonth,
          year: selectedYear,
          is_paid: false,
          organization_id: 2,
        };
      });

      const { error } = await supabase
        .from('payroll_records')
        .upsert(payrollData, { onConflict: 'employee_id,month,year' });

      if (error) throw error;

      alert('Payroll processed successfully for ' + emps.length + ' employees!');
      loadPayrollData();
    } catch (error) {
      console.error('Failed to process payroll:', error);
      alert('Payroll processing failed: ' + JSON.stringify(error));
    } finally {
      setProcessingDialog(false);
    }
  };

  const generatePayslip = (record: PayrollRecord) => {
    const empName = record.employee_name || 'Employee';
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthName = monthNames[record.month - 1];

    const payslipContent = `
=====================================
        BIO BRIDGE PRO HR
           PAYSLIP
=====================================
Employee : ${empName}
Period   : ${monthName} ${record.year}
-------------------------------------
EARNINGS
  Basic Salary      : Rs. ${(record.basic_salary || 0).toLocaleString()}
  Gross Salary      : Rs. ${(record.gross_salary || 0).toLocaleString()}
  Total Earnings    : Rs. ${(record.total_earnings || 0).toLocaleString()}

DEDUCTIONS
  SSF (Employee 11%): Rs. ${(record.ssf_employee || 0).toLocaleString()}
  Income Tax (TDS)  : Rs. ${(record.income_tax || 0).toLocaleString()}
  Total Deductions  : Rs. ${(record.total_deductions || 0).toLocaleString()}

EMPLOYER CONTRIBUTION
  SSF (Employer 20%): Rs. ${(record.ssf_employer || 0).toLocaleString()}

-------------------------------------
NET PAY             : Rs. ${(record.net_pay || 0).toLocaleString()}
=====================================
Status: ${record.is_paid ? 'PAID' : 'PENDING'}
    `;

    const blob = new Blob([payslipContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip_${empName}_${monthName}_${record.year}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    if (!amount && amount !== 0) return 'Rs. 0';
    if (amount >= 100000) return `Rs. ${(amount / 1000).toFixed(1)}K`;
    return `Rs. ${amount.toLocaleString()}`;
  };

  const MONTHS = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Payroll Management</h1>
        <p className="text-muted-foreground">Process payroll, manage salary structures, and generate payslips</p>
      </div>

      {/* Month/Year Selector */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4 items-end">
            <div>
              <Label>Month</Label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white ml-2"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Year</Label>
              <Input
                type="number"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-24 ml-2"
              />
            </div>
            <Button onClick={handleProcessPayroll} disabled={processingDialog} className="ml-4">
              {processingDialog ? 'Processing...' : 'Process Payroll'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Employees</p>
            <p className="text-2xl font-bold">{totalEmployees}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Earnings</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalEarnings)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Deductions</p>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(totalDeductions)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Net Pay</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalNetPay)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">SSF + Tax</p>
            <p className="text-2xl font-bold text-orange-500">{formatCurrency(totalSSF + totalTax)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Payroll - {MONTHS[selectedMonth - 1]} {selectedYear}</span>
            <Badge variant="outline">{totalEmployees} employees</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : payrollRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No payroll records found. Process payroll to generate records.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Basic Salary</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>SSF (Emp)</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.employee_name}</TableCell>
                    <TableCell>Rs. {(record.basic_salary || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-green-600">Rs. {(record.gross_salary || 0).toLocaleString()}</TableCell>
                    <TableCell>Rs. {(record.ssf_employee || 0).toLocaleString()}</TableCell>
                    <TableCell>Rs. {(record.income_tax || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-red-500">Rs. {(record.total_deductions || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-blue-600 font-bold">Rs. {(record.net_pay || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={record.is_paid ? 'default' : 'secondary'}>
                        {record.is_paid ? 'Paid' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPayslipDialog({ open: true, record })}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generatePayslip(record)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payslip Dialog */}
      <Dialog open={payslipDialog.open} onOpenChange={o => setPayslipDialog({ open: o, record: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payslip - {payslipDialog.record?.employee_name}</DialogTitle>
          </DialogHeader>
          {payslipDialog.record && (
            <div className="space-y-3 text-sm">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="font-semibold mb-2">Earnings</p>
                <div className="flex justify-between"><span>Basic Salary</span><span>Rs. {(payslipDialog.record.basic_salary || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Allowances</span><span>Rs. {((payslipDialog.record.gross_salary || 0) - (payslipDialog.record.basic_salary || 0)).toLocaleString()}</span></div>
                <div className="flex justify-between font-bold border-t mt-1 pt-1"><span>Gross</span><span className="text-green-600">Rs. {(payslipDialog.record.gross_salary || 0).toLocaleString()}</span></div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <p className="font-semibold mb-2">Deductions</p>
                <div className="flex justify-between"><span>SSF (11%)</span><span>Rs. {(payslipDialog.record.ssf_employee || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Income Tax</span><span>Rs. {(payslipDialog.record.income_tax || 0).toLocaleString()}</span></div>
                <div className="flex justify-between font-bold border-t mt-1 pt-1"><span>Total</span><span className="text-red-600">Rs. {(payslipDialog.record.total_deductions || 0).toLocaleString()}</span></div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="font-semibold mb-2">Employer Contribution</p>
                <div className="flex justify-between"><span>SSF (20%)</span><span>Rs. {(payslipDialog.record.ssf_employer || 0).toLocaleString()}</span></div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Net Pay</p>
                <p className="text-2xl font-bold text-green-600">Rs. {(payslipDialog.record.net_pay || 0).toLocaleString()}</p>
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
    </div>
  );
};
