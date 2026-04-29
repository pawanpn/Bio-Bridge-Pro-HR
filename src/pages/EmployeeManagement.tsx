import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '../context/AuthContext';
import { supabase } from '@/config/supabase';
import { Switch } from '@/components/ui/switch';
import {
  Users, UserPlus, Search, Filter, Download, Upload,
  Edit2, Trash2, Eye, FileText, Calendar, MapPin, Phone, Mail,
  HardDrive, Loader2, AlertCircle, CheckCircle, Info,
  Settings, User, Shield, Clock, FileStack, Smartphone, Fingerprint, MessageSquare, Plus, X, Key
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
import { OrgSetupDialog } from '../components/OrgSetupDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  area_id: string;
  location_id: string;
  photo: string;
  enable_self_service: boolean;
  enable_mobile_access: boolean;
  local_name: string;
  national_id: string;
  contact_tel: string;
  office_tel: string;
  motorcycle_license: string;
  automobile_license: string;
  religion: string;
  city: string;
  postcode: string;
  passport_no: string;
  nationality: string;
  verification_mode: string;
  device_privilege: string;
  device_password: string;
  card_no: string;
  bio_photo: string;
  enable_attendance: boolean;
  enable_holiday: boolean;
  outdoor_management: boolean;
  workflow_role: string;
  mobile_punch: boolean;
  app_role: string;
  whatsapp_alert: boolean;
  whatsapp_exception: boolean;
  whatsapp_punch: boolean;
  supervisor_mobile: string;
  biometric_id?: number | string;
  shift_start_time?: string;
  shift_end_time?: string;
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
  area_id: '',
  location_id: '',
  photo: '',
  enable_self_service: false,
  enable_mobile_access: false,
  local_name: '',
  national_id: '',
  contact_tel: '',
  office_tel: '',
  motorcycle_license: '',
  automobile_license: '',
  religion: '',
  city: '',
  postcode: '',
  passport_no: '',
  nationality: '',
  verification_mode: '',
  device_privilege: '',
  device_password: '',
  card_no: '',
  bio_photo: '',
  enable_attendance: true,
  enable_holiday: true,
  outdoor_management: false,
  workflow_role: '',
  mobile_punch: false,
  app_role: 'employee',
  whatsapp_alert: false,
  whatsapp_exception: false,
  whatsapp_punch: false,
  supervisor_mobile: '',
  biometric_id: '',
  shift_start_time: '',
  shift_end_time: '',
};

export const EmployeeManagement: React.FC = () => {
  const { user, resetPassword } = useAuth();
  
  // State
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'directory' | 'setup' | 'deleted'>('directory');
  
  // Dialogs
  const [formDialog, setFormDialog] = useState({ open: false, editing: null as any });
  const [viewDialog, setViewDialog] = useState({ open: false, employee: null as any });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, employee: null as any });
  const [importDialog, setImportDialog] = useState({ open: false });
  const [orgSetupOpen, setOrgSetupOpen] = useState(false);
  
  // Import state
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState<EmployeeForm>(emptyForm);
  const [formStep, setFormStep] = useState(1);
  const [formStatus, setFormStatus] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Load data
  useEffect(() => {
    loadData();

    // Listen for sync events to refresh data
    const handleDataSynced = () => loadData();
    window.addEventListener('data-synced', handleDataSynced);

    return () => {
      window.removeEventListener('data-synced', handleDataSynced);
    };
  }, [viewMode]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('[EmployeeManagement] Loading data...');
      const [empResult, branchData, deviceData, deptData, desigData] = await Promise.all([
        invoke<any>('list_employees', { statusFilter: viewMode === 'deleted' ? 'deleted' : 'active' }),
        invoke<any[]>('list_branches'),
        invoke<any[]>('list_all_devices'),
        invoke<any[]>('list_departments'),
        invoke<any[]>('list_designations'),
      ]);
      
      console.log('[EmployeeManagement] Raw branch data:', branchData);
      console.log('[EmployeeManagement] Raw device data:', deviceData);
      console.log('[EmployeeManagement] Branch data type:', typeof branchData, Array.isArray(branchData));
      console.log('[EmployeeManagement] Device data type:', typeof deviceData, Array.isArray(deviceData));
      
      // Handle both flat array and wrapped {success, data, count} format
      const empData = Array.isArray(empResult) ? empResult : (empResult as any)?.data || [];
      const branches = Array.isArray(branchData) ? branchData : [];
      const devices = Array.isArray(deviceData) ? deviceData : [];
      
      console.log('[EmployeeManagement] Setting employees:', empData.length);
      console.log('[EmployeeManagement] Setting branches:', branches.length, branches);
      console.log('[EmployeeManagement] Setting devices:', devices.length, devices);
      
      setEmployees(empData);
      setBranches(branches);
      setDevices(devices);
      setDepartments(Array.isArray(deptData) ? deptData : []);
      setDesignations(Array.isArray(desigData) ? desigData : []);
      if ((empResult as any)?.debug) {
        setDebugInfo((empResult as any).debug);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setEmployees([]);
      setBranches([]);
      setDevices([]);
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

  const filteredDepartments = formData.branch_id 
    ? departments.filter(d => !d.branch_id || d.branch_id.toString() === formData.branch_id?.toString())
    : departments;

  const filteredDesignations = formData.branch_id 
    ? designations.filter(d => !d.branch_id || d.branch_id.toString() === formData.branch_id?.toString())
    : designations;

  // Form handlers
  const handleNextStep = () => {
    if (formStep < 8) setFormStep(s => s + 1);
  };

  const handlePrevStep = () => {
    if (formStep > 1) setFormStep(s => s - 1);
  };

  const handleNextEmployee = () => {
    if (!formDialog.editing) return;
    const currentIndex = filteredEmployees.findIndex(e => e.id === formDialog.editing.id);
    if (currentIndex < filteredEmployees.length - 1) {
      handleEditEmployee(filteredEmployees[currentIndex + 1]);
    }
  };

  const handlePrevEmployee = () => {
    if (!formDialog.editing) return;
    const currentIndex = filteredEmployees.findIndex(e => e.id === formDialog.editing.id);
    if (currentIndex > 0) {
      handleEditEmployee(filteredEmployees[currentIndex - 1]);
    }
  };

  const handleAddEmployee = () => {
    const checkLimit = async () => {
      try {
        const userId = (window as any).__biobridge_user?.id;
        if (!userId) return null;

        const { data: userData } = await supabase.from('users').select('organization_id').eq('id', userId).single();
        if (!userData?.organization_id) return null;

        const orgId = userData.organization_id;
        const [{ data: org }, { count }] = await Promise.all([
          supabase.from('organizations').select('max_users').eq('id', orgId).single(),
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
        ]);

        if (org?.max_users && count && count >= org.max_users) {
          return `User limit reached (${count}/${org.max_users}). Contact your provider to upgrade.`;
        }
        return null;
      } catch { return null; }
    };

    checkLimit().then(limitMsg => {
      if (limitMsg) {
        setFormStatus(`❌ ${limitMsg}`);
        return;
      }
      const maxId = employees.reduce((max, emp) => Math.max(max, parseInt(emp.id) || 0), 0);
      const nextCode = `BB-${String(maxId + 1).padStart(4, '0')}`;
      setFormData({ ...emptyForm, employee_code: nextCode });
      setFormStep(1);
      setFormStatus('');
      setFormDialog({ open: true, editing: null });
    });
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
        marital_status: formData.marital_status || undefined,
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
        emergency_contact_relation: formData.emergency_contact_relation || undefined,
        area_id: formData.area_id || undefined,
        location_id: formData.location_id || undefined,
        photo: formData.photo || undefined,
        enable_self_service: formData.enable_self_service,
        enable_mobile_access: formData.enable_mobile_access,
        local_name: formData.local_name || undefined,
        national_id: formData.national_id || undefined,
        contact_tel: formData.contact_tel || undefined,
        office_tel: formData.office_tel || undefined,
        motorcycle_license: formData.motorcycle_license || undefined,
        automobile_license: formData.automobile_license || undefined,
        religion: formData.religion || undefined,
        city: formData.city || undefined,
        postcode: formData.postcode || undefined,
        passport_no: formData.passport_no || undefined,
        nationality: formData.nationality || undefined,
        verification_mode: formData.verification_mode || undefined,
        device_privilege: formData.device_privilege || undefined,
        device_password: formData.device_password || undefined,
        card_no: formData.card_no || undefined,
        bio_photo: formData.bio_photo || undefined,
        enable_attendance: formData.enable_attendance,
        enable_holiday: formData.enable_holiday,
        outdoor_management: formData.outdoor_management,
        workflow_role: formData.workflow_role || undefined,
        mobile_punch: formData.mobile_punch,
        app_role: formData.app_role || undefined,
        whatsapp_alert: formData.whatsapp_alert,
        whatsapp_exception: formData.whatsapp_exception,
        whatsapp_punch: formData.whatsapp_punch,
        supervisor_mobile: formData.supervisor_mobile || undefined,
        biometric_id: formData.biometric_id ? parseInt(String(formData.biometric_id)) : undefined,
        shift_start_time: formData.shift_start_time || undefined,
        shift_end_time: formData.shift_end_time || undefined,
      };

      // Save using the crud commands (local SQLite first)
      let savedEmployeeId: number | null = null;
      if (formDialog.editing) {
        await invoke('update_employee', {
          employeeId: formDialog.editing.id,
          request,
        });
        savedEmployeeId = formDialog.editing.id;
      } else {
        const result: any = await invoke('create_employee', { request });
        savedEmployeeId = result?.employee_id || null;
      }

      setFormStatus('✅ Employee saved successfully!');
      loadData();

      // Auto-sync to device if employee has biometric_id and devices exist
      const savedBiometricId = formData.biometric_id ? parseInt(String(formData.biometric_id)) : undefined;
      const targetDeviceId = devices.length > 0
        ? (parseInt(selectedDeviceId) || devices.find((d: any) => d.is_default)?.id || devices[0].id)
        : null;

      if (savedBiometricId && targetDeviceId && savedEmployeeId) {
        try {
          await invoke('push_employee_to_device', {
            deviceId: targetDeviceId,
            employeeId: savedEmployeeId,
          });
          setFormStatus('✅ Employee saved and synced to device!');
        } catch (syncErr: any) {
          console.warn('Device sync failed:', syncErr);
          setFormStatus('✅ Employee saved! (Device sync failed: ' + (syncErr?.message || 'check connection') + ')');
        }
      }

      setTimeout(() => {
        setFormDialog({ open: false, editing: null });
      }, 1500);
    } catch (error: any) {
      setFormStatus('❌ Failed to save: ' + (error?.message || error));
    }
  };

  const handleSyncToDevice = async () => {
    if (!formDialog.editing || !formData.biometric_id) {
      setFormStatus('❌ Biometric ID is required to sync to device');
      return;
    }

    if (devices.length === 0) {
      setFormStatus('❌ No devices available to sync');
      return;
    }

    setLoading(true);
    setFormStatus('🔄 Syncing user to device...');
    try {
      await invoke('push_employee_to_device', {
        deviceId: parseInt(selectedDeviceId) || devices.find((d: any) => d.is_default)?.id || devices[0].id,
        employeeId: formDialog.editing.id,
      });
      setFormStatus('✅ Employee name synced to device successfully!');
    } catch (error: any) {
      console.error('Sync error:', error);
      setFormStatus('❌ Sync failed: ' + (error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  const handlePullBiometric = async () => {
    if (!formDialog.editing || !formData.biometric_id) {
      setFormStatus('❌ Biometric ID is required to pull data');
      return;
    }

    if (devices.length === 0) {
      setFormStatus('❌ No devices available');
      return;
    }

    setLoading(true);
    setFormStatus('🔄 Pulling biometric from device...');
    try {
      const data = await invoke('pull_employee_biometric', {
        deviceId: parseInt(selectedDeviceId) || devices.find((d: any) => d.is_default)?.id || devices[0].id,
        employeeId: formDialog.editing.id,
      });
      console.log('Pulled biometric data:', data);
      setFormStatus('✅ Biometric pulled successfully! (Verified ' + (Array.isArray(data) ? data.length : 0) + ' templates)');
    } catch (error: any) {
      console.error('Pull error:', error);
      setFormStatus('❌ Pull failed: ' + (error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deleteDialog.employee) return;
    try {
      await invoke('delete_employee', { employeeId: deleteDialog.employee.id });
      setDeleteDialog({ open: false, employee: null });
      loadData();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleRestoreEmployee = async (id: number) => {
    try {
      setLoading(true);
      await invoke('restore_employee', { employeeId: id });
      loadData();
    } catch (error: any) {
      console.error('Restore error:', error);
      alert('Failed to restore: ' + (error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromDevice = async () => {
    // Reload data to ensure we have the latest devices and branches
    await loadData();
    setImportDialog({ open: true });
    setImportResult(null);
    setSelectedDeviceId('');
    setSelectedBranchId('');
  };

  const handleExecuteImport = async () => {
    if (!selectedDeviceId || !selectedBranchId) {
      setImportResult({ success: false, error: 'Please select both device and branch' });
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const result = await invoke<any>('import_device_employees', {
        deviceId: parseInt(selectedDeviceId),
        branchId: parseInt(selectedBranchId),
      });

      setImportResult(result);
      
      if (result.success) {
        loadData();
        setTimeout(() => {
          setImportDialog({ open: false });
          setImportResult(null);
        }, 3000);
      }
    } catch (error: any) {
      setImportResult({
        success: false,
        error: error?.message || error || 'Failed to import employees'
      });
    } finally {
      setImporting(false);
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
        {viewMode === 'setup' && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setOrgSetupOpen(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Org Structure
            </Button>
            <Button variant="outline" onClick={handleImportFromDevice}>
              <HardDrive className="w-4 h-4 mr-2" />
              Import from Device
            </Button>
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={handleAddEmployee}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </div>
        )}
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
          <div className="flex gap-4 items-center">
            <div className="flex gap-2 bg-muted/50 p-1 rounded-lg border border-border/50 mr-2">
              <Button 
                variant={viewMode === 'directory' ? 'default' : 'ghost'} 
                onClick={() => setViewMode('directory')}
                className="rounded-md"
              >
                Directory
              </Button>
              <Button 
                variant={viewMode === 'setup' ? 'secondary' : 'ghost'} 
                onClick={() => setViewMode('setup')}
                className="rounded-md gap-2"
              >
                Setup
              </Button>
              <Button 
                variant={viewMode === 'deleted' ? 'destructive' : 'ghost'} 
                onClick={() => setViewMode('deleted')}
                className="rounded-md gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Archive
              </Button>
            </div>
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
                <TableHead>Employee ID</TableHead>
                <TableHead>Attendance Device ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                {viewMode === 'deleted' && <TableHead>Deleted Date</TableHead>}
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
                    <TableCell className="text-muted-foreground font-mono text-xs">{emp.biometric_id || '—'}</TableCell>
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
                    {viewMode === 'deleted' && (
                      <TableCell className="text-red-600 font-medium text-xs">
                        {emp.deleted_at || '—'}
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground text-sm">
                      {emp.date_of_joining || '—'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewDialog({ open: true, employee: emp })}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {viewMode === 'setup' && (
                          <>
                            <Button variant="ghost" size="icon" title="Reset Password" onClick={async () => {
                              if(confirm('Send password reset email to this employee?')) {
                                const res = await resetPassword(emp.employee_code || emp.email);
                                if(res.success) alert('Password reset link sent to the employee.');
                                else alert('Failed to send reset link: ' + res.error);
                              }
                            }}>
                              <Key className="w-4 h-4 text-orange-500" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEditEmployee(emp)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, employee: emp })}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {viewMode === 'deleted' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleRestoreEmployee(emp.id)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Restore"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Debug Info Footer */}
      {debugInfo && (
        <div className="mt-4 p-2 bg-muted/30 rounded text-[10px] font-mono flex gap-4 text-muted-foreground uppercase">
          <span>Row Count in DB: {debugInfo.total_in_db}</span>
          <span>Active Count: {debugInfo.total_active}</span>
          <span>Branch Filter: {JSON.stringify(debugInfo.branch_filter || 'None')}</span>
        </div>
      )}

      {/* Add/Edit Employee Dialog */}
      <Dialog open={formDialog.open} onOpenChange={(open) => !open && setFormDialog({ open: false, editing: null })}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                {formDialog.editing ? (
                  <><Edit2 className="w-5 h-5 text-primary" /> Edit Employee</>
                ) : (
                  <><UserPlus className="w-5 h-5 text-primary" /> Add New Employee</>
                )}
              </DialogTitle>
              <div className="flex gap-2 pr-12">
                <Button variant="ghost" onClick={() => setFormDialog({ open: false, editing: null })}>
                  Discard
                </Button>
                <Button onClick={handleSaveEmployee} className="bg-primary hover:bg-primary/95 text-white min-w-[80px] shadow-sm">
                  Save
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Navigation */}
            <div className="w-64 border-r bg-muted/30 overflow-y-auto p-4 space-y-1">
              {[
                { id: 1, label: 'Profile', icon: User },
                { id: 2, label: 'Account Settings', icon: Settings },
                { id: 3, label: 'Personal Information', icon: Info },
                { id: 4, label: 'Device Settings', icon: Shield },
                { id: 5, label: 'Attendance Setting', icon: Clock },
                { id: 6, label: 'Document Setting', icon: FileStack },
                { id: 7, label: 'Mobile App Settings', icon: Smartphone },
                { id: 8, label: 'WhatsApp Settings', icon: MessageSquare },
              ].map((section) => (
                <button
                  key={section.id}
                  onClick={() => setFormStep(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    formStep === section.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <section.icon className="w-4 h-4" />
                  {section.label}
                </button>
              ))}
            </div>

            {/* Main Form Content */}
            <div className="flex-1 overflow-y-auto p-8">
              {formStatus && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                  formStatus.includes('❌') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {formStatus.includes('❌') ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                  <p className="text-sm font-medium">{formStatus}</p>
                </div>
              )}

              {/* Section 1: Profile */}
              {formStep === 1 && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="flex justify-between items-start border-b pb-4">
                    <div>
                      <h3 className="text-lg font-semibold">Profile</h3>
                      <p className="text-sm text-muted-foreground">Basic identity and employment assignment</p>
                    </div>
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                      <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Photo</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="emp_id" className="text-sm font-semibold">Employee ID *</Label>
                      <Input
                        id="emp_id"
                        value={formData.employee_code}
                        onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                        placeholder="BB-0001"
                        disabled={!!formDialog.editing}
                        className="bg-background disabled:opacity-75 disabled:bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.personal_email}
                        onChange={(e) => setFormData({ ...formData, personal_email: e.target.value })}
                        placeholder="employee@company.com"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="first_name" className="text-sm font-semibold">First Name *</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="John"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name" className="text-sm font-semibold">Last Name *</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Doe"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="doj" className="text-sm font-semibold">Date of Joining</Label>
                      <Input
                        id="doj"
                        type="date"
                        value={formData.date_of_joining}
                        onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch" className="text-sm font-semibold">Branch *</Label>
                      <select
                        id="branch"
                        value={formData.branch_id}
                        onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      >
                        <option value="">Select Branch</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6 w-full">
                    <div className="space-y-2">
                      <Label htmlFor="department" className="text-sm font-semibold">Department *</Label>
                      <select
                        id="department"
                        value={formData.department_id}
                        onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      >
                        <option value="">Select Department</option>
                        {filteredDepartments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position" className="text-sm font-semibold">Position *</Label>
                      <select
                        id="position"
                        value={formData.designation_id}
                        onChange={(e) => setFormData({ ...formData, designation_id: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      >
                        <option value="">Select Position</option>
                        {filteredDesignations.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emp_type" className="text-sm font-semibold">Employment Type</Label>
                      <select
                        id="emp_type"
                        value={formData.employment_type}
                        onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      >
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Contract">Contract</option>
                        <option value="Intern">Intern</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 2: Account Settings */}
              {formStep === 2 && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold">Account Settings</h3>
                    <p className="text-sm text-muted-foreground">Manage system access and privileges</p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border">
                      <div className="space-y-0.5">
                        <Label className="text-base font-semibold">Enable Self-Service Login *</Label>
                        <p className="text-xs text-muted-foreground">When enabled, employees can log in via the web portal.</p>
                      </div>
                      <Switch 
                        checked={formData.enable_self_service}
                        onCheckedChange={(val) => setFormData({ ...formData, enable_self_service: val })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border">
                      <div className="space-y-0.5">
                        <Label className="text-base font-semibold">Enable Mobile App Access *</Label>
                        <p className="text-xs text-muted-foreground">Allow access to the mobile application for this employee.</p>
                      </div>
                      <Switch 
                        checked={formData.enable_mobile_access}
                        onCheckedChange={(val) => setFormData({ ...formData, enable_mobile_access: val })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Section 3: Personal Information */}
              {formStep === 3 && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                       Personal Information <Shield className="w-4 h-4 text-primary" />
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Birth Date</Label>
                      <Input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Local Name</Label>
                      <Input value={formData.local_name} onChange={(e) => setFormData({ ...formData, local_name: e.target.value })} placeholder="Original script name" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">National ID Number</Label>
                      <Input value={formData.national_id} onChange={(e) => setFormData({ ...formData, national_id: e.target.value })} placeholder="Citizenship / ID Card" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Mobile</Label>
                      <Input value={formData.personal_phone} onChange={(e) => setFormData({ ...formData, personal_phone: e.target.value })} placeholder="+X XXX XXX XXXX" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Contact Tel</Label>
                      <Input value={formData.contact_tel} onChange={(e) => setFormData({ ...formData, contact_tel: e.target.value })} placeholder="Emergency contact" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Office Tel</Label>
                      <Input value={formData.office_tel} onChange={(e) => setFormData({ ...formData, office_tel: e.target.value })} placeholder="Direct extension" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Motorcycle License</Label>
                      <Input value={formData.motorcycle_license} onChange={(e) => setFormData({ ...formData, motorcycle_license: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Automobile License</Label>
                      <Input value={formData.automobile_license} onChange={(e) => setFormData({ ...formData, automobile_license: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Religion</Label>
                      <Input value={formData.religion} onChange={(e) => setFormData({ ...formData, religion: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">City</Label>
                      <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                    </div>
                    <div className="space-y-2 col-span-1">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Postcode</Label>
                      <Input value={formData.postcode} onChange={(e) => setFormData({ ...formData, postcode: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Gender</Label>
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
                    <div className="col-span-2 space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Permanent Address</Label>
                      <Input value={formData.permanent_address} onChange={(e) => setFormData({ ...formData, permanent_address: e.target.value })} placeholder="Full home address" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Passport NO.</Label>
                      <Input value={formData.passport_no} onChange={(e) => setFormData({ ...formData, passport_no: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Nationality</Label>
                      <Input value={formData.nationality} onChange={(e) => setFormData({ ...formData, nationality: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              {/* Section 4: Device Settings */}
              {formStep === 4 && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="flex justify-between items-start border-b pb-4">
                    <div>
                      <h3 className="text-lg font-semibold">Device Settings</h3>
                      <p className="text-sm text-muted-foreground">Hardware authentication configuration</p>
                    </div>
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                      <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                      <span className="text-[10px] text-muted-foreground uppercase font-bold text-center">Bio-photo</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Verification Mode</Label>
                      <select
                        value={formData.verification_mode}
                        onChange={(e) => setFormData({ ...formData, verification_mode: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      >
                        <option value="">Default Selection</option>
                        <option value="FP/PW/RF">FP/PW/RF</option>
                        <option value="Face/FP/PW">Face/FP/PW</option>
                        <option value="Card">Card Only</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Device Privilege</Label>
                      <select
                        value={formData.device_privilege}
                        onChange={(e) => setFormData({ ...formData, device_privilege: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      >
                        <option value="Normal User">Normal User</option>
                        <option value="Registrar">Registrar</option>
                        <option value="Admin">Device Admin</option>
                        <option value="Super Admin">Super Device Admin</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Device Password</Label>
                      <Input type="password" value={formData.device_password} onChange={(e) => setFormData({ ...formData, device_password: e.target.value })} placeholder="Hardware PIN" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Card NO.</Label>
                      <Input value={formData.card_no} onChange={(e) => setFormData({ ...formData, card_no: e.target.value })} placeholder="RFID Card ID" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-xs font-bold uppercase text-muted-foreground">Attendance Device ID</Label>
                       <Input 
                         type="number" 
                         value={formData.biometric_id} 
                         onChange={(e) => setFormData({ ...formData, biometric_id: e.target.value })} 
                         placeholder="Bio Device ID (e.g. 101)" 
                         className="border-primary/30"
                       />
                       <p className="text-[10px] text-muted-foreground">This ID must match the ID on your hardware device for log linking.</p>
                    </div>
                    <div className="col-span-2 space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground uppercase">Target Device for Sync</Label>
                          <select 
                            value={selectedDeviceId}
                            onChange={(e) => setSelectedDeviceId(e.target.value)}
                            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                          >
                             <option value="">Select Device...</option>
                             {devices.map(d => (
                               <option key={d.id} value={d.id}>{d.name} ({d.ip})</option>
                             ))}
                          </select>
                        </div>
                        <Button 
                          variant="default" 
                          onClick={handleSyncToDevice}
                          disabled={!formData.biometric_id || devices.length === 0}
                          className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2"
                        >
                          <Smartphone className="w-4 h-4" />
                          Push Name to Device
                        </Button>
                      </div>

                      <Button 
                        variant="outline" 
                        onClick={handlePullBiometric}
                        disabled={!formData.biometric_id || devices.length === 0}
                        className="w-full border-dashed h-12 gap-2 text-muted-foreground hover:text-primary"
                      >
                        <Fingerprint className="w-5 h-5" />
                         Pull Biometric (Fingerprint/Face) from Device
                      </Button>
                      <p className="text-[10px] text-center text-muted-foreground italic">
                        Note: User must already be added to the device with ID #{formData.biometric_id}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 5: Attendance Setting */}
              {formStep === 5 && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-primary">Attendance Setting</h3>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-muted/10 rounded-lg border">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-bold">Enable Attendance *</Label>
                        <p className="text-xs text-muted-foreground italic">When enabled, the system will include the employee in attendance calculations.</p>
                      </div>
                      <Switch 
                        checked={formData.enable_attendance}
                        onCheckedChange={(val) => setFormData({ ...formData, enable_attendance: val })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/10 rounded-lg border">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-bold">Enable Holiday *</Label>
                        <p className="text-xs text-muted-foreground italic">When enabled, the system will automatically assign configured holidays.</p>
                      </div>
                      <Switch 
                        checked={formData.enable_holiday}
                        onCheckedChange={(val) => setFormData({ ...formData, enable_holiday: val })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/10 rounded-lg border">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-bold">Outdoor Management</Label>
                        <p className="text-[10px] text-muted-foreground italic">Allow attendance logs from mobile GPS outside office</p>
                      </div>
                      <Switch 
                        checked={formData.outdoor_management}
                        onCheckedChange={(val) => setFormData({ ...formData, outdoor_management: val })}
                      />
                    </div>

                    {/* Shift Time Configuration */}
                    <Card className="border-dashed bg-slate-50/50">
                      <CardHeader className="pb-2 px-4 pt-4">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" /> Shift Configuration
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-slate-500">Custom Shift Start</Label>
                            <Input 
                              type="time" 
                              value={formData.shift_start_time} 
                              onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })} 
                              className="bg-white h-9"
                            />
                            <p className="text-[9px] text-slate-400 italic">Leave empty to use global office time (09:15)</p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-slate-500">Custom Shift End</Label>
                            <Input 
                              type="time" 
                              value={formData.shift_end_time} 
                              onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })} 
                              className="bg-white h-9"
                            />
                          </div>
                        </div>
                        <div className="bg-blue-50/50 border border-blue-100 rounded p-2 flex gap-2">
                          <Info className="w-4 h-4 text-blue-500 shrink-0" />
                          <p className="text-[10px] text-blue-700 leading-tight">
                            If an employee is <strong>Regular</strong>, keep these empty. For <strong>Part-time</strong> or custom shifts, enter the specific start time to calculate late entries correctly.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                       <Label className="text-xs font-bold uppercase text-muted-foreground">Workflow Role</Label>
                       <select
                        value={formData.workflow_role}
                        onChange={(e) => setFormData({ ...formData, workflow_role: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      >
                        <option value="">Select Role</option>
                        <option value="Self">Self Only</option>
                        <option value="Manager">Line Manager</option>
                        <option value="HR">HR Approver</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 6: Document Setting */}
              {formStep === 6 && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="flex justify-between items-center border-b pb-4">
                    <h3 className="text-lg font-semibold">Document Setting</h3>
                    <Button size="sm" className="bg-primary h-8 px-3">
                      <Plus className="w-4 h-4 mr-1" /> Add Document
                    </Button>
                  </div>
                  
                  <Table className="border rounded-md">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[40%] text-xs font-bold">Document</TableHead>
                        <TableHead className="text-xs font-bold">Valid Up To</TableHead>
                        <TableHead className="text-xs font-bold text-center">Email Alert</TableHead>
                        <TableHead className="text-xs font-bold">Alert Before</TableHead>
                        <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic">
                           No documents uploaded for this employee
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Section 7: Mobile App Settings */}
              {formStep === 7 && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold">Mobile App Settings</h3>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-muted/10 rounded-lg border">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-bold">Mobile App Punch *</Label>
                        <p className="text-xs text-muted-foreground italic">When enabled, employees can use the mobile app to punch attendance.</p>
                      </div>
                      <Switch 
                        checked={formData.mobile_punch}
                        onCheckedChange={(val) => setFormData({ ...formData, mobile_punch: val })}
                      />
                    </div>

                    <div className="space-y-2">
                       <Label className="text-xs font-bold uppercase text-muted-foreground">App Role</Label>
                       <select
                        value={formData.app_role}
                        onChange={(e) => setFormData({ ...formData, app_role: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      >
                        <option value="employee">Standard Employee</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="hr">HR Manager</option>
                        <option value="admin">System Admin</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 8: WhatsApp Settings */}
              {formStep === 8 && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold">WhatsApp Settings</h3>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-5 bg-[#25D366]/5 rounded-xl border border-[#25D366]/20">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-bold flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-[#25D366]" /> 
                          Enable WhatsApp Alert *
                        </Label>
                        <p className="text-xs text-muted-foreground italic">Send automatic organization messages through WhatsApp notifications.</p>
                      </div>
                      <Switch 
                        checked={formData.whatsapp_alert}
                        onCheckedChange={(val) => setFormData({ ...formData, whatsapp_alert: val })}
                      />
                    </div>

                    <div className="space-y-4 px-2">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 flex-1">
                          <Switch 
                            checked={formData.whatsapp_exception}
                            onCheckedChange={(val) => setFormData({ ...formData, whatsapp_exception: val })}
                          />
                          <Label className="text-xs font-medium">Exception Alerts</Label>
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <Switch 
                            checked={formData.whatsapp_punch}
                            onCheckedChange={(val) => setFormData({ ...formData, whatsapp_punch: val })}
                          />
                          <Label className="text-xs font-medium">Punch Confirmation</Label>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Supervisor Mobile</Label>
                        <Input 
                          value={formData.supervisor_mobile} 
                          onChange={(e) => setFormData({ ...formData, supervisor_mobile: e.target.value })} 
                          placeholder="+977XXXXXXXXXX"
                          className="font-mono"
                        />
                         <p className="text-[10px] text-muted-foreground italic">Required for escalation and reporting alerts</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer: Form Step Navigation */}
          <div className="p-4 border-t bg-muted/10 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-3 pl-4">
                <div className="h-2 w-32 bg-slate-100 rounded-full overflow-hidden">
                   <div 
                      className="h-full bg-blue-600 transition-all duration-300" 
                      style={{ width: `${(formStep / 8) * 100}%` }}
                   />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                   Progress: {Math.round((formStep / 8) * 100)}%
                </span>
             </div>
             
             <div className="flex items-center gap-3 pr-4">
                <div className="text-[11px] font-bold text-muted-foreground mr-4 h-9 flex items-center px-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                   Section {formStep} of 8
                </div>
                <Button 
                  variant="outline" 
                  onClick={handlePrevStep}
                  disabled={formStep === 1}
                  className="h-9 px-5 rounded-lg border-slate-200 text-xs font-bold"
                >
                  ← Back
                </Button>
                <Button 
                  variant="default" 
                  onClick={handleNextStep}
                  disabled={formStep === 8}
                  className="h-9 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  Continue →
                </Button>
             </div>
          </div>
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
                  <p className="text-muted-foreground font-medium text-primary">Employee ID: {viewDialog.employee.employee_code || `#${viewDialog.employee.id}`}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">Attendance Device ID: {viewDialog.employee.biometric_id || 'Not Assigned'}</p>
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

      {/* Import from Device Dialog */}
      <Dialog open={importDialog.open} onOpenChange={(open) => !open && setImportDialog({ open: false })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Import Employees from Attendance Device
            </DialogTitle>
            <DialogDescription>
              Pull all employee data from the attendance device and add them to the system. 
              Employees will be added with their device user numbers and no roles assigned.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Debug Info */}
            <div className="p-2 bg-gray-100 rounded text-xs font-mono">
              <strong>Debug:</strong> Devices: {JSON.stringify(devices.slice(0, 2))} | Branches: {JSON.stringify(branches.slice(0, 2))}
            </div>

            {/* Refresh Button */}
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadData}
                className="gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Lists
              </Button>
            </div>

            {/* Device Selection */}
            <div className="space-y-2">
              <Label>Select Attendance Device *</Label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                disabled={importing}
              >
                <option value="">Choose a device...</option>
                {devices.map((device: any) => (
                  <option key={device.id} value={device.id}>
                    {device.name} ({device.brand} - {device.ip})
                  </option>
                ))}
              </select>
              {devices.length === 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    ⚠️ No devices found. Please add a device in Organization Structure → Devices tab first.
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Devices loaded: {devices.length}
                  </p>
                </div>
              )}
              {devices.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  ✅ {devices.length} device(s) available
                </p>
              )}
            </div>

            {/* Branch Selection */}
            <div className="space-y-2">
              <Label>Assign to Branch *</Label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                disabled={importing}
              >
                <option value="">Choose a branch...</option>
                {branches.map((branch: any) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              {branches.length === 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    ⚠️ No branches found. Please add a branch in Organization Structure → Branches tab first.
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Branches loaded: {branches.length}
                  </p>
                </div>
              )}
              {branches.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  ✅ {branches.length} branch(es) available
                </p>
              )}
            </div>

            {/* Import Result */}
            {importResult && (
              <div className={`p-4 rounded-md border ${
                importResult.success 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-start gap-3">
                  {importResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    {importResult.success ? (
                      <div className="space-y-2">
                        <p className="font-semibold">Import Successful!</p>
                        <div className="text-sm space-y-1">
                          <p>✅ Imported: {importResult.imported} employees</p>
                          <p>⏭️ Skipped (already exists): {importResult.skipped} employees</p>
                          {importResult.errors > 0 && (
                            <p>❌ Errors: {importResult.errors} employees</p>
                          )}
                          {importResult.error_details && importResult.error_details.length > 0 && (
                            <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs">
                              {importResult.error_details.slice(0, 3).map((err: string, idx: number) => (
                                <p key={idx}>{err}</p>
                              ))}
                              {importResult.error_details.length > 3 && (
                                <p>... and {importResult.error_details.length - 3} more errors</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="font-medium">{importResult.error || 'Failed to import employees'}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">What will be imported:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Employee name from the device</li>
                    <li>Employee code will be generated as: DEV{'{'}device_id{'}'}_{'{'}user_number{'}'}</li>
                    <li>Assigned to the selected branch</li>
                    <li>No roles or permissions will be assigned</li>
                    <li>Duplicate employees (same user number) will be skipped</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setImportDialog({ open: false })}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleExecuteImport}
              disabled={!selectedDeviceId || !selectedBranchId || importing}
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4 mr-2" />
                  Import Employees
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <OrgSetupDialog 
         open={orgSetupOpen} 
         onOpenChange={setOrgSetupOpen}
         branches={branches}
         departments={departments}
         designations={designations}
         onRefresh={loadData}
      />
    </div>
  );
};
