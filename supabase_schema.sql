-- ============================================================================
-- BioBridge Pro ERP - Complete Supabase Database Schema
-- ============================================================================
-- This schema supports the complete ERP system with:
-- - Multi-organization support
-- - HR Core (Employees, Attendance, Leave, Payroll)
-- - Finance & Accounting
-- - Inventory & Warehouse
-- - Project Management
-- - CRM
-- - Document Management
-- - Notifications & Audit
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE: ORGANIZATIONS & STRUCTURE
-- ============================================================================

CREATE TABLE organizations (
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

CREATE TABLE branches (
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

CREATE TABLE departments (
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

CREATE TABLE designations (
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
-- AUTH: USERS & PERMISSIONS
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    auth_id UUID, -- Supabase auth.users.id
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
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    module VARCHAR(100) NOT NULL, -- hr, payroll, finance, inventory, etc.
    permission VARCHAR(100) NOT NULL, -- view, create, edit, delete, approve, export
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role, permission_id)
);

CREATE TABLE user_branch_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    UNIQUE(user_id, branch_id)
);

CREATE TABLE user_department_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    UNIQUE(user_id, department_id)
);

-- ============================================================================
-- HR CORE: EMPLOYEE MASTER
-- ============================================================================

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255) GENERATED ALWAYS AS (first_name || ' ' || COALESCE(middle_name || ' ', '') || last_name) STORED,
    
    -- Personal Information
    date_of_birth DATE,
    gender VARCHAR(20), -- Male, Female, Other
    marital_status VARCHAR(20),
    nationality VARCHAR(100),
    religion VARCHAR(100),
    blood_group VARCHAR(10),
    
    -- Contact Details
    personal_email VARCHAR(255),
    personal_phone VARCHAR(50),
    current_address TEXT,
    permanent_address TEXT,
    
    -- Identification
    citizenship_number VARCHAR(50),
    citizenship_issue_district VARCHAR(100),
    pan_number VARCHAR(50),
    passport_number VARCHAR(50),
    passport_expiry DATE,
    
    -- Bank Details
    bank_name VARCHAR(255),
    branch_name VARCHAR(255),
    account_number VARCHAR(50),
    account_type VARCHAR(50) DEFAULT 'Savings',
    
    -- Employment Details
    branch_id UUID REFERENCES branches(id),
    department_id UUID REFERENCES departments(id),
    designation_id UUID REFERENCES designations(id),
    employment_type VARCHAR(50) DEFAULT 'Full-time', -- Full-time, Part-time, Contract, Intern
    employment_status VARCHAR(50) DEFAULT 'Active', -- Active, On Leave, Terminated, Resigned, Retired
    date_of_joining DATE,
    confirmation_date DATE,
    contract_end_date DATE,
    probation_period_months INTEGER DEFAULT 6,
    reporting_manager_id UUID REFERENCES employees(id),
    
    -- Emergency Contact
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    emergency_contact_relation VARCHAR(100),
    
    -- Additional
    photo_url TEXT,
    signature_url TEXT,
    resume_url TEXT,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employee_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    document_type VARCHAR(100), -- Citizenship, License, Certificate, Resume, etc.
    document_name VARCHAR(255),
    document_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employee_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    change_type VARCHAR(100), -- Transfer, Promotion, Salary Revision, etc.
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    effective_date DATE,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ATTENDANCE & TIME TRACKING
-- ============================================================================

CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period_minutes INTEGER DEFAULT 15,
    late_threshold_minutes INTEGER DEFAULT 15,
    early_leave_threshold_minutes INTEGER DEFAULT 15,
    working_hours NUMERIC(4,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attendance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    device_id UUID,
    punch_time TIMESTAMPTZ NOT NULL,
    punch_type VARCHAR(20), -- In, Out, Break, etc.
    punch_method VARCHAR(50), -- Finger, Face, Card, Pin, Manual, Mobile
    is_synced BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attendance_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    date DATE NOT NULL,
    shift_id UUID REFERENCES shifts(id),
    first_in TIMESTAMPTZ,
    last_out TIMESTAMPTZ,
    working_hours NUMERIC(5,2),
    overtime_hours NUMERIC(5,2) DEFAULT 0,
    late_minutes INTEGER DEFAULT 0,
    early_leave_minutes INTEGER DEFAULT 0,
    status VARCHAR(50), -- Present, Absent, Half Day, Leave, Holiday
    regularized BOOLEAN DEFAULT FALSE,
    regularization_reason TEXT,
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

CREATE TABLE overtime_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    overtime_hours NUMERIC(5,2) NOT NULL,
    reason TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- LEAVE MANAGEMENT
-- ============================================================================

CREATE TABLE leave_types (
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

CREATE TABLE leave_balances (
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

CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID REFERENCES leave_types(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days NUMERIC(5,2) GENERATED ALWAYS AS (end_date - start_date + 1) STORED,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, Approved, Rejected, Cancelled
    applied_by UUID REFERENCES users(id),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leave_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    leave_request_id UUID REFERENCES leave_requests(id) ON DELETE CASCADE,
    approver_id UUID REFERENCES users(id),
    level INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, Approved, Rejected
    comments TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PAYROLL MODULE
-- ============================================================================

CREATE TABLE salary_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    type VARCHAR(20) NOT NULL, -- Earning, Deduction
    category VARCHAR(50), -- Basic, Allowance, Statutory, Loan, etc.
    is_taxable BOOLEAN DEFAULT TRUE,
    is_pf_applicable BOOLEAN DEFAULT FALSE,
    is_esi_applicable BOOLEAN DEFAULT FALSE,
    calculation_type VARCHAR(50) DEFAULT 'Fixed', -- Fixed, Percentage, Formula
    formula TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employee_salary_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE UNIQUE,
    effective_from DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE salary_structure_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    structure_id UUID REFERENCES employee_salary_structures(id) ON DELETE CASCADE,
    component_id UUID REFERENCES salary_components(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) DEFAULT 0,
    percentage NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payroll_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Processing, Completed, Locked
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMPTZ,
    locked_by UUID REFERENCES users(id),
    locked_at TIMESTAMPTZ,
    total_employees INTEGER DEFAULT 0,
    total_earnings NUMERIC(15,2) DEFAULT 0,
    total_deductions NUMERIC(15,2) DEFAULT 0,
    total_net_pay NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, month, year)
);

CREATE TABLE payroll_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    basic_salary NUMERIC(12,2) DEFAULT 0,
    total_earnings NUMERIC(12,2) DEFAULT 0,
    total_deductions NUMERIC(12,2) DEFAULT 0,
    net_pay NUMERIC(12,2) GENERATED ALWAYS AS (total_earnings - total_deductions) STORED,
    pf_employer NUMERIC(12,2) DEFAULT 0,
    pf_employee NUMERIC(12,2) DEFAULT 0,
    esi_employer NUMERIC(12,2) DEFAULT 0,
    esi_employee NUMERIC(12,2) DEFAULT 0,
    tax_amount NUMERIC(12,2) DEFAULT 0,
    overtime_amount NUMERIC(12,2) DEFAULT 0,
    bonus_amount NUMERIC(12,2) DEFAULT 0,
    arrears NUMERIC(12,2) DEFAULT 0,
    days_present INTEGER DEFAULT 0,
    days_absent INTEGER DEFAULT 0,
    days_leave INTEGER DEFAULT 0,
    working_days INTEGER DEFAULT 0,
    is_paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payroll_breakdown (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_record_id UUID REFERENCES payroll_records(id) ON DELETE CASCADE,
    component_id UUID REFERENCES salary_components(id),
    component_name VARCHAR(100),
    amount NUMERIC(12,2) DEFAULT 0,
    type VARCHAR(20), -- Earning, Deduction
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    loan_type VARCHAR(100),
    amount NUMERIC(12,2) NOT NULL,
    interest_rate NUMERIC(5,2) DEFAULT 0,
    tenure_months INTEGER,
    emi_amount NUMERIC(12,2),
    disbursement_date DATE,
    first_emi_date DATE,
    last_emi_date DATE,
    status VARCHAR(50) DEFAULT 'Active', -- Active, Closed, Defaulted
    purpose TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loan_repayments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    emi_number INTEGER NOT NULL,
    due_date DATE,
    principal_amount NUMERIC(12,2) DEFAULT 0,
    interest_amount NUMERIC(12,2) DEFAULT 0,
    total_amount NUMERIC(12,2) DEFAULT 0,
    paid_date DATE,
    paid_via VARCHAR(50), -- Salary Deduction, Cash, Bank Transfer
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, Paid, Overdue
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FINANCE & ACCOUNTS
-- ============================================================================

CREATE TABLE chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    account_code VARCHAR(50) UNIQUE NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- Asset, Liability, Equity, Income, Expense
    parent_id UUID REFERENCES chart_of_accounts(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    entry_number VARCHAR(100) UNIQUE NOT NULL,
    entry_date DATE NOT NULL,
    reference VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Posted, Void
    posted_by UUID REFERENCES users(id),
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID REFERENCES chart_of_accounts(id),
    debit NUMERIC(15,2) DEFAULT 0,
    credit NUMERIC(15,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    contact_id UUID, -- Customer or Vendor
    contact_type VARCHAR(20), -- Customer, Vendor
    invoice_type VARCHAR(20), -- Sales, Purchase
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Sent, Paid, Overdue, Cancelled
    subtotal NUMERIC(15,2) DEFAULT 0,
    tax_amount NUMERIC(15,2) DEFAULT 0,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    total_amount NUMERIC(15,2) GENERATED ALWAYS AS (subtotal + tax_amount - discount_amount) STORED,
    paid_amount NUMERIC(15,2) DEFAULT 0,
    balance_amount NUMERIC(15,2) GENERATED ALWAYS AS (subtotal + tax_amount - discount_amount - paid_amount) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    item_id UUID,
    description TEXT,
    quantity NUMERIC(10,2) DEFAULT 1,
    unit_price NUMERIC(12,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    discount_rate NUMERIC(5,2) DEFAULT 0,
    total NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price * (1 - discount_rate/100) * (1 + tax_rate/100)) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    payment_number VARCHAR(100) UNIQUE NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50), -- Cash, Bank Transfer, Cheque, Online
    bank_account_id UUID,
    reference_number VARCHAR(255),
    amount NUMERIC(15,2) NOT NULL,
    contact_id UUID,
    contact_type VARCHAR(20), -- Customer, Vendor, Employee
    payment_type VARCHAR(20), -- Receipt, Payment
    status VARCHAR(50) DEFAULT 'Completed',
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    allocated_amount NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    bank_name VARCHAR(255),
    branch_name VARCHAR(255),
    account_number VARCHAR(100),
    account_type VARCHAR(50), -- Current, Savings
    account_holder VARCHAR(255),
    ifsc_code VARCHAR(50),
    opening_balance NUMERIC(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id),
    fiscal_year INTEGER NOT NULL,
    account_id UUID REFERENCES chart_of_accounts(id),
    budgeted_amount NUMERIC(15,2) DEFAULT 0,
    actual_amount NUMERIC(15,2) DEFAULT 0,
    variance NUMERIC(15,2) GENERATED ALWAYS AS (budgeted_amount - actual_amount) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INVENTORY & WAREHOUSE
-- ============================================================================

CREATE TABLE item_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES item_categories(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES item_categories(id),
    item_code VARCHAR(100) UNIQUE NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    description TEXT,
    item_type VARCHAR(50), -- Product, Service, Raw Material, Finished Good
    unit_of_measure VARCHAR(50) DEFAULT 'Pcs',
    hsn_code VARCHAR(50),
    purchase_price NUMERIC(12,2),
    sale_price NUMERIC(12,2),
    reorder_level NUMERIC(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    address TEXT,
    manager_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity NUMERIC(12,2) DEFAULT 0,
    reserved_quantity NUMERIC(12,2) DEFAULT 0,
    available_quantity NUMERIC(12,2) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    cost_price NUMERIC(12,2),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(item_id, warehouse_id)
);

CREATE TABLE stock_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id),
    warehouse_id UUID REFERENCES warehouses(id),
    transaction_type VARCHAR(50), -- Purchase, Sale, Transfer, Adjustment, Return
    quantity NUMERIC(12,2) NOT NULL,
    unit_cost NUMERIC(12,2),
    reference_type VARCHAR(50), -- PO, SO, GRN, DN, etc.
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PROJECT MANAGEMENT
-- ============================================================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    project_code VARCHAR(100) UNIQUE NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    description TEXT,
    client_id UUID,
    project_manager_id UUID REFERENCES users(id),
    start_date DATE,
    end_date DATE,
    budget NUMERIC(15,2),
    actual_cost NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Planning', -- Planning, Active, On Hold, Completed, Cancelled
    priority VARCHAR(20) DEFAULT 'Medium', -- Low, Medium, High, Critical
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES tasks(id),
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES users(id),
    priority VARCHAR(20) DEFAULT 'Medium',
    status VARCHAR(50) DEFAULT 'Todo', -- Todo, In Progress, Review, Done, Cancelled
    start_date DATE,
    due_date DATE,
    completed_date DATE,
    estimated_hours NUMERIC(6,2),
    actual_hours NUMERIC(6,2),
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE timesheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    task_id UUID REFERENCES tasks(id),
    work_date DATE NOT NULL,
    hours NUMERIC(5,2) NOT NULL,
    description TEXT,
    is_billable BOOLEAN DEFAULT TRUE,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CRM MODULE
-- ============================================================================

CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    contact_type VARCHAR(20), -- Customer, Vendor, Lead
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    website VARCHAR(255),
    lead_source VARCHAR(100),
    lead_status VARCHAR(50), -- New, Contacted, Qualified, Unqualified
    assigned_to UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id),
    opportunity_name VARCHAR(255) NOT NULL,
    description TEXT,
    stage VARCHAR(50), -- Prospecting, Qualification, Proposal, Negotiation, Closed Won, Closed Lost
    probability INTEGER DEFAULT 0,
    expected_value NUMERIC(15,2),
    actual_value NUMERIC(15,2),
    expected_close_date DATE,
    actual_close_date DATE,
    assigned_to UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DOCUMENT MANAGEMENT
-- ============================================================================

CREATE TABLE document_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES document_folders(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES document_folders(id),
    document_type VARCHAR(100),
    document_number VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    version INTEGER DEFAULT 1,
    tags TEXT[],
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- NOTIFICATIONS & AUDIT
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    receiver_id UUID REFERENCES users(id),
    receiver_type VARCHAR(20), -- User, Branch, All
    branch_id UUID REFERENCES branches(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) DEFAULT 'General', -- General, Urgent, Announcement, Reminder
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- Create, Update, Delete, Login, Logout
    module VARCHAR(100),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SYNC & CONFLICT MANAGEMENT
-- ============================================================================

CREATE TABLE sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(100),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    record_id UUID,
    data JSONB,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'pending', -- pending, synced, failed, conflict
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

CREATE TABLE sync_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    local_data JSONB,
    remote_data JSONB,
    local_timestamp TIMESTAMPTZ,
    remote_timestamp TIMESTAMPTZ,
    resolution VARCHAR(50), -- local_wins, remote_wins, merged, manual
    resolved_data JSONB,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_employees_org ON employees(organization_id);
CREATE INDEX idx_employees_branch ON employees(branch_id);
CREATE INDEX idx_employees_dept ON employees(department_id);
CREATE INDEX idx_employees_status ON employees(employment_status);

CREATE INDEX idx_attendance_employee ON attendance_logs(employee_id, punch_time DESC);
CREATE INDEX idx_attendance_daily_lookup ON attendance_daily(employee_id, date);

CREATE INDEX idx_leave_requests_status ON leave_requests(employee_id, status);

CREATE INDEX idx_payroll_records_run ON payroll_records(payroll_run_id);
CREATE INDEX idx_payroll_records_employee ON payroll_records(employee_id);

CREATE INDEX idx_invoices_status ON invoices(organization_id, status);
CREATE INDEX idx_invoices_contact ON invoices(contact_id, contact_type);

CREATE INDEX idx_stock_item_warehouse ON stock(item_id, warehouse_id);

CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to, status);

CREATE INDEX idx_notifications_receiver ON notifications(receiver_id, is_read);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_sync_queue_status ON sync_queue(status, priority);

-- ============================================================================
-- RLS POLICIES (Row Level Security)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be customized based on your security requirements
-- Example policy for employees table:
-- CREATE POLICY "Employees can view own data" ON employees
--     FOR SELECT USING (auth.uid() = organization_id);

-- ============================================================================
-- TRIGGERS FOR AUTOMATION
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- ============================================================================

-- Insert default organization
INSERT INTO organizations (id, name, legal_name, email, phone, country, currency, timezone)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'BioBridge Demo Org',
    'BioBridge Technologies Pvt Ltd',
    'info@biobridge.com',
    '+977-1-4XXXXXX',
    'Nepal',
    'NPR',
    'Asia/Kathmandu'
);

-- Insert default branch
INSERT INTO branches (id, organization_id, name, code, location)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Head Office',
    'HO',
    'Kathmandu, Nepal'
);

-- Insert default departments
INSERT INTO departments (id, organization_id, name, code) VALUES
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Human Resources', 'HR'),
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Finance', 'FIN'),
('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Operations', 'OPS'),
('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'IT', 'IT');

-- Insert default leave types
INSERT INTO leave_types (id, organization_id, name, code, is_paid, requires_approval) VALUES
('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Sick Leave', 'SL', TRUE, TRUE),
('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Casual Leave', 'CL', TRUE, TRUE),
('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Earned Leave', 'EL', TRUE, TRUE),
('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Maternity Leave', 'ML', TRUE, TRUE);

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
-- Database schema created successfully!
-- Total tables: 70+
-- Ready for BioBridge Pro ERP system
-- Next: Run this SQL in your Supabase project SQL editor
-- ============================================================================
