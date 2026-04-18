-- ============================================================================
-- BioBridge Pro ERP - Complete Database Setup
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. ORGANIZATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
);

-- ============================================================================
-- 2. BRANCHES
-- ============================================================================
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
);

-- ============================================================================
-- 3. DEPARTMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
);

-- ============================================================================
-- 4. DESIGNATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS designations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    level INTEGER DEFAULT 1,
    grade VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. USERS (with role VARCHAR - NO roles table!)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    auth_id UUID, -- Links to Supabase auth.users
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(50),
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'EMPLOYEE', -- SUPER_ADMIN, ADMIN, MANAGER, etc.
    branch_id UUID REFERENCES branches(id),
    department_id UUID REFERENCES departments(id),
    designation_id UUID REFERENCES designations(id),
    employee_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    must_change_password BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. PERMISSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    module VARCHAR(100) NOT NULL,
    permission VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(module, permission)
);

-- ============================================================================
-- 7. ROLE_PERMISSIONS (uses role VARCHAR, NOT role_id!)
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- SUPER_ADMIN, ADMIN, MANAGER, etc.
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role, permission_id)
);

-- ============================================================================
-- 8. USER_BRANCH_ACCESS
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_branch_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    UNIQUE(user_id, branch_id)
);

-- ============================================================================
-- 9. USER_DEPARTMENT_ACCESS
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_department_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    UNIQUE(user_id, department_id)
);

-- ============================================================================
-- 10. EMPLOYEES (NO role_id, NO role relationship!)
-- ============================================================================
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
);

-- ============================================================================
-- 11. ATTENDANCE_LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
);

-- ============================================================================
-- 12. ATTENDANCE_DAILY
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
);

-- ============================================================================
-- 13. LEAVE_TYPES
-- ============================================================================
CREATE TABLE IF NOT EXISTS leave_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
);

-- ============================================================================
-- 14. LEAVE_BALANCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
);

-- ============================================================================
-- 15. LEAVE_REQUESTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
);

-- ============================================================================
-- 16. SYSTEM_SETTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
);

-- ============================================================================
-- 17. AUDIT_LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_department_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES (Allow all for now - can be restricted later)
-- ============================================================================
CREATE POLICY "Enable all access" ON organizations FOR ALL USING (true);
CREATE POLICY "Enable all access" ON branches FOR ALL USING (true);
CREATE POLICY "Enable all access" ON departments FOR ALL USING (true);
CREATE POLICY "Enable all access" ON designations FOR ALL USING (true);
CREATE POLICY "Enable all access" ON users FOR ALL USING (true);
CREATE POLICY "Enable all access" ON permissions FOR ALL USING (true);
CREATE POLICY "Enable all access" ON role_permissions FOR ALL USING (true);
CREATE POLICY "Enable all access" ON user_branch_access FOR ALL USING (true);
CREATE POLICY "Enable all access" ON user_department_access FOR ALL USING (true);
CREATE POLICY "Enable all access" ON employees FOR ALL USING (true);
CREATE POLICY "Enable all access" ON attendance_logs FOR ALL USING (true);
CREATE POLICY "Enable all access" ON attendance_daily FOR ALL USING (true);
CREATE POLICY "Enable all access" ON leave_types FOR ALL USING (true);
CREATE POLICY "Enable all access" ON leave_balances FOR ALL USING (true);
CREATE POLICY "Enable all access" ON leave_requests FOR ALL USING (true);
CREATE POLICY "Enable all access" ON system_settings FOR ALL USING (true);
CREATE POLICY "Enable all access" ON audit_logs FOR ALL USING (true);

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- Create default organization
INSERT INTO organizations (name, email, country, currency, timezone)
VALUES ('BioBridge ERP', 'info@biobridge.com', 'Nepal', 'NPR', 'Asia/Kathmandu')
ON CONFLICT DO NOTHING;

-- Create default branch
INSERT INTO branches (organization_id, name, code, location)
SELECT id, 'Head Office', 'HO', 'Kathmandu'
FROM organizations LIMIT 1
ON CONFLICT DO NOTHING;

-- Create default departments
INSERT INTO departments (organization_id, name, code)
SELECT id, 'Human Resources', 'HR' FROM organizations LIMIT 1
UNION ALL
SELECT id, 'Finance & Accounting', 'FINANCE' FROM organizations LIMIT 1
UNION ALL
SELECT id, 'Information Technology', 'IT' FROM organizations LIMIT 1
UNION ALL
SELECT id, 'Operations', 'OPS' FROM organizations LIMIT 1
UNION ALL
SELECT id, 'Sales & Marketing', 'SALES' FROM organizations LIMIT 1
UNION ALL
SELECT id, 'Administration', 'ADMIN' FROM organizations LIMIT 1
ON CONFLICT DO NOTHING;

-- Create default designations
INSERT INTO designations (organization_id, name, code, level)
SELECT id, 'Chief Executive Officer', 'CEO', 10 FROM organizations LIMIT 1
UNION ALL
SELECT id, 'Manager', 'MGR', 6 FROM organizations LIMIT 1
UNION ALL
SELECT id, 'Supervisor', 'SUP', 4 FROM organizations LIMIT 1
UNION ALL
SELECT id, 'Senior Executive', 'SR_EXE', 3 FROM organizations LIMIT 1
UNION ALL
SELECT id, 'Executive', 'EXE', 2 FROM organizations LIMIT 1
UNION ALL
SELECT id, 'Intern', 'INTERN', 1 FROM organizations LIMIT 1
ON CONFLICT DO NOTHING;

-- Create permissions
INSERT INTO permissions (organization_id, module, permission, description)
SELECT id, 'hr', 'view_employees', 'View employee details' FROM organizations LIMIT 1
UNION ALL SELECT id, 'hr', 'create_employees', 'Add new employees' FROM organizations LIMIT 1
UNION ALL SELECT id, 'hr', 'edit_employees', 'Edit employee information' FROM organizations LIMIT 1
UNION ALL SELECT id, 'hr', 'delete_employees', 'Delete employees' FROM organizations LIMIT 1
UNION ALL SELECT id, 'hr', 'view_hierarchy', 'View organizational hierarchy' FROM organizations LIMIT 1
UNION ALL SELECT id, 'attendance', 'view_attendance', 'View attendance records' FROM organizations LIMIT 1
UNION ALL SELECT id, 'attendance', 'mark_attendance', 'Mark attendance' FROM organizations LIMIT 1
UNION ALL SELECT id, 'attendance', 'edit_attendance', 'Edit attendance records' FROM organizations LIMIT 1
UNION ALL SELECT id, 'attendance', 'approve_attendance', 'Approve attendance' FROM organizations LIMIT 1
UNION ALL SELECT id, 'leave', 'view_leaves', 'View leave requests' FROM organizations LIMIT 1
UNION ALL SELECT id, 'leave', 'apply_leave', 'Apply for leave' FROM organizations LIMIT 1
UNION ALL SELECT id, 'leave', 'approve_leave', 'Approve leave requests' FROM organizations LIMIT 1
UNION ALL SELECT id, 'leave', 'reject_leave', 'Reject leave requests' FROM organizations LIMIT 1
UNION ALL SELECT id, 'payroll', 'view_payroll', 'View payroll data' FROM organizations LIMIT 1
UNION ALL SELECT id, 'payroll', 'manage_payroll', 'Manage payroll' FROM organizations LIMIT 1
UNION ALL SELECT id, 'payroll', 'process_payroll', 'Process payroll runs' FROM organizations LIMIT 1
UNION ALL SELECT id, 'finance', 'view_finance', 'View financial data' FROM organizations LIMIT 1
UNION ALL SELECT id, 'finance', 'manage_finance', 'Manage finances' FROM organizations LIMIT 1
UNION ALL SELECT id, 'finance', 'approve_payments', 'Approve payments' FROM organizations LIMIT 1
UNION ALL SELECT id, 'settings', 'view_settings', 'View settings' FROM organizations LIMIT 1
UNION ALL SELECT id, 'settings', 'manage_settings', 'Manage system settings' FROM organizations LIMIT 1
UNION ALL SELECT id, 'settings', 'manage_roles', 'Manage roles and permissions' FROM organizations LIMIT 1
UNION ALL SELECT id, 'reports', 'view_reports', 'View reports' FROM organizations LIMIT 1
UNION ALL SELECT id, 'reports', 'export_reports', 'Export reports' FROM organizations LIMIT 1
UNION ALL SELECT id, 'reports', 'generate_reports', 'Generate custom reports' FROM organizations LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT '✅ Database setup complete!' as status;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
