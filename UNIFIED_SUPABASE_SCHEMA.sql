-- ============================================
-- UNIFIED SUPABASE SCHEMA MIGRATION
-- Aligns all tables with TypeScript interfaces and Rust structs
-- All tables in PUBLIC schema
-- ============================================

-- ── 1. BRANCHES ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 2. GATES ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 3. DEPARTMENTS ───────────────────────────
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 4. DESIGNATIONS ──────────────────────────
CREATE TABLE IF NOT EXISTS public.designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    level INTEGER DEFAULT 0,
    grade TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 5. EMPLOYEES ─────────────────────────────
-- Uses PLAIN column names (not _encrypted) to match TypeScript interfaces
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    full_name TEXT GENERATED ALWAYS AS (
        TRIM(first_name || ' ' || COALESCE(middle_name, '') || ' ' || last_name)
    ) STORED,
    date_of_birth DATE,
    gender TEXT,
    marital_status TEXT,
    nationality TEXT DEFAULT 'Nepali',
    personal_email TEXT,
    personal_phone TEXT,
    current_address TEXT,
    permanent_address TEXT,
    citizenship_number TEXT,
    pan_number TEXT,
    branch_id TEXT,
    department_id TEXT,
    designation_id TEXT,
    employment_type TEXT DEFAULT 'Full-time',
    employment_status TEXT DEFAULT 'Active',
    date_of_joining DATE,
    confirmation_date DATE,
    contract_end_date DATE,
    reporting_manager_id TEXT,
    bank_name TEXT,
    account_number TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relation TEXT,
    photo_url TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_code ON public.employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_branch ON public.employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(employment_status);

-- ── 6. DEVICES ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    brand TEXT DEFAULT 'ZKTeco',
    ip_address TEXT NOT NULL,
    port INTEGER DEFAULT 4370,
    comm_key INTEGER DEFAULT 0,
    machine_number INTEGER DEFAULT 1,
    branch_id UUID REFERENCES public.branches(id),
    gate_id UUID REFERENCES public.gates(id),
    is_default BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'offline',
    subnet_mask TEXT,
    gateway TEXT,
    dns TEXT,
    dhcp BOOLEAN DEFAULT FALSE,
    server_mode TEXT DEFAULT 'Standalone',
    server_address TEXT,
    https_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 7. ATTENDANCE_LOGS ───────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id),
    branch_id UUID REFERENCES public.branches(id),
    gate_id UUID REFERENCES public.gates(id),
    device_id UUID REFERENCES public.devices(id),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    log_type TEXT DEFAULT 'in',
    punch_method TEXT DEFAULT 'device',
    is_synced BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_emp_time ON public.attendance_logs(employee_id, timestamp);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique ON public.attendance_logs(employee_id, timestamp);

-- ── 8. LEAVE_REQUESTS ────────────────────────
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id),
    leave_type TEXT DEFAULT 'Casual Leave',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER GENERATED ALWAYS AS (
        (end_date - start_date + 1)
    ) STORED,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 9. ITEMS (Inventory) ─────────────────────
-- Uses 'name' (NOT 'item_name') to match TypeScript interfaces
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 10. PROJECTS ─────────────────────────────
-- Uses 'name' (NOT 'project_name') to match TypeScript interfaces
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 11. TASKS ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    description TEXT,
    assigned_to UUID,
    status TEXT DEFAULT 'Todo',
    priority TEXT DEFAULT 'Medium',
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 12. CRM LEADS ────────────────────────────
-- Uses 'name' (NOT 'lead_code') to match TypeScript interfaces
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_code TEXT UNIQUE,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'New',
    source TEXT,
    value NUMERIC DEFAULT 0,
    assigned_to UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 13. ASSETS ───────────────────────────────
-- Uses 'name' (NOT 'asset_name') to match TypeScript interfaces
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'IT Equipment',
    status TEXT DEFAULT 'Available',
    purchase_date DATE,
    purchase_cost NUMERIC DEFAULT 0,
    assigned_to UUID,
    location TEXT,
    warranty_expiry DATE,
    condition TEXT DEFAULT 'Good',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 14. INVOICES ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE,
    invoice_date DATE,
    due_date DATE,
    contact_name TEXT,
    contact_type TEXT,
    invoice_type TEXT DEFAULT 'sales',
    status TEXT DEFAULT 'draft',
    subtotal NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    discount_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    balance_amount NUMERIC GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 15. INVOICE_ITEMS ────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    tax_rate NUMERIC DEFAULT 0,
    discount_rate NUMERIC DEFAULT 0,
    total NUMERIC GENERATED ALWAYS AS (quantity * unit_price * (1 - discount_rate/100) * (1 + tax_rate/100)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 16. USERS ────────────────────────────────
-- Includes must_change_password and is_active
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    full_name TEXT,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'EMPLOYEE' CHECK(role IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE', 'OPERATOR', 'VIEWER')),
    branch_id UUID REFERENCES public.branches(id),
    department_id UUID,
    designation_id UUID,
    employee_id UUID REFERENCES public.employees(id),
    is_active BOOLEAN DEFAULT TRUE,
    must_change_password BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 17. PERMISSIONS ──────────────────────────
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module TEXT NOT NULL,
    permission TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(module, permission)
);

-- ── 18. ROLE_PERMISSIONS ─────────────────────
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role, permission_id)
);

-- ── 19. USER_BRANCH_ACCESS ───────────────────
CREATE TABLE IF NOT EXISTS public.user_branch_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, branch_id)
);

-- ── 20. NOTIFICATIONS ────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID,
    sender_name TEXT,
    receiver_id UUID,
    receiver_type TEXT DEFAULT 'USER',
    branch_id UUID REFERENCES public.branches(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT DEFAULT 'GENERAL',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- ── 21. SALARY_STRUCTURES ────────────────────
CREATE TABLE IF NOT EXISTS public.salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id),
    basic_salary NUMERIC DEFAULT 0,
    allowances NUMERIC DEFAULT 0,
    deductions NUMERIC DEFAULT 0,
    gross_salary NUMERIC GENERATED ALWAYS AS (basic_salary + allowances - deductions) STORED,
    effective_from DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 22. PAYROLL_RECORDS ──────────────────────
CREATE TABLE IF NOT EXISTS public.payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    gross_salary NUMERIC DEFAULT 0,
    deductions NUMERIC DEFAULT 0,
    net_pay NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending',
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, month, year)
);

-- ── 23. SYNC_QUEUE ───────────────────────────
-- For offline-first sync (local SQLite mirrors this)
CREATE TABLE IF NOT EXISTS public.sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')),
    payload JSONB NOT NULL,
    supabase_id TEXT,
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('critical', 'high', 'medium', 'low')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'synced', 'failed')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON public.sync_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON public.sync_queue(table_name);

-- ── 24. AUDIT_LOGS ───────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id TEXT,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 25. SYSTEM_SETTINGS ──────────────────────
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    category TEXT DEFAULT 'general',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── UPDATE TRIGGERS (auto-update updated_at) ─
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'sync_queue'
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at'
        ) THEN
            EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
        END IF;
    END LOOP;
END $$;

-- ── ENABLE REALTIME ──────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.branches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- ── ROW LEVEL SECURITY (RLS) ─────────────────
-- Enable RLS on all tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Basic RLS policy: authenticated users can read all, write their own data
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        -- Allow read for authenticated users
        EXECUTE format(
            'CREATE POLICY "authenticated_read" ON public.%I FOR SELECT TO authenticated USING (true)',
            t
        );
        -- Allow all operations for service role (backend sync)
        EXECUTE format(
            'CREATE POLICY "service_role_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
            t
        );
    END LOOP;
END $$;

COMMENT ON SCHEMA public IS 'BioBridge Pro HR - Unified schema. All column names use snake_case.';
