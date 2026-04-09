-- ============================================
-- CORRECTED SUPABASE SCHEMA MIGRATION
-- Based on ACTUAL Supabase column export
-- Fixes: items.item_name, sync_queue.data, missing tables
-- ============================================

-- ── ITEMS: Actual column is item_name (NOT name) ──
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS item_name TEXT;
-- Migrate existing data
UPDATE public.items SET item_name = name WHERE item_name IS NULL AND name IS NOT NULL;
-- TypeScript/Rust must use item_name to match DB

-- ── SYNC_QUEUE: Actual column is data (NOT payload) ──
ALTER TABLE public.sync_queue ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.sync_queue ADD COLUMN IF NOT EXISTS organization_id UUID;
-- Migrate existing data
UPDATE public.sync_queue SET data = payload::jsonb WHERE data IS NULL AND payload IS NOT NULL;

-- ── ATTENDANCE_LOGS: device_id is TEXT (not UUID) ──
-- Already matches in our code

-- ── EMPLOYEES: Plain column names (confirmed correct) ──
-- personal_email, personal_phone, account_number all match

-- ── USERS: must_change_password confirmed present ──
-- Already matches

-- ── MISSING TABLES: Create if not exist ──

-- GATES
CREATE TABLE IF NOT EXISTS public.gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DEVICES
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PROJECTS
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    project_code TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Planning',
    start_date DATE,
    end_date DATE,
    budget NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TASKS
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    description TEXT,
    assigned_to UUID,
    status TEXT DEFAULT 'Todo',
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LEADS (CRM)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'New',
    source TEXT,
    value NUMERIC DEFAULT 0,
    assigned_to UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ASSETS
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'IT Equipment',
    status TEXT DEFAULT 'Available',
    purchase_date DATE,
    purchase_cost NUMERIC DEFAULT 0,
    assigned_to UUID,
    location TEXT,
    condition TEXT DEFAULT 'Good',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NOTIFICATIONS
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

-- LEAVE_TYPES
CREATE TABLE IF NOT EXISTS public.leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    is_paid BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ATTENDANCE_DAILY
CREATE TABLE IF NOT EXISTS public.attendance_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id),
    organization_id UUID REFERENCES public.organizations(id),
    date DATE NOT NULL,
    shift_id UUID,
    first_in TIMESTAMP WITH TIME ZONE,
    last_out TIMESTAMP WITH TIME ZONE,
    working_hours NUMERIC,
    overtime_hours NUMERIC,
    status TEXT DEFAULT 'present',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

-- SHIFTS
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    start_time TIME WITHOUT TIME ZONE,
    end_time TIME WITHOUT TIME ZONE,
    grace_period_minutes INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SALARY_COMPONENTS
CREATE TABLE IF NOT EXISTS public.salary_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    type TEXT DEFAULT 'earning',
    is_taxable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PAYROLL_RUNS
CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    total_net_pay NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(month, year, organization_id)
);

-- CHART_OF_ACCOUNTS
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    account_code TEXT UNIQUE,
    account_name TEXT NOT NULL,
    account_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SALARY_STRUCTURES
CREATE TABLE IF NOT EXISTS public.salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id),
    basic_salary NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ENABLE REALTIME for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.gates;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.assets;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.leave_types;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.attendance_daily;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.salary_components;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.payroll_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.chart_of_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.salary_structures;

COMMENT ON TABLE public.items IS 'CRITICAL: Uses item_name column (NOT name). TypeScript must map Item.name → item_name';
COMMENT ON TABLE public.sync_queue IS 'CRITICAL: Uses data column (NOT payload). Rust must map payload → data';
