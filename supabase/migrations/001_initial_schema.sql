-- ============================================================
-- Bio-Bridge Pro HR — CANONICAL MIGRATION
-- File: supabase/migrations/001_initial_schema.sql
--
-- This is the ONE source of truth for the database schema.
-- DELETE all other SQL files in the root after applying this:
--   MASTER_SCHEMA.sql, CREATE_ALL_TABLES.sql,
--   UNIFIED_SUPABASE_SCHEMA.sql, SUPABASE_SCHEMA_UUID.sql,
--   FIX_SUPABASE_MISMATCHES.sql, etc.
--
-- Apply with: supabase db reset
-- Or manually: psql -h <host> -U postgres -f this_file.sql
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── Helpers ─────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at trigger to a table
create or replace function add_updated_at_trigger(tbl text)
returns void language plpgsql as $$
begin
  execute format(
    'create trigger trg_%s_updated_at
     before update on %I
     for each row execute function set_updated_at()',
    tbl, tbl
  );
end;
$$;

-- ─── Organizations ────────────────────────────────────────────
create table if not exists organizations (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  code                text unique not null,
  email               text not null,
  phone               text,
  address             text,
  logo_url            text,
  website             text,
  fiscal_year_start   date,
  currency            text not null default 'NPR',
  timezone            text not null default 'Asia/Kathmandu',
  calendar_type       text not null default 'BS' check (calendar_type in ('BS','AD')),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
select add_updated_at_trigger('organizations');

-- ─── Branches ────────────────────────────────────────────────
create table if not exists branches (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  name                text not null,
  code                text not null,
  address             text,
  phone               text,
  email               text,
  is_head_office      boolean not null default false,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  unique (organization_id, code)
);

-- ─── Departments ─────────────────────────────────────────────
create table if not exists departments (
  id                    uuid primary key default uuid_generate_v4(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  parent_department_id  uuid references departments(id),
  name                  text not null,
  code                  text not null,
  head_employee_id      uuid, -- FK added after employees table
  description           text,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, code)
);
select add_updated_at_trigger('departments');

-- ─── Designations ────────────────────────────────────────────
create table if not exists designations (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  name                text not null,
  code                text not null,
  grade               text,
  description         text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  unique (organization_id, code)
);

-- ─── Roles ───────────────────────────────────────────────────
create table if not exists roles (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  name                text not null,
  code                text not null,
  parent_role_id      uuid references roles(id),
  role_level          int not null default 0, -- higher = more access
  permissions         jsonb not null default '[]',
  is_system_role      boolean not null default false,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  unique (organization_id, code)
);

-- Seed default system roles (idempotent)
insert into roles (id, organization_id, name, code, role_level, is_system_role, permissions)
select
  uuid_generate_v4(),
  id,
  r.name, r.code, r.level, true,
  r.permissions::jsonb
from organizations
cross join (values
  ('Super Admin',  'SUPER_ADMIN', 100, '["*"]'),
  ('Admin',        'ADMIN',       80,  '["hr:*","payroll:*","finance:*","attendance:*","leave:*","inventory:*","devices:*","settings:manage","reports:*"]'),
  ('Manager',      'MANAGER',     60,  '["hr:view_employees","payroll:view","attendance:view","leave:approve","leave:view","projects:*","reports:view"]'),
  ('Supervisor',   'SUPERVISOR',  40,  '["attendance:view","leave:view","leave:approve","devices:manage","reports:view"]'),
  ('Employee',     'EMPLOYEE',    20,  '["attendance:own","leave:apply","leave:view_own","payroll:view_own"]'),
  ('Viewer',       'VIEWER',      10,  '["hr:view_employees","attendance:view","reports:view"]')
) as r(name, code, level, permissions)
on conflict do nothing;

-- ─── Employees ───────────────────────────────────────────────
create table if not exists employees (
  id                        uuid primary key default uuid_generate_v4(),
  organization_id           uuid not null references organizations(id) on delete cascade,
  branch_id                 uuid not null references branches(id),
  department_id             uuid not null references departments(id),
  designation_id            uuid not null references designations(id),
  role_id                   uuid not null references roles(id),
  reporting_manager_id      uuid references employees(id),
  employee_code             text not null,
  first_name                text not null,
  middle_name               text,
  last_name                 text not null,
  gender                    text not null check (gender in ('Male','Female','Other','Prefer_Not_To_Say')),
  date_of_birth             date,
  blood_group               text,
  marital_status            text,
  nationality               text not null default 'Nepali',
  -- Encrypted fields (AES-256-GCM via Rust, stored as text)
  personal_email_enc        text not null,  -- encrypted
  work_email_enc            text,           -- encrypted
  personal_phone_enc        text not null,  -- encrypted
  work_phone_enc            text,           -- encrypted
  permanent_address_enc     text not null,  -- encrypted
  current_address_enc       text,           -- encrypted
  emergency_contact_enc     text,           -- encrypted JSON {name, phone, relation}
  -- Identification (encrypted)
  citizenship_number_enc    text,
  pan_number_enc            text,
  ssf_number_enc            text,
  passport_number_enc       text,
  -- Bank (encrypted)
  bank_name_enc             text,
  bank_account_enc          text,
  bank_branch_enc           text,
  -- Employment
  join_date                 date not null,
  confirmation_date         date,
  employment_status         text not null default 'Active'
                              check (employment_status in ('Active','Inactive','On_Leave','Probation','Resigned','Terminated','Retired')),
  employment_type           text not null default 'Full_Time'
                              check (employment_type in ('Full_Time','Part_Time','Contract','Intern')),
  -- Biometric
  biometric_id              text,
  photo_url                 text,
  -- Meta
  is_active                 boolean not null default true,
  created_by                uuid,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (organization_id, employee_code)
);
select add_updated_at_trigger('employees');

-- Add FK from departments to employees (circular ref, added after)
alter table departments
  add constraint fk_dept_head
  foreign key (head_employee_id) references employees(id)
  deferrable initially deferred;

-- ─── Shifts ──────────────────────────────────────────────────
create table if not exists shifts (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  name                text not null,
  start_time          time not null,
  end_time            time not null,
  break_duration_mins int not null default 60,
  late_grace_mins     int not null default 15,
  half_day_hours      numeric(4,2) not null default 4.0,
  is_night_shift      boolean not null default false,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

-- ─── Attendance Logs (raw device punches) ────────────────────
create table if not exists attendance_logs (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id     uuid not null references employees(id),
  device_id       uuid,
  punch_time      timestamptz not null,
  punch_type      text not null default 'Check_In'
                    check (punch_type in ('Check_In','Check_Out','Break_Start','Break_End')),
  source          text not null default 'Device'
                    check (source in ('Device','Manual','Mobile')),
  location        text,
  is_valid        boolean not null default true,
  notes           text,
  synced          boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_attendance_logs_employee_date
  on attendance_logs(employee_id, punch_time);

-- ─── Attendance Daily (processed summary) ────────────────────
create table if not exists attendance_daily (
  id                      uuid primary key default uuid_generate_v4(),
  organization_id         uuid not null references organizations(id) on delete cascade,
  employee_id             uuid not null references employees(id),
  shift_id                uuid references shifts(id),
  date                    date not null,
  check_in                timestamptz,
  check_out               timestamptz,
  total_hours             numeric(5,2),
  overtime_hours          numeric(5,2),
  late_minutes            int not null default 0,
  early_leave_minutes     int not null default 0,
  status                  text not null default 'Absent'
                            check (status in ('Present','Absent','Late','Half_Day','Holiday','Weekend','On_Leave')),
  is_regularized          boolean not null default false,
  regularized_by          uuid references employees(id),
  regularized_at          timestamptz,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (employee_id, date)
);
select add_updated_at_trigger('attendance_daily');
create index if not exists idx_attendance_daily_employee_date
  on attendance_daily(employee_id, date desc);
create index if not exists idx_attendance_daily_org_date
  on attendance_daily(organization_id, date desc);

-- ─── Leave Types ─────────────────────────────────────────────
create table if not exists leave_types (
  id                      uuid primary key default uuid_generate_v4(),
  organization_id         uuid not null references organizations(id) on delete cascade,
  name                    text not null,
  code                    text not null,
  days_allowed            int not null default 15,
  is_paid                 boolean not null default true,
  carry_forward           boolean not null default false,
  max_carry_forward_days  int not null default 0,
  gender_specific         text check (gender_specific in ('Male','Female','Other') or gender_specific is null),
  description             text,
  color                   text default '#378ADD',
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  unique (organization_id, code)
);

-- Seed standard Nepal leave types
insert into leave_types (id, organization_id, name, code, days_allowed, is_paid, carry_forward, max_carry_forward_days, gender_specific)
select
  uuid_generate_v4(), id, lt.name, lt.code, lt.days, true,
  lt.cf, lt.max_cf, lt.gender_specific::text
from organizations
cross join (values
  ('Annual Leave',       'AL',  18, true,  5,  null),
  ('Sick Leave',         'SL',  12, false, 0,  null),
  ('Casual Leave',       'CL',  6,  false, 0,  null),
  ('Maternity Leave',    'ML',  98, false, 0,  'Female'),
  ('Paternity Leave',    'PL',  15, false, 0,  'Male'),
  ('Bereavement Leave',  'BL',  5,  false, 0,  null),
  ('Marriage Leave',     'MRL', 7,  false, 0,  null),
  ('Public Holiday',     'PH',  13, false, 0,  null)
) as lt(name, code, days, cf, max_cf, gender_specific)
on conflict do nothing;

-- ─── Leave Balances ──────────────────────────────────────────
create table if not exists leave_balances (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  employee_id       uuid not null references employees(id),
  leave_type_id     uuid not null references leave_types(id),
  year              int not null,
  allocated_days    numeric(5,2) not null default 0,
  used_days         numeric(5,2) not null default 0,
  carried_days      numeric(5,2) not null default 0,
  updated_at        timestamptz not null default now(),
  unique (employee_id, leave_type_id, year)
);

-- ─── Leave Requests ──────────────────────────────────────────
create table if not exists leave_requests (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  employee_id       uuid not null references employees(id),
  leave_type_id     uuid not null references leave_types(id),
  start_date        date not null,
  end_date          date not null,
  total_days        numeric(5,2) not null,
  reason            text not null,
  status            text not null default 'Pending'
                      check (status in ('Pending','Approved','Rejected','Cancelled')),
  applied_at        timestamptz not null default now(),
  approved_by       uuid references employees(id),
  approved_at       timestamptz,
  rejection_reason  text,
  handover_notes    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
select add_updated_at_trigger('leave_requests');
create index if not exists idx_leave_requests_employee
  on leave_requests(employee_id, status, start_date desc);

-- ─── Salary Components ───────────────────────────────────────
create table if not exists salary_components (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  name              text not null,
  code              text not null,
  component_type    text not null check (component_type in ('Earning','Deduction','Employer_Contribution')),
  calculation_type  text not null default 'Fixed'
                      check (calculation_type in ('Fixed','Percentage_Of_Basic','Percentage_Of_Gross')),
  default_value     numeric(12,2) not null default 0,
  is_taxable        boolean not null default true,
  is_mandatory      boolean not null default false,
  description       text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (organization_id, code)
);

-- Seed default Nepal salary components
insert into salary_components (id, organization_id, name, code, component_type, calculation_type, default_value, is_taxable, is_mandatory)
select
  uuid_generate_v4(), id, c.name, c.code, c.type, c.calc, c.val, c.taxable, c.mandatory
from organizations
cross join (values
  ('Basic Salary',              'BASIC',     'Earning',                'Fixed',                   0,    true,  true),
  ('House Rent Allowance',      'HRA',       'Earning',                'Percentage_Of_Basic',     50,   true,  false),
  ('Transport Allowance',       'TA',        'Earning',                'Fixed',                   2000, false, false),
  ('Medical Allowance',         'MA',        'Earning',                'Fixed',                   500,  false, false),
  ('Dearness Allowance',        'DA',        'Earning',                'Percentage_Of_Basic',     10,   true,  false),
  ('SSF Employee (11%)',        'SSF_EMP',   'Deduction',              'Percentage_Of_Basic',     11,   false, true),
  ('Income Tax (TDS)',          'TDS',       'Deduction',              'Fixed',                   0,    false, true),
  ('CIT Employee (10%)',        'CIT_EMP',   'Deduction',              'Percentage_Of_Basic',     10,   false, false),
  ('SSF Employer (20%)',        'SSF_EMP_ER','Employer_Contribution',  'Percentage_Of_Basic',     20,   false, true),
  ('CIT Employer (10%)',        'CIT_ER',    'Employer_Contribution',  'Percentage_Of_Basic',     10,   false, false),
  ('Gratuity Provision',        'GRATUITY',  'Employer_Contribution',  'Percentage_Of_Basic',     8.33, false, false)
) as c(name, code, type, calc, val, taxable, mandatory)
on conflict do nothing;

-- ─── Salary Structures ───────────────────────────────────────
create table if not exists salary_structures (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id     uuid not null references employees(id),
  effective_from  date not null,
  effective_to    date,
  basic_salary    numeric(12,2) not null,
  components      jsonb not null default '[]',
  is_active       boolean not null default true,
  created_by      uuid references employees(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
select add_updated_at_trigger('salary_structures');

-- ─── Payroll Runs ─────────────────────────────────────────────
create table if not exists payroll_runs (
  id                        uuid primary key default uuid_generate_v4(),
  organization_id           uuid not null references organizations(id) on delete cascade,
  month                     int not null check (month between 1 and 12),
  year                      int not null,
  period_start              date not null,
  period_end                date not null,
  status                    text not null default 'Draft'
                              check (status in ('Draft','Processing','Processed','Paid','Cancelled')),
  total_employees           int not null default 0,
  total_gross               numeric(14,2) not null default 0,
  total_deductions          numeric(14,2) not null default 0,
  total_net                 numeric(14,2) not null default 0,
  total_employer_cost       numeric(14,2) not null default 0,
  processed_by              uuid references employees(id),
  processed_at              timestamptz,
  remarks                   text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (organization_id, month, year)
);
select add_updated_at_trigger('payroll_runs');

-- ─── Payroll Records ─────────────────────────────────────────
create table if not exists payroll_records (
  id                    uuid primary key default uuid_generate_v4(),
  payroll_run_id        uuid not null references payroll_runs(id) on delete cascade,
  organization_id       uuid not null references organizations(id),
  employee_id           uuid not null references employees(id),
  basic_salary          numeric(12,2) not null,
  gross_salary          numeric(12,2) not null,
  total_earnings        numeric(12,2) not null,
  total_deductions      numeric(12,2) not null,
  net_salary            numeric(12,2) not null,
  ssf_employee          numeric(12,2) not null default 0,
  ssf_employer          numeric(12,2) not null default 0,
  income_tax            numeric(12,2) not null default 0,
  cit_employee          numeric(12,2) not null default 0,
  cit_employer          numeric(12,2) not null default 0,
  working_days          int not null default 26,
  present_days          int not null default 0,
  absent_days           int not null default 0,
  leave_days            int not null default 0,
  overtime_hours        numeric(6,2) not null default 0,
  overtime_amount       numeric(12,2) not null default 0,
  components            jsonb not null default '[]',
  is_paid               boolean not null default false,
  paid_at               timestamptz,
  created_at            timestamptz not null default now(),
  unique (payroll_run_id, employee_id)
);

-- ─── Invoices ────────────────────────────────────────────────
create table if not exists invoices (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_number  text not null,
  client_name     text not null,
  client_email    text,
  client_address  text,
  issue_date      date not null,
  due_date        date not null,
  status          text not null default 'Draft'
                    check (status in ('Draft','Sent','Paid','Overdue','Cancelled')),
  subtotal        numeric(14,2) not null default 0,
  tax_rate        numeric(5,2) not null default 13, -- Nepal VAT 13%
  tax_amount      numeric(14,2) not null default 0,
  discount        numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  paid_amount     numeric(14,2) not null default 0,
  items           jsonb not null default '[]',
  notes           text,
  created_by      uuid references employees(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, invoice_number)
);
select add_updated_at_trigger('invoices');

-- ─── Inventory Items ─────────────────────────────────────────
create table if not exists inventory_categories (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  code            text not null,
  parent_id       uuid references inventory_categories(id),
  is_active       boolean not null default true
);

create table if not exists inventory_items (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  category_id     uuid references inventory_categories(id),
  code            text not null,
  name            text not null,
  description     text,
  unit            text not null default 'Pcs',
  hsn_code        text,
  current_stock   numeric(12,2) not null default 0,
  min_stock       numeric(12,2) not null default 0,
  max_stock       numeric(12,2),
  reorder_point   numeric(12,2) not null default 0,
  unit_cost       numeric(12,2) not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, code)
);
select add_updated_at_trigger('inventory_items');

create table if not exists stock_movements (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  item_id         uuid not null references inventory_items(id),
  warehouse_id    uuid,
  quantity        numeric(12,2) not null,
  type            text not null check (type in ('In','Out','Adjustment','Transfer')),
  reference       text,
  notes           text,
  created_by      uuid references employees(id),
  created_at      timestamptz not null default now()
);

-- ─── Biometric Devices ───────────────────────────────────────
create table if not exists biometric_devices (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id       uuid references branches(id),
  name            text not null,
  device_type     text not null default 'ZKTeco'
                    check (device_type in ('ZKTeco','Hikvision','Other')),
  ip_address      text not null,
  port            int not null default 4370,
  serial_number   text,
  location        text,
  status          text not null default 'Unknown'
                    check (status in ('Online','Offline','Error','Unknown')),
  last_sync       timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ─── System Settings ─────────────────────────────────────────
create table if not exists system_settings (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  key             text not null,
  value           text not null,
  setting_type    text not null default 'string'
                    check (setting_type in ('string','number','boolean','json')),
  category        text not null default 'general',
  description     text,
  is_public       boolean not null default false,
  updated_at      timestamptz not null default now(),
  unique (organization_id, key)
);

-- ─── Sync Queue ──────────────────────────────────────────────
create table if not exists sync_queue (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  table_name      text not null,
  record_id       uuid not null,
  operation       text not null check (operation in ('INSERT','UPDATE','DELETE')),
  payload         jsonb not null,
  status          text not null default 'Pending'
                    check (status in ('Pending','Syncing','Synced','Failed','Conflict')),
  attempt_count   int not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  synced_at       timestamptz
);
create index if not exists idx_sync_queue_status
  on sync_queue(status, created_at);

-- ─── Audit Logs ──────────────────────────────────────────────
create table if not exists audit_logs (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null,
  action          text not null check (action in ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','SYNC')),
  table_name      text not null,
  record_id       uuid,
  old_values      jsonb,
  new_values      jsonb,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_audit_logs_org_date
  on audit_logs(organization_id, created_at desc);

-- ─── Notifications ───────────────────────────────────────────
create table if not exists notifications (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null,
  type            text not null,
  title           text not null,
  body            text not null,
  link            text,
  is_read         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_notifications_user_unread
  on notifications(user_id, is_read, created_at desc);

-- ─── Row Level Security ──────────────────────────────────────

alter table organizations        enable row level security;
alter table branches             enable row level security;
alter table departments          enable row level security;
alter table designations         enable row level security;
alter table roles                enable row level security;
alter table employees            enable row level security;
alter table shifts               enable row level security;
alter table attendance_logs      enable row level security;
alter table attendance_daily     enable row level security;
alter table leave_types          enable row level security;
alter table leave_balances       enable row level security;
alter table leave_requests       enable row level security;
alter table salary_components    enable row level security;
alter table salary_structures    enable row level security;
alter table payroll_runs         enable row level security;
alter table payroll_records      enable row level security;
alter table invoices             enable row level security;
alter table inventory_items      enable row level security;
alter table stock_movements      enable row level security;
alter table biometric_devices    enable row level security;
alter table system_settings      enable row level security;
alter table sync_queue           enable row level security;
alter table audit_logs           enable row level security;
alter table notifications        enable row level security;

-- RLS policy helper: users can only see their organization's data
create or replace function current_org_id()
returns uuid language sql stable as $$
  select (current_setting('app.organization_id', true))::uuid
$$;

-- Apply to all tables with organization_id
do $$
declare
  t text;
  tables text[] := array[
    'branches','departments','designations','roles','employees',
    'shifts','attendance_logs','attendance_daily','leave_types',
    'leave_balances','leave_requests','salary_components',
    'salary_structures','payroll_runs','payroll_records',
    'invoices','inventory_items','stock_movements',
    'biometric_devices','system_settings','sync_queue',
    'audit_logs','notifications'
  ];
begin
  foreach t in array tables loop
    execute format(
      'create policy "org_isolation_%s" on %I
       using (organization_id = current_org_id())',
      t, t
    );
  end loop;
end;
$$;

-- ─── Done ────────────────────────────────────────────────────
-- After applying this file, delete from root:
--   MASTER_SCHEMA.sql, CREATE_ALL_TABLES.sql,
--   UNIFIED_SUPABASE_SCHEMA.sql, SUPABASE_SCHEMA_UUID.sql,
--   FIX_SUPABASE_MISMATCHES.sql, and all other *.sql files
--   that aren't in supabase/migrations/
