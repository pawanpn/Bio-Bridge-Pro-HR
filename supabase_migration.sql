-- ============================================================================
-- BioBridge Pro HR — Supabase (PostgreSQL) Full Schema Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT throughout
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ORGANIZATIONS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    address       TEXT,
    contact_info  TEXT,
    auth_key      TEXT UNIQUE,
    license_expiry TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. BRANCHES
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
    id        BIGSERIAL PRIMARY KEY,
    org_id    BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name      TEXT NOT NULL,
    location  TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. DEPARTMENTS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. DESIGNATIONS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS designations (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. GATES
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gates (
    id        BIGSERIAL PRIMARY KEY,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name      TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. EMPLOYEES (Full schema with all extended fields)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
    id                        BIGSERIAL PRIMARY KEY,
    branch_id                 BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name                      TEXT,
    rfid                      TEXT,
    pin                       TEXT,
    department                TEXT,
    status                    TEXT DEFAULT 'active',

    -- Extended fields (full CRUD)
    employee_code             TEXT,
    first_name                TEXT,
    middle_name               TEXT,
    last_name                 TEXT,
    date_of_birth             TEXT,
    gender                    TEXT,
    marital_status            TEXT,
    personal_email            TEXT,
    personal_phone            TEXT,
    current_address           TEXT,
    permanent_address         TEXT,
    citizenship_number        TEXT,
    pan_number                TEXT,
    national_id               TEXT,
    department_id             TEXT,
    designation_id            TEXT,
    date_of_joining           TEXT,
    employment_type           TEXT,
    employment_status         TEXT DEFAULT 'Active',
    reporting_manager_id      TEXT,
    bank_name                 TEXT,
    account_number            TEXT,
    emergency_contact_name    TEXT,
    emergency_contact_phone   TEXT,
    emergency_contact_relation TEXT,
    area_id                   TEXT,
    location_id               TEXT,
    photo                     TEXT,
    enable_self_service       BOOLEAN DEFAULT FALSE,
    enable_mobile_access      BOOLEAN DEFAULT FALSE,
    local_name                TEXT,
    contact_tel               TEXT,
    office_tel                TEXT,
    motorcycle_license        TEXT,
    automobile_license        TEXT,
    religion                  TEXT,
    city                      TEXT,
    postcode                  TEXT,
    passport_no               TEXT,
    nationality               TEXT,
    biometric_id              INTEGER,

    -- Device & Attendance settings
    verification_mode         TEXT,
    device_privilege          TEXT,
    device_password           TEXT,
    card_no                   TEXT,
    bio_photo                 TEXT,
    enable_attendance         BOOLEAN DEFAULT TRUE,
    enable_holiday            BOOLEAN DEFAULT TRUE,
    outdoor_management        BOOLEAN DEFAULT FALSE,
    workflow_role             TEXT,
    mobile_punch              BOOLEAN DEFAULT FALSE,
    app_role                  TEXT,

    -- WhatsApp / alerts
    whatsapp_alert            BOOLEAN DEFAULT FALSE,
    whatsapp_exception        BOOLEAN DEFAULT FALSE,
    whatsapp_punch            BOOLEAN DEFAULT FALSE,
    supervisor_mobile         TEXT,

    created_at                TIMESTAMPTZ DEFAULT NOW(),
    updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. DEVICES
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    brand           TEXT NOT NULL,
    ip_address      TEXT NOT NULL,
    port            INTEGER NOT NULL,
    comm_key        INTEGER DEFAULT 0,
    machine_number  INTEGER DEFAULT 1,
    is_default      BOOLEAN DEFAULT FALSE,
    branch_id       BIGINT REFERENCES branches(id),
    gate_id         BIGINT REFERENCES gates(id),
    status          TEXT DEFAULT 'offline',
    subnet_mask     TEXT,
    gateway         TEXT,
    dns             TEXT,
    dhcp            BOOLEAN DEFAULT FALSE,
    server_mode     TEXT,
    server_address  TEXT,
    https_enabled   BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. ATTENDANCE LOGS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_logs (
    id            BIGSERIAL PRIMARY KEY,
    employee_id   BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id     BIGINT NOT NULL REFERENCES branches(id),
    gate_id       BIGINT NOT NULL DEFAULT 1 REFERENCES gates(id),
    device_id     BIGINT NOT NULL REFERENCES devices(id),
    timestamp     TIMESTAMPTZ NOT NULL,
    log_type      TEXT,
    punch_method  TEXT,
    is_synced     BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_emp_time
    ON attendance_logs (employee_id, timestamp);

-- ────────────────────────────────────────────────────────────────────────────
-- 9. HOLIDAYS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holidays (
    id          BIGSERIAL PRIMARY KEY,
    date        TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 10. LEAVE REQUESTS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
    id          BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    start_date  TEXT NOT NULL,
    end_date    TEXT NOT NULL,
    status      TEXT DEFAULT 'pending',
    leave_type  TEXT DEFAULT 'Casual Leave',
    reason      TEXT,
    approved_by TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 11. USERS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                   BIGSERIAL PRIMARY KEY,
    username             TEXT UNIQUE NOT NULL,
    password_hash        TEXT NOT NULL,
    role                 TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'OPERATOR')),
    branch_id            BIGINT REFERENCES branches(id),
    is_active            BOOLEAN DEFAULT TRUE,
    must_change_password BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 12. CLOUD CONFIG
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cloud_config (
    id              BIGSERIAL PRIMARY KEY,
    client_email    TEXT,
    private_key     TEXT,
    project_id      TEXT,
    root_folder_id  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 13. SALARY STRUCTURES
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_structures (
    id            BIGSERIAL PRIMARY KEY,
    employee_id   BIGINT UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
    basic_salary  DOUBLE PRECISION DEFAULT 0,
    allowances    DOUBLE PRECISION DEFAULT 0,
    deductions    DOUBLE PRECISION DEFAULT 0,
    overtime_rate DOUBLE PRECISION DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 14. PAYROLL RECORDS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_records (
    id               BIGSERIAL PRIMARY KEY,
    employee_id      BIGINT REFERENCES employees(id) ON DELETE CASCADE,
    year_month       TEXT,                         -- YYYY-MM
    basic_paid       DOUBLE PRECISION,
    allowances_paid  DOUBLE PRECISION,
    deductions_paid  DOUBLE PRECISION,
    ot_paid          DOUBLE PRECISION,
    net_pay          DOUBLE PRECISION,
    days_present     INTEGER,
    generated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 15. LEAVE MANAGEMENT
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_management (
    id          BIGSERIAL PRIMARY KEY,
    employee_id BIGINT REFERENCES employees(id) ON DELETE CASCADE,
    leave_type  TEXT,                              -- Sick, Casual, Paid
    start_date  TEXT,
    end_date    TEXT,
    status      TEXT DEFAULT 'Approved',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 16. OVERTIME TRACKER
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS overtime_tracker (
    id            BIGSERIAL PRIMARY KEY,
    employee_id   BIGINT REFERENCES employees(id) ON DELETE CASCADE,
    date          TEXT,
    shift_end     TEXT,
    actual_out    TEXT,
    ot_hours      DOUBLE PRECISION,
    is_processed  BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 17. EMPLOYEE DOCUMENTS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_documents (
    id            BIGSERIAL PRIMARY KEY,
    employee_id   BIGINT REFERENCES employees(id) ON DELETE CASCADE,
    doc_type      TEXT,
    doc_name      TEXT,
    cloud_file_id TEXT,
    upload_date   TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 18. USER BRANCH ACCESS (Multi-branch)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_branch_access (
    id        BIGSERIAL PRIMARY KEY,
    user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    UNIQUE(user_id, branch_id)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 19. NOTIFICATIONS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id                BIGSERIAL PRIMARY KEY,
    sender_id         BIGINT REFERENCES users(id),
    sender_name       TEXT,
    receiver_id       BIGINT REFERENCES users(id),
    receiver_type     TEXT DEFAULT 'USER',           -- USER, BRANCH, ALL
    branch_id         BIGINT REFERENCES branches(id),
    title             TEXT NOT NULL,
    message           TEXT NOT NULL,
    notification_type TEXT DEFAULT 'GENERAL',         -- GENERAL, URGENT, ANNOUNCEMENT, REMINDER
    is_read           BOOLEAN DEFAULT FALSE,
    read_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    expires_at        TIMESTAMPTZ
);

-- ────────────────────────────────────────────────────────────────────────────
-- 20. INVENTORY ITEMS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
    id            BIGSERIAL PRIMARY KEY,
    item_code     TEXT UNIQUE NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT,
    category      TEXT DEFAULT 'General',
    quantity      INTEGER DEFAULT 0,
    unit_price    DOUBLE PRECISION DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    supplier      TEXT,
    location      TEXT,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 21. PROJECTS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id           BIGSERIAL PRIMARY KEY,
    project_code TEXT UNIQUE NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    status       TEXT DEFAULT 'Planning',
    priority     TEXT DEFAULT 'Medium',
    start_date   TEXT,
    end_date     TEXT,
    budget       DOUBLE PRECISION DEFAULT 0,
    progress     INTEGER DEFAULT 0,
    team_size    INTEGER DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 22. TASKS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id          BIGSERIAL PRIMARY KEY,
    project_id  BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_name   TEXT NOT NULL,
    description TEXT,
    assigned_to BIGINT REFERENCES employees(id),
    status      TEXT DEFAULT 'Todo',
    priority    TEXT DEFAULT 'Medium',
    due_date    TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 23. CRM LEADS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
    id         BIGSERIAL PRIMARY KEY,
    lead_code  TEXT UNIQUE NOT NULL,
    name       TEXT NOT NULL,
    company    TEXT,
    email      TEXT,
    phone      TEXT,
    status     TEXT DEFAULT 'New',
    source     TEXT DEFAULT 'Website',
    value      DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 24. ASSETS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
    id              BIGSERIAL PRIMARY KEY,
    asset_code      TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    category        TEXT DEFAULT 'Electronics',
    status          TEXT DEFAULT 'Active',
    purchase_date   TEXT,
    purchase_cost   DOUBLE PRECISION DEFAULT 0,
    assigned_to     TEXT,
    location        TEXT,
    warranty_expiry TEXT,
    condition       TEXT DEFAULT 'Good',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 25. SYSTEM CONFIGS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_configs (
    id       BIGSERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    key      TEXT NOT NULL,
    value    TEXT,
    UNIQUE(category, key)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 26. AUDIT LOGS (used by crud.rs log_audit helper)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    table_name  TEXT,
    record_id   TEXT,
    action      TEXT,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 27. INVOICES (used by crud.rs create_invoice / list_invoices)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id             BIGSERIAL PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_name  TEXT,
    amount         DOUBLE PRECISION DEFAULT 0,
    status         TEXT DEFAULT 'Draft',
    due_date       TEXT,
    items          JSONB,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) on all tables
-- Adjust policies to your auth needs
-- ============================================================================

ALTER TABLE organizations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE designations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gates              ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays           ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_structures  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_management   ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_tracker   ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_configs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;

-- ── Allow full access via service_role key (used by desktop app sync) ──
-- These policies allow the service_role (anon key won't bypass RLS) to
-- perform all operations. Adjust if you add browser-based auth later.

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'organizations','branches','departments','designations','gates',
        'employees','devices','attendance_logs','holidays','leave_requests',
        'users','cloud_config','salary_structures','payroll_records',
        'leave_management','overtime_tracker','employee_documents',
        'user_branch_access','notifications','items','projects','tasks',
        'leads','assets','system_configs','audit_logs','invoices'
    ]
    LOOP
        EXECUTE format(
            'CREATE POLICY IF NOT EXISTS "Allow service role full access" ON %I FOR ALL USING (true) WITH CHECK (true)',
            tbl
        );
    END LOOP;
END
$$;


-- ============================================================================
-- USEFUL INDEXES for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_employees_branch     ON employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_status     ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_code       ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_attendance_date      ON attendance_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_employee  ON attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_devices_branch       ON devices(branch_id);
CREATE INDEX IF NOT EXISTS idx_leave_employee       ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_employee      ON salary_structures(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employee     ON payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_receiver ON notifications(receiver_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project        ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_table          ON audit_logs(table_name);


-- ============================================================================
-- Done! All 27 tables created and ready for sync.
-- ============================================================================
