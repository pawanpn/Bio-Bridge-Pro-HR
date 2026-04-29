-- ============================================================================
-- BioBridge Pro HR — COMPLETE SUPABASE SCHEMA
-- Paste into: Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to re-run; uses IF NOT EXISTS / IF EXISTS / DO blocks throughout
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE ALL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    legal_name TEXT,
    registration_number TEXT,
    tax_number TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'Nepal',
    postal_code TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    subscription_plan TEXT DEFAULT 'free',
    subscription_expires_at TIMESTAMPTZ,
    max_users INTEGER DEFAULT NULL,
    logo_url TEXT,
    timezone TEXT DEFAULT 'Asia/Kathmandu',
    currency TEXT DEFAULT 'NPR',
    fiscal_year_start TEXT DEFAULT '07-16',
    auth_key TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'EMPLOYEE',
    organization_id UUID,
    branch_id UUID,
    department_id TEXT,
    designation_id TEXT,
    auth_id UUID,
    employee_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    must_change_password BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    name TEXT NOT NULL,
    code TEXT,
    location TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    branch_id UUID,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    description TEXT,
    parent_id UUID,
    head_id UUID,
    budget NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    branch_id UUID,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    level INTEGER DEFAULT 0,
    grade TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    brand TEXT DEFAULT 'ZKTeco',
    ip_address TEXT NOT NULL,
    port INTEGER DEFAULT 4370,
    comm_key INTEGER DEFAULT 0,
    machine_number INTEGER DEFAULT 1,
    branch_id UUID,
    gate_id UUID,
    is_default BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'offline',
    subnet_mask TEXT,
    gateway TEXT,
    dns TEXT,
    dhcp BOOLEAN DEFAULT FALSE,
    server_mode TEXT DEFAULT 'Standalone',
    server_address TEXT,
    https_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EMPLOYEES — FULL SCHEMA matching Rust SQLite (all 55+ fields)
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    employee_code TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    name TEXT,
    full_name TEXT,
    date_of_birth DATE,
    gender TEXT,
    marital_status TEXT,
    nationality TEXT DEFAULT 'Nepali',
    religion TEXT,
    city TEXT,
    postcode TEXT,
    personal_email TEXT,
    personal_phone TEXT,
    contact_tel TEXT,
    office_tel TEXT,
    current_address TEXT,
    permanent_address TEXT,
    citizenship_number TEXT,
    pan_number TEXT,
    passport_no TEXT,
    national_id TEXT,
    local_name TEXT,
    motorcycle_license TEXT,
    automobile_license TEXT,
    branch_id UUID,
    department_id UUID,
    designation_id UUID,
    employment_type TEXT DEFAULT 'Full-time',
    employment_status TEXT DEFAULT 'Active',
    date_of_joining DATE,
    confirmation_date DATE,
    contract_end_date DATE,
    reporting_manager_id UUID,
    bank_name TEXT,
    account_number TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relation TEXT,
    area_id TEXT,
    location_id TEXT,
    photo TEXT,
    photo_url TEXT,
    enable_self_service BOOLEAN DEFAULT FALSE,
    enable_mobile_access BOOLEAN DEFAULT FALSE,
    verification_mode TEXT,
    device_privilege TEXT,
    device_password TEXT,
    card_no TEXT,
    bio_photo TEXT,
    biometric_id INTEGER,
    enable_attendance BOOLEAN DEFAULT TRUE,
    enable_holiday BOOLEAN DEFAULT TRUE,
    outdoor_management BOOLEAN DEFAULT FALSE,
    shift_start_time TEXT,
    shift_end_time TEXT,
    workflow_role TEXT,
    mobile_punch BOOLEAN DEFAULT FALSE,
    app_role TEXT,
    whatsapp_alert BOOLEAN DEFAULT FALSE,
    whatsapp_exception BOOLEAN DEFAULT FALSE,
    whatsapp_punch BOOLEAN DEFAULT FALSE,
    supervisor_mobile TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'active',
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID,
    organization_id UUID,
    branch_id UUID,
    gate_id UUID,
    device_id UUID,
    timestamp TIMESTAMPTZ NOT NULL,
    log_type TEXT DEFAULT 'in',
    punch_method TEXT DEFAULT 'device',
    is_synced BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID,
    organization_id UUID,
    leave_type TEXT DEFAULT 'Casual Leave',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    applied_by TEXT,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    employee_id UUID,
    basic_salary NUMERIC DEFAULT 0,
    allowances NUMERIC DEFAULT 0,
    deductions NUMERIC DEFAULT 0,
    effective_from DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    employee_id UUID,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    gross_salary NUMERIC DEFAULT 0,
    deductions NUMERIC DEFAULT 0,
    net_pay NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    setting_key TEXT NOT NULL,
    setting_value TEXT,
    category TEXT DEFAULT 'general',
    description TEXT,
    setting_type TEXT DEFAULT 'text',
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    data JSONB NOT NULL,
    supabase_id TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    module TEXT NOT NULL,
    permission TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    role TEXT NOT NULL,
    permission_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_branch_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    branch_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, branch_id)
);

CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    item_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'General',
    quantity INTEGER DEFAULT 0,
    unit_price NUMERIC DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    supplier TEXT,
    location TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    project_code TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Planning',
    priority TEXT DEFAULT 'Medium',
    start_date DATE,
    end_date DATE,
    budget NUMERIC DEFAULT 0,
    manager_id UUID,
    client_name TEXT,
    progress INTEGER DEFAULT 0,
    team_size INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID,
    task_name TEXT NOT NULL,
    description TEXT,
    assigned_to UUID,
    status TEXT DEFAULT 'Todo',
    priority TEXT DEFAULT 'Medium',
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    lead_name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    source TEXT,
    status TEXT DEFAULT 'New',
    priority TEXT DEFAULT 'Medium',
    assigned_to UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    asset_code TEXT UNIQUE,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Equipment',
    status TEXT DEFAULT 'Available',
    assigned_to UUID,
    purchase_date DATE,
    purchase_price NUMERIC DEFAULT 0,
    warranty_expiry DATE,
    location TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    due_date DATE,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    user_id UUID,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    user_id UUID,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    invoice_id UUID,
    amount NUMERIC NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    transaction_id TEXT,
    status TEXT DEFAULT 'completed',
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    user_id UUID,
    subject TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'medium',
    assigned_to UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Provider portal tables
CREATE TABLE IF NOT EXISTS public.provider_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    pin TEXT NOT NULL,
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'PROVIDER_SUPPORT',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.provider_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: ADD MISSING COLUMNS (safe — skips if already exists)
-- ============================================================================

DO $$
DECLARE
    col_name TEXT;
    col_type TEXT;
    col_default TEXT;
BEGIN
    FOR col_name, col_type, col_default IN
        VALUES
            ('name', 'TEXT', NULL),
            ('full_name', 'TEXT', NULL),
            ('religion', 'TEXT', NULL),
            ('city', 'TEXT', NULL),
            ('postcode', 'TEXT', NULL),
            ('contact_tel', 'TEXT', NULL),
            ('office_tel', 'TEXT', NULL),
            ('passport_no', 'TEXT', NULL),
            ('national_id', 'TEXT', NULL),
            ('local_name', 'TEXT', NULL),
            ('motorcycle_license', 'TEXT', NULL),
            ('automobile_license', 'TEXT', NULL),
            ('area_id', 'TEXT', NULL),
            ('location_id', 'TEXT', NULL),
            ('photo', 'TEXT', NULL),
            ('enable_self_service', 'BOOLEAN', 'false'),
            ('enable_mobile_access', 'BOOLEAN', 'false'),
            ('verification_mode', 'TEXT', NULL),
            ('device_privilege', 'TEXT', NULL),
            ('device_password', 'TEXT', NULL),
            ('card_no', 'TEXT', NULL),
            ('bio_photo', 'TEXT', NULL),
            ('biometric_id', 'INTEGER', NULL),
            ('enable_attendance', 'BOOLEAN', 'true'),
            ('enable_holiday', 'BOOLEAN', 'true'),
            ('outdoor_management', 'BOOLEAN', 'false'),
            ('shift_start_time', 'TEXT', NULL),
            ('shift_end_time', 'TEXT', NULL),
            ('workflow_role', 'TEXT', NULL),
            ('mobile_punch', 'BOOLEAN', 'false'),
            ('app_role', 'TEXT', NULL),
            ('whatsapp_alert', 'BOOLEAN', 'false'),
            ('whatsapp_exception', 'BOOLEAN', 'false'),
            ('whatsapp_punch', 'BOOLEAN', 'false'),
            ('supervisor_mobile', 'TEXT', NULL),
            ('status', 'TEXT', '''active''')
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = col_name
        ) THEN
            EXECUTE format(
                'ALTER TABLE public.employees ADD COLUMN %I %s%s',
                col_name,
                col_type,
                CASE WHEN col_default IS NOT NULL THEN ' DEFAULT ' || col_default ELSE '' END
            );
        END IF;
    END LOOP;
END $$;

-- Add password_changed_at if missing on users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_changed_at'
    ) THEN
        ALTER TABLE public.users ADD COLUMN password_changed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add auth_key if missing on organizations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'auth_key'
    ) THEN
        ALTER TABLE public.organizations ADD COLUMN auth_key TEXT;
    END IF;
END $$;

-- Add branch_id to departments if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE public.departments ADD COLUMN branch_id UUID;
    END IF;
END $$;

-- Add branch_id to designations if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'designations' AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE public.designations ADD COLUMN branch_id UUID;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: REVOKE ANONYMOUS ACCESS (safe — catches missing tables)
-- ============================================================================

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, PUBLIC';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- STEP 4: DROP ALL PERMISSIVE LEGACY POLICIES
-- ============================================================================

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
          AND policyname IN (
              'org_select_all','org_insert_all','org_update_all','org_delete_all',
              'users_select_all','users_insert_all','users_update_all','users_delete_all',
              'service_access','Enable all access','Allow service role full access',
              'Enable read access for all users','allow_all','Allow all on',
              'authenticated_access','authenticated_all',
              'select_all','insert_all','update_all','delete_all'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ============================================================================
-- STEP 5: CREATE INDEXES (safe — checks column exists first)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_emp_code ON public.employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_emp_biometric ON public.employees(biometric_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_sync_pending ON public.sync_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sync_table ON public.sync_queue(table_name);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='is_active') THEN
        CREATE INDEX IF NOT EXISTS idx_orgs_active ON public.organizations(is_active);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='organization_id') THEN
        CREATE INDEX IF NOT EXISTS idx_users_org ON public.users(organization_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='is_active') THEN
        CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='auth_id') THEN
        CREATE INDEX IF NOT EXISTS idx_users_auth ON public.users(auth_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='branches' AND column_name='organization_id') THEN
        CREATE INDEX IF NOT EXISTS idx_branches_org ON public.branches(organization_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='departments' AND column_name='organization_id') THEN
        CREATE INDEX IF NOT EXISTS idx_dept_org ON public.departments(organization_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='designations' AND column_name='organization_id') THEN
        CREATE INDEX IF NOT EXISTS idx_design_org ON public.designations(organization_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='organization_id') THEN
        CREATE INDEX IF NOT EXISTS idx_emp_org ON public.employees(organization_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='branch_id') THEN
        CREATE INDEX IF NOT EXISTS idx_emp_branch ON public.employees(branch_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='employment_status') THEN
        CREATE INDEX IF NOT EXISTS idx_emp_status ON public.employees(employment_status);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leave_requests' AND column_name='employee_id') THEN
        CREATE INDEX IF NOT EXISTS idx_leave_emp ON public.leave_requests(employee_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leave_requests' AND column_name='organization_id') THEN
        CREATE INDEX IF NOT EXISTS idx_leave_org ON public.leave_requests(organization_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='attendance_logs' AND column_name='employee_id') THEN
        CREATE INDEX IF NOT EXISTS idx_att_emp_time ON public.attendance_logs(employee_id, timestamp);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='attendance_logs' AND column_name='organization_id') THEN
        CREATE INDEX IF NOT EXISTS idx_att_org ON public.attendance_logs(organization_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='salary_structures' AND column_name='organization_id') THEN
        CREATE INDEX IF NOT EXISTS idx_salary_org ON public.salary_structures(organization_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='salary_structures' AND column_name='employee_id') THEN
        CREATE INDEX IF NOT EXISTS idx_salary_emp ON public.salary_structures(employee_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_settings' AND column_name='organization_id') THEN
        CREATE INDEX IF NOT EXISTS idx_settings_org ON public.system_settings(organization_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='organization_id') THEN
        CREATE INDEX IF NOT EXISTS idx_payments_org ON public.payments(organization_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='status') THEN
        CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='support_tickets' AND column_name='organization_id') THEN
        CREATE INDEX IF NOT EXISTS idx_tickets_org ON public.support_tickets(organization_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='support_tickets' AND column_name='status') THEN
        CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.support_tickets(status);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='organization_id') THEN
        CREATE INDEX IF NOT EXISTS idx_audit_org ON public.audit_logs(organization_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='user_id') THEN
        CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id);
    END IF;
END $$;

-- ============================================================================
-- STEP 6: UPDATE TRIGGER (auto-update updated_at)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at'
        ) THEN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger
                WHERE tgname = 'set_updated_at' AND tgrelid = (format('public.%I', t))::regclass
            ) THEN
                EXECUTE format(
                    'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
                    t
                );
            END IF;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 7: ROW LEVEL SECURITY (RLS)
-- ============================================================================

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE policyname = 'authenticated_read' AND tablename = t AND schemaname = 'public'
        ) THEN
            EXECUTE format(
                'CREATE POLICY "authenticated_read" ON public.%I FOR SELECT TO authenticated USING (true)',
                t
            );
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE policyname = 'service_role_all' AND tablename = t AND schemaname = 'public'
        ) THEN
            EXECUTE format(
                'CREATE POLICY "service_role_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
                t
            );
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 8: REALTIME (live sync via Supabase Realtime)
-- ============================================================================

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'employees','attendance_logs','leave_requests','items','projects',
            'leads','assets','notifications','branches','gates','devices',
            'users','organizations','payments','support_tickets','sync_queue'
        ])
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- DONE
-- ============================================================================
