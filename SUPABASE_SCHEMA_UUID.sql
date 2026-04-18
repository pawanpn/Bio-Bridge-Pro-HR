-- ============================================================================
-- BioBridge Pro ERP - Supabase Cloud Schema (UUID-based)
-- ============================================================================
-- This script creates all ERP tables with UUID primary keys for Supabase
-- Run this in your Supabase SQL Editor to set up the complete schema
-- ============================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table (authentication & authorization)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL CHECK(role IN ('SUPER_ADMIN', 'ADMIN', 'OPERATOR')),
    branch_id UUID,
    is_active BOOLEAN DEFAULT true,
    must_change_password BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Branches table
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    contact_info TEXT,
    auth_key TEXT UNIQUE,
    license_expiry TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees table
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    full_name TEXT GENERATED ALWAYS AS (
        TRIM(first_name || ' ' || COALESCE(middle_name, '') || ' ' || last_name)
    ) STORED,
    date_of_birth DATE,
    gender VARCHAR(10),
    personal_email TEXT,
    personal_phone TEXT,
    current_address TEXT,
    permanent_address TEXT,
    department_id UUID,
    designation_id UUID,
    branch_id UUID REFERENCES public.branches(id),
    date_of_joining DATE,
    employment_type VARCHAR(50) DEFAULT 'Full-time',
    employment_status VARCHAR(50) DEFAULT 'Active',
    reporting_manager_id UUID,
    bank_name TEXT,
    account_number TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ERP MODULE TABLES
-- ============================================================================

-- Inventory Items table
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code VARCHAR(50) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'General',
    quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(10, 2) DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    supplier TEXT,
    location TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_code VARCHAR(50) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Planning',
    priority TEXT DEFAULT 'Medium',
    start_date DATE,
    end_date DATE,
    budget DECIMAL(12, 2) DEFAULT 0,
    manager_id UUID REFERENCES public.employees(id),
    progress INTEGER DEFAULT 0,
    team_size INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CRM Leads table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_code VARCHAR(50) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'New',
    source TEXT DEFAULT 'Website',
    value DECIMAL(12, 2) DEFAULT 0,
    assigned_to UUID REFERENCES public.employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assets table
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_code VARCHAR(50) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'Electronics',
    status TEXT DEFAULT 'Active',
    purchase_date DATE,
    purchase_cost DECIMAL(12, 2) DEFAULT 0,
    assigned_to TEXT,
    location TEXT,
    warranty_expiry DATE,
    condition TEXT DEFAULT 'Good',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- NOTIFICATIONS TABLE (with proper UUID foreign key references)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES public.users(id),
    sender_name TEXT,
    receiver_id UUID,
    receiver_type TEXT DEFAULT 'USER', -- USER, BRANCH, ALL
    branch_id UUID REFERENCES public.branches(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT DEFAULT 'GENERAL', -- GENERAL, URGENT, ANNOUNCEMENT, REMINDER
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- ADDITIONAL HR MODULE TABLES
-- ============================================================================

-- Departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    head_id UUID REFERENCES public.employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Designations table
CREATE TABLE IF NOT EXISTS public.designations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    department_id UUID REFERENCES public.departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LeaveRequests table
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id),
    leave_type_id UUID,
    leave_type TEXT DEFAULT 'Casual Leave',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'Pending',
    approved_by UUID REFERENCES public.users(id),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AttendanceLogs table
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id),
    branch_id UUID REFERENCES public.branches(id),
    gate_id UUID,
    device_id INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    log_type TEXT,
    punch_method TEXT,
    is_synced BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PayrollRecords table
CREATE TABLE IF NOT EXISTS public.payroll_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id),
    year_month TEXT, -- YYYY-MM
    basic_paid DECIMAL(10, 2),
    allowances_paid DECIMAL(10, 2),
    deductions_paid DECIMAL(10, 2),
    ot_paid DECIMAL(10, 2),
    net_pay DECIMAL(10, 2),
    days_present INTEGER,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE public.branches
    ADD CONSTRAINT fk_branches_org
    FOREIGN KEY (org_id) REFERENCES public.organizations(id);

ALTER TABLE public.employees
    ADD CONSTRAINT fk_employees_branch
    FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE public.employees
    ADD CONSTRAINT fk_employees_department
    FOREIGN KEY (department_id) REFERENCES public.departments(id);

ALTER TABLE public.employees
    ADD CONSTRAINT fk_employees_designation
    FOREIGN KEY (designation_id) REFERENCES public.designations(id);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_items_code ON public.items(item_code);
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items(category);
CREATE INDEX IF NOT EXISTS idx_items_active ON public.items(is_active);

CREATE INDEX IF NOT EXISTS idx_projects_code ON public.projects(project_code);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

CREATE INDEX IF NOT EXISTS idx_leads_code ON public.leads(lead_code);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

CREATE INDEX IF NOT EXISTS idx_assets_code ON public.assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);

CREATE INDEX IF NOT EXISTS idx_employees_code ON public.employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_branch ON public.employees(branch_id);

CREATE INDEX IF NOT EXISTS idx_notifications_sender ON public.notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON public.attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON public.attendance_logs(timestamp DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
-- Items policies
CREATE POLICY "Items are viewable by authenticated users"
    ON public.items FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Items can be inserted by authenticated users"
    ON public.items FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Items can be updated by authenticated users"
    ON public.items FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Items can be deleted by authenticated users"
    ON public.items FOR DELETE
    USING (auth.role() = 'authenticated');

-- Projects policies
CREATE POLICY "Projects are viewable by authenticated users"
    ON public.projects FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Projects can be inserted by authenticated users"
    ON public.projects FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Projects can be updated by authenticated users"
    ON public.projects FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Projects can be deleted by authenticated users"
    ON public.projects FOR DELETE
    USING (auth.role() = 'authenticated');

-- Leads policies
CREATE POLICY "Leads are viewable by authenticated users"
    ON public.leads FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Leads can be inserted by authenticated users"
    ON public.leads FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Leads can be updated by authenticated users"
    ON public.leads FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Leads can be deleted by authenticated users"
    ON public.leads FOR DELETE
    USING (auth.role() = 'authenticated');

-- Assets policies
CREATE POLICY "Assets are viewable by authenticated users"
    ON public.assets FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Assets can be inserted by authenticated users"
    ON public.assets FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Assets can be updated by authenticated users"
    ON public.assets FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Assets can be deleted by authenticated users"
    ON public.assets FOR DELETE
    USING (auth.role() = 'authenticated');

-- Notifications policies
CREATE POLICY "Notifications are viewable by authenticated users"
    ON public.notifications FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Notifications can be inserted by authenticated users"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Notifications can be updated by authenticated users"
    ON public.notifications FOR UPDATE
    USING (auth.role() = 'authenticated');

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert default organization
INSERT INTO public.organizations (id, name, address, contact_info, license_expiry)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default Organization',
    'Head Office',
    'contact@biobridge.com',
    '2026-12-31'
) ON CONFLICT (id) DO NOTHING;

-- Insert default branch
INSERT INTO public.branches (id, org_id, name, location)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Head Office',
    'Main Branch'
) ON CONFLICT (id) DO NOTHING;

-- Insert default admin user (password: admin123)
-- bcrypt hash for 'admin123'
INSERT INTO public.users (id, username, password_hash, role, is_active, must_change_password)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    '$2b$10$hmwXr.AU9waNfqdDwBPMwurCdtk5VT2mKSN4eqach.HlnACpNxv0y',
    'SUPER_ADMIN',
    true,
    true
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON public.assets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify tables exist
SELECT 
    tablename, 
    schemaname
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ BioBridge Pro ERP Supabase schema created successfully!';
    RAISE NOTICE '📊 Tables created: users, branches, organizations, employees, items, projects, leads, assets, notifications, departments, designations, leave_requests, attendance_logs, payroll_records';
    RAISE NOTICE '🔑 All primary keys use UUID with uuid_generate_v4()';
    RAISE NOTICE '🔒 Row Level Security (RLS) enabled on all tables';
    RAISE NOTICE '📝 Indexes created for optimal query performance';
END $$;
