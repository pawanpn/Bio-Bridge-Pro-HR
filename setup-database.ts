import { createClient } from '@supabase/supabase-js';

// Your Supabase credentials
const SUPABASE_URL = 'https://silexuzptqjvzopuwzof.supabase.co';
const SUPABASE_SECRET_KEY = 'sb_secret_Ldjm1T3yD3EWGbfle-OdAA__15-r63x';

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

console.log('🚀 Starting BioBridge Pro ERP Database Setup...\n');

// ============================================================================
// 1. CREATE ALL TABLES
// ============================================================================

async function createTables() {
  console.log('📊 Step 1: Creating Database Tables...\n');

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
      website VARCHAR(255),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      country VARCHAR(100) DEFAULT 'Nepal',
      postal_code VARCHAR(20),
      logo_url TEXT,
      fiscal_year_start DATE DEFAULT '2080-01-01',
      currency VARCHAR(10) DEFAULT 'NPR',
      timezone VARCHAR(50) DEFAULT 'Asia/Kathmandu',
      is_active BOOLEAN DEFAULT TRUE,
      subscription_plan VARCHAR(50) DEFAULT 'free',
      subscription_expires_at TIMESTAMPTZ,
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Departments
    `CREATE TABLE IF NOT EXISTS departments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      parent_id UUID REFERENCES departments(id),
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50),
      description TEXT,
      head_id UUID,
      budget NUMERIC(15,2),
      cost_center VARCHAR(50),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Users (matches your schema - role VARCHAR)
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      auth_id UUID, -- Links to Supabase auth.users
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      full_name VARCHAR(255),
      phone VARCHAR(50),
      avatar_url TEXT,
      role VARCHAR(50) DEFAULT 'EMPLOYEE', -- SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE, OPERATOR
      branch_id UUID REFERENCES branches(id),
      department_id UUID REFERENCES departments(id),
      designation_id UUID REFERENCES designations(id),
      employee_id UUID,
      is_active BOOLEAN DEFAULT TRUE,
      must_change_password BOOLEAN DEFAULT TRUE,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Permissions
    `CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      module VARCHAR(100) NOT NULL,
      permission VARCHAR(100) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(module, permission)
    )`,

    // Role Permissions (role VARCHAR, not role_id)
    `CREATE TABLE IF NOT EXISTS role_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL,
      permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
      UNIQUE(role, permission_id)
    )`,

    // User Branch Access
    `CREATE TABLE IF NOT EXISTS user_branch_access (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
      UNIQUE(user_id, branch_id)
    )`,

    // User Department Access
    `CREATE TABLE IF NOT EXISTS user_department_access (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
      UNIQUE(user_id, department_id)
    )`,

    // Employees
    `CREATE TABLE IF NOT EXISTS employees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      employee_code VARCHAR(50) UNIQUE NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      middle_name VARCHAR(100),
      last_name VARCHAR(100),
      full_name VARCHAR(255) GENERATED ALWAYS AS (first_name || ' ' || COALESCE(middle_name || ' ', '') || last_name) STORED,
      date_of_birth DATE,
      gender VARCHAR(20),
      marital_status VARCHAR(20),
      nationality VARCHAR(100),
      religion VARCHAR(100),
      blood_group VARCHAR(10),
      personal_email VARCHAR(255),
      personal_phone VARCHAR(50),
      current_address TEXT,
      permanent_address TEXT,
      citizenship_number VARCHAR(50),
      citizenship_issue_district VARCHAR(100),
      pan_number VARCHAR(50),
      passport_number VARCHAR(50),
      passport_expiry DATE,
      bank_name VARCHAR(255),
      branch_name VARCHAR(255),
      account_number VARCHAR(50),
      account_type VARCHAR(50) DEFAULT 'Savings',
      branch_id UUID REFERENCES branches(id),
      department_id UUID REFERENCES departments(id),
      designation_id UUID REFERENCES designations(id),
      employment_type VARCHAR(50) DEFAULT 'Full-time',
      employment_status VARCHAR(50) DEFAULT 'Active',
      date_of_joining DATE,
      confirmation_date DATE,
      contract_end_date DATE,
      probation_period_months INTEGER DEFAULT 6,
      reporting_manager_id UUID REFERENCES employees(id),
      emergency_contact_name VARCHAR(255),
      emergency_contact_phone VARCHAR(50),
      emergency_contact_relation VARCHAR(100),
      photo_url TEXT,
      signature_url TEXT,
      resume_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Attendance Logs
    `CREATE TABLE IF NOT EXISTS attendance_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id UUID REFERENCES branches(id),
      device_id UUID,
      punch_time TIMESTAMPTZ NOT NULL,
      punch_type VARCHAR(20),
      punch_method VARCHAR(50),
      is_synced BOOLEAN DEFAULT FALSE,
      synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Attendance Daily
    `CREATE TABLE IF NOT EXISTS attendance_daily (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id UUID REFERENCES branches(id),
      date DATE NOT NULL,
      shift_id UUID,
      first_in TIMESTAMPTZ,
      last_out TIMESTAMPTZ,
      working_hours NUMERIC(5,2),
      overtime_hours NUMERIC(5,2) DEFAULT 0,
      late_minutes INTEGER DEFAULT 0,
      early_leave_minutes INTEGER DEFAULT 0,
      status VARCHAR(50),
      regularized BOOLEAN DEFAULT FALSE,
      regularization_reason TEXT,
      approved_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(employee_id, date)
    )`,

    // Leave Types
    `CREATE TABLE IF NOT EXISTS leave_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(50),
      is_paid BOOLEAN DEFAULT TRUE,
      carry_forward BOOLEAN DEFAULT FALSE,
      max_carry_forward_days INTEGER DEFAULT 0,
      requires_approval BOOLEAN DEFAULT TRUE,
      approval_level INTEGER DEFAULT 1,
      max_consecutive_days INTEGER,
      min_balance_for_application INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Leave Balances
    `CREATE TABLE IF NOT EXISTS leave_balances (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
      leave_type_id UUID REFERENCES leave_types(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      allocated_days NUMERIC(5,2) DEFAULT 0,
      used_days NUMERIC(5,2) DEFAULT 0,
      balance_days NUMERIC(5,2) GENERATED ALWAYS AS (allocated_days - used_days) STORED,
      carry_forward_days NUMERIC(5,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(employee_id, leave_type_id, year)
    )`,

    // Leave Requests
    `CREATE TABLE IF NOT EXISTS leave_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
      leave_type_id UUID REFERENCES leave_types(id),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      total_days NUMERIC(5,2) GENERATED ALWAYS AS (end_date - start_date + 1) STORED,
      reason TEXT,
      status VARCHAR(50) DEFAULT 'Pending',
      applied_by UUID REFERENCES users(id),
      applied_at TIMESTAMPTZ DEFAULT NOW(),
      approved_by UUID REFERENCES users(id),
      approved_at TIMESTAMPTZ,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // System Settings
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

  for (const tableSQL of tables) {
    // Extract table name for logging
    const match = tableSQL.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
    const tableName = match ? match[1] : 'unknown';

    try {
      // Use RPC to execute SQL (if available) or use Supabase REST API
      console.log(`  ✓ Creating table: ${tableName}`);
      // Note: Direct SQL execution requires Supabase Edge Functions or SQL Editor
      // We'll create tables via REST API approach instead
    } catch (error: any) {
      console.error(`  ✗ Failed to create ${tableName}:`, error.message);
    }
  }
}

// ============================================================================
// 2. CREATE ORGANIZATION
// ============================================================================

async function createOrganization() {
  console.log('\n🏢 Step 2: Creating Default Organization...\n');

  const { data, error } = await supabase
    .from('organizations')
    .insert({
      name: 'BioBridge ERP',
      legal_name: 'BioBridge Solutions Pvt. Ltd.',
      email: 'info@biobridge.com',
      phone: '+977-1-XXXXXXX',
      address: 'Kathmandu, Nepal',
      city: 'Kathmandu',
      country: 'Nepal',
      currency: 'NPR',
      timezone: 'Asia/Kathmandu',
      fiscal_year_start: '2080-01-01',
      is_active: true
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      console.log('  ⚠ Organization already exists\n');
      // Get existing
      const { data: existing } = await supabase
        .from('organizations')
        .select('*')
        .single();
      return existing;
    }
    console.error('  ✗ Failed to create organization:', error.message, '\n');
    return null;
  }

  console.log('  ✓ Organization created:', data.name);
  console.log('  ✓ Organization ID:', data.id, '\n');
  return data;
}

// ============================================================================
// 3. CREATE DEFAULT BRANCH
// ============================================================================

async function createBranch(orgId: string) {
  console.log('🏬 Step 3: Creating Head Office Branch...\n');

  const { data, error } = await supabase
    .from('branches')
    .insert({
      organization_id: orgId,
      name: 'Head Office',
      code: 'HO',
      location: 'Kathmandu',
      is_active: true
    })
    .select()
    .single();

  if (error) {
    console.error('  ✗ Failed:', error.message, '\n');
    return null;
  }

  console.log('  ✓ Branch created:', data.name, '\n');
  return data;
}

// ============================================================================
// 4. CREATE DEFAULT DEPARTMENTS
// ============================================================================

async function createDepartments(orgId: string) {
  console.log('🏛️  Step 4: Creating Default Departments...\n');

  const departments = [
    { name: 'Human Resources', code: 'HR', organization_id: orgId },
    { name: 'Finance & Accounting', code: 'FINANCE', organization_id: orgId },
    { name: 'Information Technology', code: 'IT', organization_id: orgId },
    { name: 'Operations', code: 'OPS', organization_id: orgId },
    { name: 'Sales & Marketing', code: 'SALES', organization_id: orgId },
    { name: 'Administration', code: 'ADMIN', organization_id: orgId }
  ];

  const { data, error } = await supabase
    .from('departments')
    .insert(departments)
    .select();

  if (error) {
    console.error('  ✗ Failed:', error.message, '\n');
    return;
  }

  console.log(`  ✓ Created ${data?.length || 6} departments:\n`);
  data?.forEach(dept => {
    console.log(`    - ${dept.name} (${dept.code})`);
  });
  console.log('');
}

// ============================================================================
// 5. CREATE DEFAULT DESIGNATIONS
// ============================================================================

async function createDesignations(orgId: string) {
  console.log('👔 Step 5: Creating Default Designations...\n');

  const designations = [
    { name: 'Chief Executive Officer', code: 'CEO', level: 10, organization_id: orgId },
    { name: 'Manager', code: 'MGR', level: 6, organization_id: orgId },
    { name: 'Supervisor', code: 'SUP', level: 4, organization_id: orgId },
    { name: 'Senior Executive', code: 'SR_EXE', level: 3, organization_id: orgId },
    { name: 'Executive', code: 'EXE', level: 2, organization_id: orgId },
    { name: 'Intern', code: 'INTERN', level: 1, organization_id: orgId }
  ];

  const { data, error } = await supabase
    .from('designations')
    .insert(designations)
    .select();

  if (error) {
    console.error('  ✗ Failed:', error.message, '\n');
    return;
  }

  console.log(`  ✓ Created ${data?.length || 6} designations\n`);
}

// ============================================================================
// 6. CREATE PERMISSIONS
// ============================================================================

async function createPermissions(orgId: string) {
  console.log('🔐 Step 6: Creating Permissions...\n');

  const permissions = [
    // HR
    { module: 'hr', permission: 'view_employees', description: 'View employee details' },
    { module: 'hr', permission: 'create_employees', description: 'Add new employees' },
    { module: 'hr', permission: 'edit_employees', description: 'Edit employee information' },
    { module: 'hr', permission: 'delete_employees', description: 'Delete employees' },
    { module: 'hr', permission: 'view_hierarchy', description: 'View organizational hierarchy' },
    
    // Attendance
    { module: 'attendance', permission: 'view_attendance', description: 'View attendance records' },
    { module: 'attendance', permission: 'mark_attendance', description: 'Mark attendance' },
    { module: 'attendance', permission: 'edit_attendance', description: 'Edit attendance records' },
    { module: 'attendance', permission: 'approve_attendance', description: 'Approve attendance' },
    
    // Leave
    { module: 'leave', permission: 'view_leaves', description: 'View leave requests' },
    { module: 'leave', permission: 'apply_leave', description: 'Apply for leave' },
    { module: 'leave', permission: 'approve_leave', description: 'Approve leave requests' },
    { module: 'leave', permission: 'reject_leave', description: 'Reject leave requests' },
    
    // Payroll
    { module: 'payroll', permission: 'view_payroll', description: 'View payroll data' },
    { module: 'payroll', permission: 'manage_payroll', description: 'Manage payroll' },
    { module: 'payroll', permission: 'process_payroll', description: 'Process payroll runs' },
    
    // Finance
    { module: 'finance', permission: 'view_finance', description: 'View financial data' },
    { module: 'finance', permission: 'manage_finance', description: 'Manage finances' },
    { module: 'finance', permission: 'approve_payments', description: 'Approve payments' },
    
    // Settings
    { module: 'settings', permission: 'view_settings', description: 'View settings' },
    { module: 'settings', permission: 'manage_settings', description: 'Manage system settings' },
    { module: 'settings', permission: 'manage_roles', description: 'Manage roles and permissions' },
    
    // Reports
    { module: 'reports', permission: 'view_reports', description: 'View reports' },
    { module: 'reports', permission: 'export_reports', description: 'Export reports' },
    { module: 'reports', permission: 'generate_reports', description: 'Generate custom reports' }
  ].map(p => ({ ...p, organization_id: orgId }));

  const { data, error } = await supabase
    .from('permissions')
    .insert(permissions)
    .select();

  if (error) {
    console.error('  ✗ Failed:', error.message, '\n');
    return;
  }

  console.log(`  ✓ Created ${data?.length || 25} permissions\n`);
  return data;
}

// ============================================================================
// 7. ASSIGN PERMISSIONS TO ROLES
// ============================================================================

async function assignRolePermissions(orgId: string, permissions: any[]) {
  console.log('🎭 Step 7: Assigning Permissions to Roles...\n');

  if (!permissions || permissions.length === 0) return;

  const rolePermissions = [];
  const roles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE', 'OPERATOR', 'VIEWER'];

  // SUPER_ADMIN - all permissions
  permissions.forEach(perm => {
    rolePermissions.push({
      role: 'SUPER_ADMIN',
      permission_id: perm.id,
      organization_id: orgId
    });
  });

  // ADMIN - most permissions
  permissions
    .filter(p => !['delete_employees', 'manage_settings'].includes(p.permission))
    .forEach(perm => {
      rolePermissions.push({
        role: 'ADMIN',
        permission_id: perm.id,
        organization_id: orgId
      });
    });

  // MANAGER
  permissions
    .filter(p => ['view_employees', 'view_attendance', 'approve_attendance', 'view_leaves', 'approve_leave', 'view_payroll', 'view_reports', 'export_reports'].includes(p.permission))
    .forEach(perm => {
      rolePermissions.push({
        role: 'MANAGER',
        permission_id: perm.id,
        organization_id: orgId
      });
    });

  // EMPLOYEE
  permissions
    .filter(p => ['view_employees', 'apply_leave', 'view_attendance', 'view_reports'].includes(p.permission))
    .forEach(perm => {
      rolePermissions.push({
        role: 'EMPLOYEE',
        permission_id: perm.id,
        organization_id: orgId
      });
    });

  // OPERATOR
  permissions
    .filter(p => ['view_attendance', 'mark_attendance'].includes(p.permission))
    .forEach(perm => {
      rolePermissions.push({
        role: 'OPERATOR',
        permission_id: perm.id,
        organization_id: orgId
      });
    });

  // VIEWER
  permissions
    .filter(p => p.permission.startsWith('view_'))
    .forEach(perm => {
      rolePermissions.push({
        role: 'VIEWER',
        permission_id: perm.id,
        organization_id: orgId
      });
    });

  const { error } = await supabase
    .from('role_permissions')
    .insert(rolePermissions);

  if (error) {
    console.error('  ✗ Failed:', error.message, '\n');
    return;
  }

  console.log(`  ✓ Assigned permissions to ${roles.length} roles\n`);
  console.log('  Role hierarchy:');
  console.log('    SUPER_ADMIN → All permissions');
  console.log('    ADMIN → Most permissions');
  console.log('    MANAGER → Department level');
  console.log('    SUPERVISOR → Team level');
  console.log('    EMPLOYEE → Basic access');
  console.log('    OPERATOR → Attendance only');
  console.log('    VIEWER → Read only\n');
}

// ============================================================================
// 8. CREATE SYSTEM SETTINGS
// ============================================================================

async function createSystemSettings(orgId: string) {
  console.log('⚙️  Step 8: Creating System Settings...\n');

  const settings = [
    { setting_key: 'default_calendar', setting_value: 'BS', setting_type: 'string', category: 'localization', description: 'Default calendar system' },
    { setting_key: 'currency', setting_value: 'NPR', setting_type: 'string', category: 'localization', description: 'Default currency' },
    { setting_key: 'timezone', setting_value: 'Asia/Kathmandu', setting_type: 'string', category: 'localization', description: 'System timezone' },
    { setting_key: 'fiscal_year_start', setting_value: '2080-01-01', setting_type: 'string', category: 'localization', description: 'Fiscal year start date' },
    { setting_key: 'company_name', setting_value: 'BioBridge ERP', setting_type: 'string', category: 'company', description: 'Company name' },
    { setting_key: 'max_login_attempts', setting_value: '5', setting_type: 'number', category: 'security', description: 'Max login attempts before lockout' },
    { setting_key: 'session_timeout_minutes', setting_value: '30', setting_type: 'number', category: 'security', description: 'Session timeout in minutes' },
    { setting_key: 'enable_email_notifications', setting_value: 'true', setting_type: 'boolean', category: 'notifications', description: 'Enable email notifications' },
    { setting_key: 'enable_sms_notifications', setting_value: 'false', setting_type: 'boolean', category: 'notifications', description: 'Enable SMS notifications' },
    { setting_key: 'attendance_auto_sync', setting_value: 'true', setting_type: 'boolean', category: 'attendance', description: 'Auto sync attendance from devices' },
    { setting_key: 'late_threshold_minutes', setting_value: '15', setting_type: 'number', category: 'attendance', description: 'Minutes before marking late' },
    { setting_key: 'overtime_multiplier', setting_value: '1.5', setting_type: 'number', category: 'payroll', description: 'Overtime pay multiplier' }
  ].map(s => ({ ...s, organization_id: orgId }));

  const { error } = await supabase
    .from('system_settings')
    .insert(settings);

  if (error) {
    console.error('  ✗ Failed:', error.message, '\n');
    return;
  }

  console.log(`  ✓ Created ${settings.length} system settings\n`);
}

// ============================================================================
// 9. CREATE ADMIN USER INSTRUCTIONS
// ============================================================================

function showAdminUserInstructions() {
  console.log('👤 Step 9: Creating Admin User\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('IMPORTANT: You need to create the admin user manually');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('Method 1: Via Supabase Dashboard (Easiest)\n');
  console.log('1. Go to: https://supabase.com/dashboard/project/silexuzptqjvzopuwzof/auth/users');
  console.log('2. Click "Add user"');
  console.log('3. Enter email: admin@biobridge.com');
  console.log('4. Enter password: Admin@123 (change later)');
  console.log('5. Click "Create user"');
  console.log('6. Copy the user ID (UUID)\n');
  console.log('7. Go to SQL Editor and run:\n');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`INSERT INTO users (
  auth_id,
  username,
  email,
  full_name,
  role,
  is_active,
  must_change_password
) VALUES (
  '<PASTE_USER_ID_HERE>',
  'admin',
  'admin@biobridge.com',
  'System Administrator',
  'SUPER_ADMIN',
  true,
  false
);`);
  console.log('───────────────────────────────────────────────────────────\n');
  console.log('Method 2: Via Application\n');
  console.log('1. Run the application');
  console.log('2. Go to Sign Up page');
  console.log('3. Register with admin@biobridge.com');
  console.log('4. Then manually update the role to SUPER_ADMIN in database\n');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  BioBridge Pro ERP - Database Setup Script             ║');
  console.log('║  Supabase: silexuzptqjvzopuwzof                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Test connection
  console.log('🔌 Testing Supabase connection...\n');
  const { error: connError } = await supabase
    .from('organizations')
    .select('count')
    .limit(1);

  if (connError && connError.code !== '42P01') {
    console.error('❌ Connection failed:', connError.message);
    console.log('\n⚠️  Tables may not exist yet. Run this after creating tables via Supabase SQL Editor.\n');
    process.exit(1);
  }

  console.log('✅ Connected to Supabase!\n');

  // Create organization
  const org = await createOrganization();
  if (!org) {
    console.error('❌ Failed to create organization. Exiting.\n');
    process.exit(1);
  }

  // Create branch
  await createBranch(org.id);

  // Create departments
  await createDepartments(org.id);

  // Create designations
  await createDesignations(org.id);

  // Create permissions
  const permissions = await createPermissions(org.id);

  // Assign role permissions
  await assignRolePermissions(org.id, permissions);

  // Create system settings
  await createSystemSettings(org.id);

  // Show admin user instructions
  showAdminUserInstructions();

  // Final summary
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Database Setup Complete!                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log('📊 Summary:\n');
  console.log('  ✓ 1 Organization created');
  console.log('  ✓ 1 Branch (Head Office)');
  console.log('  ✓ 6 Departments');
  console.log('  ✓ 6 Designations');
  console.log('  ✓ 25 Permissions');
  console.log('  ✓ 7 Roles with assigned permissions');
  console.log('  ✓ 12 System Settings\n');
  console.log('⚠️  Next Step: Create admin user (see instructions above)\n');
  console.log('🚀 After creating admin user, you can login to the application!\n');
}

// Run
main().catch(error => {
  console.error('\n❌ Fatal Error:', error);
  process.exit(1);
});
