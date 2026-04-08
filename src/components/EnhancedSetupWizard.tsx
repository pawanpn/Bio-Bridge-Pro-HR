import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  CheckCircle2, 
  Building2, 
  Globe, 
  ArrowRight, 
  ArrowLeft, 
  FileText, 
  Database,
  Settings,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface SetupData {
  // Step 1: Company Info
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogo: string;
  
  // Step 2: Supabase Configuration
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  
  // Step 3: Admin Setup
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName: string;
  
  // Step 4: Localization
  defaultCalendar: 'BS' | 'AD';
  currency: string;
  timezone: string;
  fiscalYearStart: string;
  
  // Step 5: Organization Structure
  branchName: string;
  branchLocation: string;
  departments: string[];
}

export const EnhancedSetupWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  
  const [setupData, setSetupData] = useState<SetupData>({
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    companyLogo: '',
    supabaseUrl: '',
    supabaseAnonKey: '',
    supabaseServiceKey: '',
    adminUsername: 'admin',
    adminEmail: '',
    adminPassword: '',
    adminFullName: '',
    defaultCalendar: 'BS',
    currency: 'NPR',
    timezone: 'Asia/Kathmandu',
    fiscalYearStart: '2080-01-01',
    branchName: 'Head Office',
    branchLocation: '',
    departments: ['HR', 'Finance', 'IT', 'Operations', 'Sales', 'Marketing']
  });

  const updateSetupData = (field: keyof SetupData, value: any) => {
    setSetupData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(s => Math.min(s + 1, 5));
      setError('');
    }
  };

  const prevStep = () => {
    setStep(s => Math.max(s - 1, 1));
    setError('');
  };

  const validateStep = (currentStep: number): boolean => {
    switch(currentStep) {
      case 1:
        if (!setupData.companyName.trim()) {
          setError('Company name is required');
          return false;
        }
        return true;
      case 2:
        if (!setupData.supabaseUrl.trim() || !setupData.supabaseAnonKey.trim()) {
          setError('Supabase URL and Anon Key are required');
          return false;
        }
        return true;
      case 3:
        if (!setupData.adminEmail.trim() || !setupData.adminPassword.trim()) {
          setError('Admin email and password are required');
          return false;
        }
        if (setupData.adminPassword.length < 6) {
          setError('Password must be at least 6 characters');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const testSupabaseConnection = async () => {
    setLoading(true);
    setConnectionStatus('testing');
    setError('');

    try {
      const client = createClient(setupData.supabaseUrl, setupData.supabaseAnonKey);
      const { error } = await client.from('_test_connection').select('*').limit(1);
      
      if (error && error.code !== '42P01') { // 42P01 = undefined table (expected)
        throw new Error(error.message);
      }

      setSupabaseClient(client);
      setConnectionStatus('connected');
      setError('');
    } catch (err: any) {
      setConnectionStatus('failed');
      setError(err.message || 'Failed to connect to Supabase');
    } finally {
      setLoading(false);
    }
  };

  const createDatabaseTables = async (client: SupabaseClient) => {
    // This will be executed via Supabase Edge Functions or SQL execution
    const tables = [
      // Organizations
      `CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        legal_name VARCHAR(255),
        registration_number VARCHAR(100),
        tax_number VARCHAR(100),
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        country VARCHAR(100) DEFAULT 'Nepal',
        logo_url TEXT,
        currency VARCHAR(10) DEFAULT 'NPR',
        timezone VARCHAR(50) DEFAULT 'Asia/Kathmandu',
        fiscal_year_start DATE DEFAULT '2080-01-01',
        calendar_system VARCHAR(10) DEFAULT 'BS',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Branches
      `CREATE TABLE IF NOT EXISTS branches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        location VARCHAR(255),
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Departments (with hierarchy support)
      `CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        parent_id UUID REFERENCES departments(id),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        description TEXT,
        head_id UUID,
        budget NUMERIC(15,2),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Designations
      `CREATE TABLE IF NOT EXISTS designations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        level INTEGER DEFAULT 1,
        grade VARCHAR(50),
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Roles (enhanced with hierarchy)
      `CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        level INTEGER DEFAULT 1,
        parent_role_id UUID REFERENCES roles(id),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Permissions (granular)
      `CREATE TABLE IF NOT EXISTS permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        module VARCHAR(100) NOT NULL,
        permission VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(module, permission)
      )`,

      // Role-Permissions mapping
      `CREATE TABLE IF NOT EXISTS role_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
        UNIQUE(role_id, permission_id)
      )`,

      // Users (enhanced)
      `CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        full_name VARCHAR(255),
        phone VARCHAR(50),
        avatar_url TEXT,
        role_id UUID REFERENCES roles(id),
        branch_id UUID REFERENCES branches(id),
        department_id UUID REFERENCES departments(id),
        designation_id UUID REFERENCES designations(id),
        employee_id UUID,
        is_active BOOLEAN DEFAULT TRUE,
        must_change_password BOOLEAN DEFAULT TRUE,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Employee Hierarchy (reporting structure)
      `CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        employee_code VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        middle_name VARCHAR(100),
        last_name VARCHAR(100),
        full_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        branch_id UUID REFERENCES branches(id),
        department_id UUID REFERENCES departments(id),
        designation_id UUID REFERENCES designations(id),
        role_id UUID REFERENCES roles(id),
        reporting_manager_id UUID REFERENCES employees(id),
        date_of_joining DATE,
        employment_status VARCHAR(50) DEFAULT 'Active',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // User Branch Access (multi-branch permissions)
      `CREATE TABLE IF NOT EXISTS user_branch_access (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
        UNIQUE(user_id, branch_id)
      )`,

      // User Department Access (department-wise permissions)
      `CREATE TABLE IF NOT EXISTS user_department_access (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
        UNIQUE(user_id, department_id)
      )`,

      // System Settings (dynamic configuration)
      `CREATE TABLE IF NOT EXISTS system_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        setting_key VARCHAR(100) NOT NULL,
        setting_value TEXT,
        setting_type VARCHAR(50) DEFAULT 'string',
        category VARCHAR(100),
        description TEXT,
        is_public BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(organization_id, setting_key)
      )`,

      // Audit Logs
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id UUID,
        old_value JSONB,
        new_value JSONB,
        ip_address INET,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    ];

    // Execute table creation
    for (const tableSQL of tables) {
      const { error } = await client.rpc('exec_sql', { sql_query: tableSQL });
      if (error) {
        console.error('Failed to create table:', error);
        // Continue anyway as some tables might already exist
      }
    }
  };

  const insertDefaultData = async (client: SupabaseClient, orgId: string) => {
    // Insert default roles
    const roles = [
      { name: 'Super Admin', code: 'SUPER_ADMIN', level: 10, description: 'Full system access' },
      { name: 'Admin', code: 'ADMIN', level: 8, description: 'Administrative access' },
      { name: 'Manager', code: 'MANAGER', level: 6, description: 'Department manager' },
      { name: 'Supervisor', code: 'SUPERVISOR', level: 4, description: 'Team supervisor' },
      { name: 'Employee', code: 'EMPLOYEE', level: 2, description: 'Regular employee' },
      { name: 'Viewer', code: 'VIEWER', level: 1, description: 'Read-only access' }
    ];

    const { data: insertedRoles, error: rolesError } = await client
      .from('roles')
      .insert(roles.map(r => ({ ...r, organization_id: orgId })))
      .select();

    if (rolesError) console.error('Error inserting roles:', rolesError);

    // Insert default permissions
    const permissions = [
      // HR Module
      { module: 'hr', permission: 'view_employees', description: 'View employee details' },
      { module: 'hr', permission: 'create_employees', description: 'Add new employees' },
      { module: 'hr', permission: 'edit_employees', description: 'Edit employee information' },
      { module: 'hr', permission: 'delete_employees', description: 'Delete employees' },
      { module: 'hr', permission: 'view_hierarchy', description: 'View organizational hierarchy' },
      
      // Attendance Module
      { module: 'attendance', permission: 'view_attendance', description: 'View attendance records' },
      { module: 'attendance', permission: 'mark_attendance', description: 'Mark attendance' },
      { module: 'attendance', permission: 'edit_attendance', description: 'Edit attendance records' },
      { module: 'attendance', permission: 'approve_attendance', description: 'Approve attendance' },
      
      // Leave Module
      { module: 'leave', permission: 'view_leaves', description: 'View leave requests' },
      { module: 'leave', permission: 'apply_leave', description: 'Apply for leave' },
      { module: 'leave', permission: 'approve_leave', description: 'Approve leave requests' },
      { module: 'leave', permission: 'reject_leave', description: 'Reject leave requests' },
      
      // Payroll Module
      { module: 'payroll', permission: 'view_payroll', description: 'View payroll data' },
      { module: 'payroll', permission: 'manage_payroll', description: 'Manage payroll' },
      { module: 'payroll', permission: 'process_payroll', description: 'Process payroll runs' },
      
      // Finance Module
      { module: 'finance', permission: 'view_finance', description: 'View financial data' },
      { module: 'finance', permission: 'manage_finance', description: 'Manage finances' },
      { module: 'finance', permission: 'approve_payments', description: 'Approve payments' },
      
      // Settings Module
      { module: 'settings', permission: 'view_settings', description: 'View settings' },
      { module: 'settings', permission: 'manage_settings', description: 'Manage system settings' },
      { module: 'settings', permission: 'manage_roles', description: 'Manage roles and permissions' },
      
      // Reports Module
      { module: 'reports', permission: 'view_reports', description: 'View reports' },
      { module: 'reports', permission: 'export_reports', description: 'Export reports' },
      { module: 'reports', permission: 'generate_reports', description: 'Generate custom reports' }
    ];

    const { data: insertedPermissions, error: permError } = await client
      .from('permissions')
      .insert(permissions)
      .select();

    if (permError) console.error('Error inserting permissions:', permError);

    // Assign permissions to roles
    if (insertedRoles && insertedPermissions) {
      const rolePermissions: { role_id: string; permission_id: string }[] = [];
      const superAdminRole = insertedRoles.find((r: any) => r.code === 'SUPER_ADMIN');
      const adminRole = insertedRoles.find((r: any) => r.code === 'ADMIN');
      const managerRole = insertedRoles.find((r: any) => r.code === 'MANAGER');
      const employeeRole = insertedRoles.find((r: any) => r.code === 'EMPLOYEE');
      const viewerRole = insertedRoles.find((r: any) => r.code === 'VIEWER');

      // Super Admin - all permissions
      insertedPermissions.forEach((perm: any) => {
        rolePermissions.push({ role_id: superAdminRole.id, permission_id: perm.id });
      });

      // Admin - most permissions
      insertedPermissions
        .filter((p: any) => !['delete_employees', 'manage_settings'].includes(p.permission))
        .forEach((perm: any) => {
          rolePermissions.push({ role_id: adminRole.id, permission_id: perm.id });
        });

      // Manager - department level
      insertedPermissions
        .filter((p: any) => ['view_employees', 'view_attendance', 'approve_attendance', 'view_leaves', 'approve_leave', 'view_payroll', 'view_reports', 'export_reports'].includes(p.permission))
        .forEach((perm: any) => {
          rolePermissions.push({ role_id: managerRole.id, permission_id: perm.id });
        });

      // Employee - basic
      insertedPermissions
        .filter((p: any) => ['view_employees', 'apply_leave', 'view_attendance', 'view_reports'].includes(p.permission))
        .forEach((perm: any) => {
          rolePermissions.push({ role_id: employeeRole.id, permission_id: perm.id });
        });

      // Viewer - read only
      insertedPermissions
        .filter((p: any) => p.permission.startsWith('view_'))
        .forEach((perm: any) => {
          rolePermissions.push({ role_id: viewerRole.id, permission_id: perm.id });
        });

      if (rolePermissions.length > 0) {
        const { error: rpError } = await client
          .from('role_permissions')
          .insert(rolePermissions);
        
        if (rpError) console.error('Error inserting role permissions:', rpError);
      }
    }

    // Insert default departments
    const departments = setupData.departments.map(dept => ({
      name: dept,
      code: dept.toUpperCase().substring(0, 10),
      organization_id: orgId
    }));

    const { error: deptError } = await client
      .from('departments')
      .insert(departments);

    if (deptError) console.error('Error inserting departments:', deptError);

    // Insert default branch
    const { data: branchData, error: branchError } = await client
      .from('branches')
      .insert({
        name: setupData.branchName,
        location: setupData.branchLocation,
        organization_id: orgId
      })
      .select()
      .single();

    if (branchError) console.error('Error inserting branch:', branchError);

    // Insert system settings
    const settings = [
      { setting_key: 'default_calendar', setting_value: setupData.defaultCalendar, category: 'localization' },
      { setting_key: 'currency', setting_value: setupData.currency, category: 'localization' },
      { setting_key: 'timezone', setting_value: setupData.timezone, category: 'localization' },
      { setting_key: 'fiscal_year_start', setting_value: setupData.fiscalYearStart, category: 'localization' },
      { setting_key: 'company_name', setting_value: setupData.companyName, category: 'company' },
      { setting_key: 'company_email', setting_value: setupData.companyEmail, category: 'company' },
      { setting_key: 'company_phone', setting_value: setupData.companyPhone, category: 'company' },
      { setting_key: 'max_login_attempts', setting_value: '5', category: 'security' },
      { setting_key: 'session_timeout_minutes', setting_value: '30', category: 'security' },
      { setting_key: 'enable_email_notifications', setting_value: 'true', category: 'notifications' },
      { setting_key: 'enable_sms_notifications', setting_value: 'false', category: 'notifications' },
      { setting_key: 'attendance_auto_sync', setting_value: 'true', category: 'attendance' },
      { setting_key: 'late_threshold_minutes', setting_value: '15', category: 'attendance' },
      { setting_key: 'overtime_multiplier', setting_value: '1.5', category: 'payroll' }
    ];

    const { error: settingsError } = await client
      .from('system_settings')
      .insert(settings.map(s => ({ ...s, organization_id: orgId })));

    if (settingsError) console.error('Error inserting settings:', settingsError);

    return branchData;
  };

  const handleCompleteSetup = async () => {
    setLoading(true);
    setError('');

    try {
      // Test connection first
      if (connectionStatus !== 'connected') {
        await testSupabaseConnection();
        if (connectionStatus === 'failed' || connectionStatus === 'idle') {
          throw new Error('Supabase connection test failed');
        }
      }

      if (!supabaseClient) {
        throw new Error('Supabase client not initialized');
      }

      // Step 1: Create organization
      const { data: orgData, error: orgError } = await supabaseClient
        .from('organizations')
        .insert({
          name: setupData.companyName,
          address: setupData.companyAddress,
          phone: setupData.companyPhone,
          email: setupData.companyEmail,
          currency: setupData.currency,
          timezone: setupData.timezone,
          fiscal_year_start: setupData.fiscalYearStart,
          calendar_system: setupData.defaultCalendar
        })
        .select()
        .single();

      if (orgError) {
        // If organizations table doesn't exist, create it first
        if (orgError.code === '42P01') {
          await createDatabaseTables(supabaseClient);
          
          // Try again
          const { data: orgData2, error: orgError2 } = await supabaseClient
            .from('organizations')
            .insert({
              name: setupData.companyName,
              address: setupData.companyAddress,
              phone: setupData.companyPhone,
              email: setupData.companyEmail,
              currency: setupData.currency,
              timezone: setupData.timezone,
              fiscal_year_start: setupData.fiscalYearStart,
              calendar_system: setupData.defaultCalendar
            })
            .select()
            .single();

          if (orgError2) throw new Error(orgError2.message);
          
          await insertDefaultData(supabaseClient, orgData2.id);
          
          // Create admin user
          const { error: userError } = await supabaseClient
            .from('users')
            .insert({
              username: setupData.adminUsername,
              email: setupData.adminEmail,
              full_name: setupData.adminFullName,
              organization_id: orgData2.id,
              role_id: null, // Will be assigned based on role lookup
              must_change_password: true
            });

          if (userError) console.error('Error creating admin user:', userError);
        } else {
          throw new Error(orgError.message);
        }
      } else {
        await insertDefaultData(supabaseClient, orgData.id);
      }

      // Save configuration to localStorage
      localStorage.setItem('setupComplete', 'true');
      localStorage.setItem('supabaseUrl', setupData.supabaseUrl);
      localStorage.setItem('supabaseAnonKey', setupData.supabaseAnonKey);
      localStorage.setItem('companyName', setupData.companyName);
      localStorage.setItem('calendarMode', setupData.defaultCalendar);

      alert('Setup completed successfully! You can now login with your admin credentials.');
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Setup failed. Please try again.');
      console.error('Setup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { icon: Building2, title: 'Company Info' },
    { icon: Database, title: 'Database' },
    { icon: Shield, title: 'Admin User' },
    { icon: Globe, title: 'Localization' },
    { icon: Settings, title: 'Complete' }
  ];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-3xl shadow-2xl border-0 my-8">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">BioBridge Pro HR - Setup Wizard</CardTitle>
              <CardDescription>Configure your system for first-time use</CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              Step {step} of 5
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300 ease-in-out"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-between gap-2 pt-2">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isActive = idx + 1 === step;
              const isCompleted = idx + 1 < step;
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon size={18} />
                </div>
              );
            })}
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm text-red-800 font-medium">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Step 1: Company Information */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Company Information</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your company details to personalize the system.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={setupData.companyName}
                    onChange={(e) => updateSetupData('companyName', e.target.value)}
                    placeholder="Your Company Pvt. Ltd."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyAddress">Address</Label>
                  <Input
                    id="companyAddress"
                    value={setupData.companyAddress}
                    onChange={(e) => updateSetupData('companyAddress', e.target.value)}
                    placeholder="Kathmandu, Nepal"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone">Phone</Label>
                    <Input
                      id="companyPhone"
                      value={setupData.companyPhone}
                      onChange={(e) => updateSetupData('companyPhone', e.target.value)}
                      placeholder="+977-1-XXXXXXX"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyEmail">Email</Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      value={setupData.companyEmail}
                      onChange={(e) => updateSetupData('companyEmail', e.target.value)}
                      placeholder="info@company.com"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={nextStep}>
                  Next
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Database Configuration */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Database Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Connect to your Supabase database. The system will automatically create all required tables.
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <FileText className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900">How to get Supabase credentials:</p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-800 mt-2">
                      <li>Go to <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline">supabase.com</a> and create a new project</li>
                      <li>Navigate to Project Settings &gt; API</li>
                      <li>Copy the Project URL and anon/public key</li>
                      <li>For service role key, go to Project Settings &gt; Service Role</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="supabaseUrl">Supabase Project URL *</Label>
                  <Input
                    id="supabaseUrl"
                    value={setupData.supabaseUrl}
                    onChange={(e) => updateSetupData('supabaseUrl', e.target.value)}
                    placeholder="https://xxxxx.supabase.co"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supabaseAnonKey">Supabase Anon/Public Key *</Label>
                  <Input
                    id="supabaseAnonKey"
                    value={setupData.supabaseAnonKey}
                    onChange={(e) => updateSetupData('supabaseAnonKey', e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supabaseServiceKey">
                    Supabase Service Role Key (Optional - for advanced features)
                  </Label>
                  <Input
                    id="supabaseServiceKey"
                    value={setupData.supabaseServiceKey}
                    onChange={(e) => updateSetupData('supabaseServiceKey', e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button 
                    onClick={testSupabaseConnection} 
                    variant="outline"
                    disabled={loading || !setupData.supabaseUrl || !setupData.supabaseAnonKey}
                  >
                    {loading && connectionStatus === 'testing' ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Database size={16} />
                        Test Connection
                      </>
                    )}
                  </Button>

                  {connectionStatus === 'connected' && (
                    <Badge className="bg-green-500">
                      <CheckCircle2 size={14} className="mr-1" />
                      Connected
                    </Badge>
                  )}

                  {connectionStatus === 'failed' && (
                    <Badge variant="destructive">
                      <AlertCircle size={14} className="mr-1" />
                      Failed
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button onClick={nextStep} disabled={connectionStatus !== 'connected'}>
                  Next
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Admin User Setup */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Admin User Setup</h3>
                <p className="text-sm text-muted-foreground">
                  Create the initial administrator account with full system access.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="adminFullName">Full Name *</Label>
                  <Input
                    id="adminFullName"
                    value={setupData.adminFullName}
                    onChange={(e) => updateSetupData('adminFullName', e.target.value)}
                    placeholder="Admin User"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Email *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={setupData.adminEmail}
                    onChange={(e) => updateSetupData('adminEmail', e.target.value)}
                    placeholder="admin@company.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminUsername">Username *</Label>
                    <Input
                      id="adminUsername"
                      value={setupData.adminUsername}
                      onChange={(e) => updateSetupData('adminUsername', e.target.value)}
                      placeholder="admin"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Password *</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      value={setupData.adminPassword}
                      onChange={(e) => updateSetupData('adminPassword', e.target.value)}
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button onClick={nextStep}>
                  Next
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Localization Settings */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Localization Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Configure regional settings, calendar system, and currency.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calendar">Calendar System</Label>
                    <select
                      id="calendar"
                      className="w-full px-3 py-2 border rounded-md"
                      value={setupData.defaultCalendar}
                      onChange={(e) => updateSetupData('defaultCalendar', e.target.value)}
                    >
                      <option value="BS">Bikram Sambat (BS)</option>
                      <option value="AD">Gregorian (AD)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <select
                      id="currency"
                      className="w-full px-3 py-2 border rounded-md"
                      value={setupData.currency}
                      onChange={(e) => updateSetupData('currency', e.target.value)}
                    >
                      <option value="NPR">NPR - Nepalese Rupee</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="INR">INR - Indian Rupee</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={setupData.timezone}
                    onChange={(e) => updateSetupData('timezone', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fiscalYear">Fiscal Year Start</Label>
                  <Input
                    id="fiscalYear"
                    value={setupData.fiscalYearStart}
                    onChange={(e) => updateSetupData('fiscalYearStart', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button onClick={nextStep}>
                  Next
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Review & Complete */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Review & Complete Setup</h3>
                <p className="text-sm text-muted-foreground">
                  Review your configuration and complete the setup. All tables and default data will be created automatically.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Company</h4>
                  <p className="text-sm">{setupData.companyName}</p>
                  {setupData.companyAddress && <p className="text-sm text-muted-foreground">{setupData.companyAddress}</p>}
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Database</h4>
                  <p className="text-sm font-mono">{setupData.supabaseUrl}</p>
                  <Badge className="mt-2 bg-green-500">
                    <CheckCircle2 size={12} className="mr-1" />
                    Connected
                  </Badge>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Admin User</h4>
                  <p className="text-sm">{setupData.adminFullName}</p>
                  <p className="text-sm text-muted-foreground">{setupData.adminEmail}</p>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Localization</h4>
                  <p className="text-sm">Calendar: {setupData.defaultCalendar} | Currency: {setupData.currency}</p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold mb-2 text-blue-900">What will be created:</h4>
                  <ul className="text-sm space-y-1 text-blue-800">
                    <li>✓ {setupData.departments.length} default departments ({setupData.departments.join(', ')})</li>
                    <li>✓ 6 role levels (Super Admin, Admin, Manager, Supervisor, Employee, Viewer)</li>
                    <li>✓ 25+ granular permissions</li>
                    <li>✓ Default system settings</li>
                    <li>✓ Branch: {setupData.branchName}</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button onClick={handleCompleteSetup} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Complete Setup
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        <Separator />

        <CardFooter className="flex justify-between py-4">
          <div className="text-xs text-muted-foreground">
            {step === 5 ? 'Final step' : `${5 - step} steps remaining`}
          </div>
          <button
            onClick={() => {
              localStorage.setItem('setupComplete', 'true');
              window.location.reload();
            }}
            className="text-xs text-muted-foreground hover:text-primary underline"
          >
            Skip Setup
          </button>
        </CardFooter>
      </Card>
    </div>
  );
};
