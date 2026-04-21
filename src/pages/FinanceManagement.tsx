import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { invoke } from '@tauri-apps/api/core';
import {
  FileText, Plus, Download, Eye, Edit2,
  DollarSign, TrendingUp, AlertCircle, Clock
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';

type TabType = 'invoices' | 'payments' | 'accounts' | 'reports';

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  contact_name: string;
  contact_type: 'Customer' | 'Vendor';
  invoice_type: 'Sales' | 'Purchase';
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Cancelled';
}

export const FinanceManagement: React.FC = () => {
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [invoiceDialog, setInvoiceDialog] = useState({ open: false, editing: null as Invoice | null });

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const response = await invoke<{ success: boolean; data: Invoice[] }>('list_invoices', {
        invoiceType: null,
        status: null,
      });
      if (response.success) {
        setInvoices(response.data);
      }
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const totalSales = invoices
    .filter(i => i.invoice_type === 'Sales')
    .reduce((sum, i) => sum + i.total_amount, 0);
  const totalPurchase = invoices
    .filter(i => i.invoice_type === 'Purchase')
    .reduce((sum, i) => sum + i.total_amount, 0);
  const totalPending = invoices
    .filter(i => i.status === 'Sent' || i.status === 'Overdue')
    .reduce((sum, i) => sum + (i.total_amount - i.paid_amount), 0);
  const totalOverdue = invoices
    .filter(i => i.status === 'Overdue')
    .reduce((sum, i) => sum + (i.total_amount - i.paid_amount), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Finance Management</h1>
        <p className="text-muted-foreground">
          Manage invoices, payments, accounts, and financial reports
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold text-green-600">Rs. {(totalSales / 1000).toFixed(1)}K</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Purchases</p>
                <p className="text-2xl font-bold text-blue-600">Rs. {(totalPurchase / 1000).toFixed(1)}K</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Payments</p>
                <p className="text-2xl font-bold text-orange-600">Rs. {(totalPending / 1000).toFixed(1)}K</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600">Rs. {(totalOverdue / 1000).toFixed(1)}K</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-border">
        <TabButton
          icon={<FileText className="w-4 h-4" />}
          label="Invoices"
          active={activeTab === 'invoices'}
          onClick={() => setActiveTab('invoices')}
        />
        <TabButton
          icon={<DollarSign className="w-4 h-4" />}
          label="Payments"
          active={activeTab === 'payments'}
          onClick={() => setActiveTab('payments')}
        />
        <TabButton
          icon={<FileText className="w-4 h-4" />}
          label="Chart of Accounts"
          active={activeTab === 'accounts'}
          onClick={() => setActiveTab('accounts')}
        />
        <TabButton
          icon={<TrendingUp className="w-4 h-4" />}
          label="Financial Reports"
          active={activeTab === 'reports'}
          onClick={() => setActiveTab('reports')}
        />
      </div>

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Invoices</h2>
            <Button onClick={() => setInvoiceDialog({ open: true, editing: null })}>
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map(invoice => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                      <TableCell className="text-muted-foreground">{invoice.invoice_date}</TableCell>
                      <TableCell>{invoice.contact_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{invoice.invoice_type}</Badge>
                      </TableCell>
                      <TableCell>Rs. {invoice.total_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-green-600">Rs. {invoice.paid_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-red-600">Rs. {(invoice.total_amount - invoice.paid_amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={
                          invoice.status === 'Paid' ? 'default' :
                          invoice.status === 'Overdue' ? 'destructive' :
                          invoice.status === 'Sent' ? 'secondary' : 'outline'
                        }>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Payment Management</p>
            <p className="text-sm text-muted-foreground mt-2">
              Record payments, track receipts, and manage bank transactions.
            </p>
            <Button className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Chart of Accounts Tab */}
      {activeTab === 'accounts' && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Chart of Accounts</p>
            <p className="text-sm text-muted-foreground mt-2">
              Configure your chart of accounts for proper financial tracking.
            </p>
            <Button className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Financial Reports</p>
            <p className="text-sm text-muted-foreground mt-2">
              Generate balance sheets, profit & loss statements, and more.
            </p>
            <div className="flex gap-4 justify-center mt-4">
              <Button variant="outline">Balance Sheet</Button>
              <Button variant="outline">Profit & Loss</Button>
              <Button variant="outline">Cash Flow</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Invoice Dialog */}
      <Dialog open={invoiceDialog.open} onOpenChange={(open) => !open && setInvoiceDialog({ open: false, editing: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Invoice Type</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1">
                <option value="Sales">Sales Invoice</option>
                <option value="Purchase">Purchase Invoice</option>
              </select>
            </div>
            <div>
              <Label>Contact</Label>
              <Input placeholder="Select contact" className="mt-1" />
            </div>
            <div>
              <Label>Invoice Date</Label>
              <Input type="date" className="mt-1" />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Items</Label>
              <div className="border rounded-md p-4 mt-1">
                <p className="text-sm text-muted-foreground text-center py-8">
                  Add invoice items here
                </p>
              </div>
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialog({ open: false, editing: null })}>Cancel</Button>
            <Button>Create Invoice</Button>
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
