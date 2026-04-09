import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '../context/AuthContext';
import {
  Users, UserPlus, Search, Filter, Download, Upload,
  Edit2, Trash2, Eye, FileText, Calendar, MapPin, Phone, Mail
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
import { Textarea } from '@/components/ui/textarea';

// Employee Form Interface
interface EmployeeForm {
  employee_code: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  marital_status: string;
  personal_email: string;
  personal_phone: string;
  current_address: string;
  permanent_address: string;
  citizenship_number: string;
  pan_number: string;
  bank_name: string;
  account_number: string;
  branch_id: string;
  department_id: string;
  designation_id: string;
  employment_type: string;
  employment_status: string;
  date_of_joining: string;
  reporting_manager_id: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
}

const emptyForm: EmployeeForm = {
  employee_code: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  date_of_birth: '',
  gender: '',
  marital_status: '',
  personal_email: '',
  personal_phone: '',
  current_address: '',
  permanent_address: '',
  citizenship_number: '',
  pan_number: '',
  bank_name: '',
  account_number: '',
  branch_id: '',
  department_id: '',
  designation_id: '',
  employment_type: 'Full-time',
  employment_status: 'Active',
  date_of_joining: new Date().toISOString().split('T')[0],
  reporting_manager_id: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relation: '',
};

export const EmployeeManagement: React.FC = () => {
  const { user } = useAuth();
  
  // State
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Dialogs
  const [formDialog, setFormDialog] = useState({ open: false, editing: null as any });
  const [viewDialog, setViewDialog] = useState({ open: false, employee: null as any });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, employee: null as any });
  
  // Form state
  const [formData, setFormData] = useState<EmployeeForm>(emptyForm);
  const [formStep, setFormStep] = useState(1);
  const [formStatus, setFormStatus] = useState('');

  // Load data
  useEffect(() => {
    loadData();

    // Listen for sync events to refresh data
    const handleDataSynced = () => loadData();
    window.addEventListener('data-synced', handleDataSynced);

    return () => {
      window.removeEventListener('data-synced', handleDataSynced);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empResult, branchData] = await Promise.all([
        invoke<any>('list_employees'),
        invoke<any[]>('list_branches'),
      ]);
      // Handle both flat array and wrapped {success, data, count} format
      const empData = Array.isArray(empResult) ? empResult : (empResult as any)?.data || [];
      setEmployees(empData);
      setBranches(branchData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setEmployees([]);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const name = emp.full_name || `${emp.first_name || ''} ${emp.middle_name || ''} ${emp.last_name || ''}`.trim();
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Form handlers
  const handleAddEmployee = () => {
    setFormData(emptyForm);
    setFormStep(1);
    setFormStatus('');
    setFormDialog({ open: true, editing: null });
  };

  const handleEditEmployee = (emp: any) => {
    setFormData({
      ...emptyForm,
      ...emp,
    });
    setFormStep(1);
    setFormStatus('');
    setFormDialog({ open: true, editing: emp });
  };

  const handleSaveEmployee = async () => {
    if (!formData.first_name || !formData.last_name || !formData.employee_code) {
      setFormStatus('❌ First name, last name, and employee code are required');
      return;
    }

    setFormStatus('');
    try {
      // Build full request with all fields from the form
      const request = {
        employee_code: formData.employee_code,
        first_name: formData.first_name,
        middle_name: formData.middle_name || undefined,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth || undefined,
        gender: formData.gender || undefined,
        personal_email: formData.personal_email || undefined,
        personal_phone: formData.personal_phone || undefined,
        current_address: formData.current_address || undefined,
        permanent_address: formData.permanent_address || undefined,
        citizenship_number: formData.citizenship_number || undefined,
        pan_number: formData.pan_number || undefined,
        branch_id: formData.branch_id ? String(formData.branch_id) : undefined,
        department_id: formData.department_id || undefined,
        designation_id: formData.designation_id || undefined,
        employment_type: formData.employment_type || undefined,
        employment_status: formData.employment_status || 'Active',
        date_of_joining: formData.date_of_joining || undefined,
        reporting_manager_id: formData.reporting_manager_id || undefined,
        bank_name: formData.bank_name || undefined,
        account_number: formData.account_number || undefined,
      };

      // Save using the crud commands (local SQLite first)
      if (formDialog.editing) {
        await invoke('crud::update_employee', {
          employeeId: formDialog.editing.id,
          request,
        });
      } else {
        await invoke('crud::create_employee', { request });
      }

      setFormStatus('✅ Employee saved successfully!');
      loadData();

      setTimeout(() => {
        setFormDialog({ open: false, editing: null });
      }, 1500);
    } catch (error: any) {
      setFormStatus('❌ Failed to save: ' + (error?.message || error));
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deleteDialog.employee) return;
    try {
      await invoke('crud::delete_employee', { employeeId: deleteDialog.employee.id });
      setDeleteDialog({ open: false, employee: null });
      loadData();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const exportToCSV = () => {
    const headers = ['Employee Code', 'Name', 'Department', 'Branch', 'Status', 'Joining Date'];
    const csvContent = [
      headers.join(','),
      ...employees.map(emp => [
        emp.employee_code || '',
        emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || '',
        emp.department || '',
        emp.branch_name || '',
        emp.status || 'Active',
        emp.date_of_joining || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Employee Management</h1>
          <p className="text-muted-foreground">
            Manage employee master data, personal details, and employment information
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={handleAddEmployee}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Employees</p>
              <p className="text-2xl font-bold">{employees.length}</p>
            </div>
            <Users className="w-8 h-8 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600">
                {employees.filter(e => e.status === 'Active' || !e.status).length}
              </p>
            </div>
            <Users className="w-8 h-8 text-green-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">On Leave</p>
              <p className="text-2xl font-bold text-orange-600">
                {employees.filter(e => e.status === 'On Leave').length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-orange-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Inactive</p>
              <p className="text-2xl font-bold text-red-600">
                {employees.filter(e => e.status === 'Inactive').length}
              </p>
            </div>
            <Users className="w-8 h-8 text-red-600" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or employee code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 rounded-md border border-input bg-background text-sm w-48"
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Employee Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joining Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No employees found. Add your first employee to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map(emp => (
                  <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">{emp.employee_code || `#${emp.id}`}</TableCell>
                    <TableCell className="font-medium">
                      {emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{emp.department || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{emp.branch_name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={emp.employment_status === 'Active' || !emp.employment_status ? 'default' : 'secondary'}>
                        {emp.employment_status || 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {emp.date_of_joining || '—'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewDialog({ open: true, employee: emp })}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEditEmployee(emp)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, employee: emp })}>
                          <Trash2 className="w-4 h-4 text-destructive" />
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

      {/* Add/Edit Employee Dialog */}
      <Dialog open={formDialog.open} onOpenChange={(open) => !open && setFormDialog({ open: false, editing: null })}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formDialog.editing ? 'Edit Employee' : 'Add New Employee'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Step Indicators */}
            <div className="flex gap-2 mb-6">
              {[1, 2, 3].map(step => (
                <button
                  key={step}
                  onClick={() => setFormStep(step)}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    formStep === step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step === 1 ? 'Personal Info' : step === 2 ? 'Employment' : 'Contact & Bank'}
                </button>
              ))}
            </div>

            {/* Step 1: Personal Information */}
            {formStep === 1 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Employee Code *</Label>
                  <Input
                    value={formData.employee_code}
                    onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                    placeholder="EMP001"
                  />
                </div>
                <div>
                  <Label>First Name *</Label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label>Middle Name</Label>
                  <Input
                    value={formData.middle_name}
                    onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                    placeholder="Kumar"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Last Name *</Label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Gender</Label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            )}

            {/* Step 2: Employment Details */}
            {formStep === 2 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Branch</Label>
                  <select
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Employment Type</Label>
                  <select
                    value={formData.employment_type}
                    onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>
                <div>
                  <Label>Date of Joining</Label>
                  <Input
                    type="date"
                    value={formData.date_of_joining}
                    onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Contact & Bank Details */}
            {formStep === 3 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Personal Email</Label>
                  <Input
                    type="email"
                    value={formData.personal_email}
                    onChange={(e) => setFormData({ ...formData, personal_email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label>Personal Phone</Label>
                  <Input
                    value={formData.personal_phone}
                    onChange={(e) => setFormData({ ...formData, personal_phone: e.target.value })}
                    placeholder="+977-98XXXXXXXX"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Current Address</Label>
                  <Textarea
                    value={formData.current_address}
                    onChange={(e) => setFormData({ ...formData, current_address: e.target.value })}
                    placeholder="Current address..."
                  />
                </div>
                <div>
                  <Label>Bank Name</Label>
                  <Input
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="Bank name"
                  />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="Account number"
                  />
                </div>
              </div>
            )}

            {formStatus && (
              <div className={`p-3 rounded-md ${
                formStatus.includes('❌') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
              }`}>
                {formStatus}
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {formStep > 1 && (
                <Button variant="outline" onClick={() => setFormStep(formStep - 1)}>
                  Previous
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setFormDialog({ open: false, editing: null })}>
                Cancel
              </Button>
              {formStep < 3 ? (
                <Button onClick={() => setFormStep(formStep + 1)}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleSaveEmployee}>
                  {formDialog.editing ? 'Update' : 'Create'} Employee
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Employee Dialog */}
      <Dialog open={viewDialog.open} onOpenChange={(open) => !open && setViewDialog({ open: false, employee: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          {viewDialog.employee && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold">
                  {viewDialog.employee.name?.charAt(0) || '?'}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{viewDialog.employee.name}</h3>
                  <p className="text-muted-foreground">{viewDialog.employee.employee_code || `#${viewDialog.employee.id}`}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{viewDialog.employee.department || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Branch</p>
                  <p className="font-medium">{viewDialog.employee.branch_name || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge>{viewDialog.employee.status || 'Active'}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Joining Date</p>
                  <p className="font-medium">{viewDialog.employee.date_of_joining || '—'}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewDialog({ open: false, employee: null })}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, employee: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete employee <strong>{deleteDialog.employee?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, employee: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteEmployee}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
