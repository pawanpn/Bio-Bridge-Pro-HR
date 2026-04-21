import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { invoke } from '@tauri-apps/api/core';
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
  id: number;
  employee_name: string;
  basic_salary: number;
  total_earnings: number;
  total_deductions: number;
  net_pay: number;
  pf_employer: number;
  pf_employee: number;
  tax_amount: number;
  overtime_amount: number;
  days_present: number;
  status: string;
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

  // Load payroll data
  useEffect(() => {
    loadPayrollData();
  }, [selectedMonth, selectedYear]);

  const loadPayrollData = async () => {
    setLoading(true);
    try {
      const records = await invoke<PayrollRecord[]>('get_payroll_records', {
        month: selectedMonth,
        year: selectedYear,
      });
      setPayrollRecords(records);
    } catch (error) {
      console.error('Failed to load payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Stats calculation
  const totalEmployees = payrollRecords.length;
  const totalEarnings = payrollRecords.reduce((sum, r) => sum + r.total_earnings, 0);
  const totalDeductions = payrollRecords.reduce((sum, r) => sum + r.total_deductions, 0);
  const totalNetPay = payrollRecords.reduce((sum, r) => sum + r.net_pay, 0);
  const totalPF = payrollRecords.reduce((sum, r) => sum + r.pf_employer + r.pf_employee, 0);
  const totalTax = payrollRecords.reduce((sum, r) => sum + r.tax_amount, 0);

  const handleProcessPayroll = async () => {
    setProcessingDialog(true);
    try {
      // Simulate payroll processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      setProcessingDialog(false);
      loadPayrollData();
    } catch (error) {
      console.error('Failed to process payroll:', error);
      setProcessingDialog(false);
    }
  };

  const generatePayslip = (record: PayrollRecord) => {
    // Generate PDF payslip
    const payslipContent = `
      PAYSLIP - ${selectedMonth}/${selectedYear}
      ================================
      Employee: ${record.employee_name}
      Basic Salary: Rs. ${record.basic_salary.toLocaleString()}
      
      EARNINGS:
      Basic Salary: Rs. ${record.basic_salary.toLocaleString()}
      Overtime: Rs. ${record.overtime_amount.toLocaleString()}
      Total Earnings: Rs. ${record.total_earnings.toLocaleString()}
      
      DEDUCTIONS:
      PF (Employee): Rs. ${record.pf_employee.toLocaleString()}
      Tax: Rs. ${record.tax_amount.toLocaleString()}
      Total Deductions: Rs. ${record.total_deductions.toLocaleString()}
      
      NET PAY: Rs. ${record.net_pay.toLocaleString()}
    `;
    
    const blob = new Blob([payslipContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip_${record.employee_name}_${selectedMonth}_${selectedYear}.txt`;
    a.click();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Payroll Management</h1>
        <p className="text-muted-foreground">
          Process payroll, manage salary structures, and generate payslips
        </p>
      </div>

      {/* Month/Year Selector */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4 items-end">
            <div>
              <Label>Month</Label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-40 h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Year</Label>
              <Input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-32 mt-1"
              />
            </div>
            <Button onClick={handleProcessPayroll} disabled={processingDialog}>
              <Calculator className="w-4 h-4 mr-2" />
              {processingDialog ? 'Processing...' : 'Process Payroll'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Employees</p>
                <p className="text-2xl font-bold">{totalEmployees}</p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-2xl font-bold text-green-600">Rs. {(totalEarnings / 1000).toFixed(1)}K</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Deductions</p>
                <p className="text-2xl font-bold text-red-600">Rs. {(totalDeductions / 1000).toFixed(1)}K</p>
              </div>
              <DollarSign className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net Pay</p>
                <p className="text-2xl font-bold text-blue-600">Rs. {(totalNetPay / 1000).toFixed(1)}K</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">PF + Tax</p>
                <p className="text-2xl font-bold text-orange-600">Rs. {((totalPF + totalTax) / 1000).toFixed(1)}K</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-border">
        <TabButton
          icon={<FileText className="w-4 h-4" />}
          label="Payroll Records"
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
        />
        <TabButton
          icon={<Users className="w-4 h-4" />}
          label="Salary Structure"
          active={activeTab === 'process'}
          onClick={() => setActiveTab('process')}
        />
        <TabButton
          icon={<Clock className="w-4 h-4" />}
          label="History"
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
        />
        <TabButton
          icon={<DollarSign className="w-4 h-4" />}
          label="Loans & Advances"
          active={activeTab === 'loans'}
          onClick={() => setActiveTab('loans')}
        />
      </div>

      {/* Payroll Records Tab */}
      {activeTab === 'overview' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Payroll - {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })} {selectedYear}</span>
              <Badge variant="secondary">{payrollRecords.length} employees</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Basic Salary</TableHead>
                  <TableHead>Earnings</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>PF</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : payrollRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No payroll records found. Process payroll to generate records.
                    </TableCell>
                  </TableRow>
                ) : (
                  payrollRecords.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.employee_name}</TableCell>
                      <TableCell>Rs. {record.basic_salary.toLocaleString()}</TableCell>
                      <TableCell className="text-green-600">Rs. {record.total_earnings.toLocaleString()}</TableCell>
                      <TableCell className="text-red-600">Rs. {record.total_deductions.toLocaleString()}</TableCell>
                      <TableCell>Rs. {(record.pf_employer + record.pf_employee).toLocaleString()}</TableCell>
                      <TableCell>Rs. {record.tax_amount.toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-blue-600">Rs. {record.net_pay.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={record.status === 'Processed' ? 'default' : 'secondary'}>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPayslipDialog({ open: true, record })}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => generatePayslip(record)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Salary Structure Tab */}
      {activeTab === 'process' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calculator className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Salary Structure Configuration</p>
            <p className="text-sm text-muted-foreground mt-2">
              Configure salary components, allowances, and deductions for employees.
            </p>
            <Button className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Add Salary Structure
            </Button>
          </CardContent>
        </Card>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Payroll History</p>
            <p className="text-sm text-muted-foreground mt-2">
              View and compare payroll records from previous months.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loans Tab */}
      {activeTab === 'loans' && (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Loans & Advances</p>
            <p className="text-sm text-muted-foreground mt-2">
              Manage employee loans, advances, and EMI tracking.
            </p>
            <Button className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Add Loan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Payslip Dialog */}
      <Dialog open={payslipDialog.open} onOpenChange={(open) => !open && setPayslipDialog({ open: false, record: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payslip Details</DialogTitle>
          </DialogHeader>
          {payslipDialog.record && (
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h3 className="text-xl font-bold">{payslipDialog.record.employee_name}</h3>
                <p className="text-muted-foreground">
                  Payslip for {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })} {selectedYear}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2 font-semibold">EARNINGS</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Basic Salary</span>
                      <span>Rs. {payslipDialog.record.basic_salary.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overtime</span>
                      <span>Rs. {payslipDialog.record.overtime_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-2">
                      <span>Total Earnings</span>
                      <span className="text-green-600">Rs. {payslipDialog.record.total_earnings.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground mb-2 font-semibold">DEDUCTIONS</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>PF (Employee)</span>
                      <span>Rs. {payslipDialog.record.pf_employee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>Rs. {payslipDialog.record.tax_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-2">
                      <span>Total Deductions</span>
                      <span className="text-red-600">Rs. {payslipDialog.record.total_deductions.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-primary/10 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">NET PAY</span>
                  <span className="text-2xl font-bold text-primary">
                    Rs. {payslipDialog.record.net_pay.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayslipDialog({ open: false, record: null })}>Close</Button>
            <Button onClick={() => payslipDialog.record && generatePayslip(payslipDialog.record)}>
              <Download className="w-4 h-4 mr-2" />
              Download Payslip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

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
