-- ============================================================================
-- BioBridge Pro ERP - Sample Employee Hierarchy Data
-- Run this in Supabase SQL Editor
-- ============================================================================

-- १. First, create some sample employees with hierarchy
-- This creates a realistic organizational structure

-- CEO (Top level - no reporting manager)
INSERT INTO employees (
    organization_id,
    employee_code,
    first_name,
    middle_name,
    last_name,
    personal_email,
    personal_phone,
    branch_id,
    department_id,
    designation_id,
    employment_type,
    employment_status,
    date_of_joining,
    reporting_manager_id, -- NULL for CEO (top of hierarchy)
    is_active
)
SELECT 
    o.id,
    'EMP001',
    'Ramesh',
    '',
    'Shrestha',
    'ramesh.shrestha@biobridge.com',
    '9841000001',
    b.id,
    d.id, -- Will update department later
    des.id,
    'Full-time',
    'Active',
    '2075-01-01',
    NULL, -- CEO has no manager
    true
FROM organizations o
CROSS JOIN branches b
CROSS JOIN (SELECT id FROM departments WHERE code = 'ADMIN' LIMIT 1) d
CROSS JOIN (SELECT id FROM designations WHERE code = 'CEO' LIMIT 1) des
WHERE o.name = 'BioBridge ERP'
AND b.name = 'Head Office'
ON CONFLICT (employee_code) DO NOTHING;

-- HR Manager (Reports to CEO)
INSERT INTO employees (
    organization_id,
    employee_code,
    first_name,
    middle_name,
    last_name,
    personal_email,
    personal_phone,
    branch_id,
    department_id,
    designation_id,
    employment_type,
    employment_status,
    date_of_joining,
    reporting_manager_id,
    is_active
)
SELECT 
    o.id,
    'EMP002',
    'Sita',
    '',
    'Karki',
    'sita.karki@biobridge.com',
    '9841000002',
    b.id,
    (SELECT id FROM departments WHERE code = 'HR' LIMIT 1),
    (SELECT id FROM designations WHERE code = 'MGR' LIMIT 1),
    'Full-time',
    'Active',
    '2076-04-15',
    (SELECT id FROM employees WHERE employee_code = 'EMP001'), -- Reports to CEO
    true
FROM organizations o
CROSS JOIN branches b
WHERE o.name = 'BioBridge ERP'
AND b.name = 'Head Office'
ON CONFLICT (employee_code) DO NOTHING;

-- Finance Manager (Reports to CEO)
INSERT INTO employees (
    organization_id,
    employee_code,
    first_name,
    middle_name,
    last_name,
    personal_email,
    personal_phone,
    branch_id,
    department_id,
    designation_id,
    employment_type,
    employment_status,
    date_of_joining,
    reporting_manager_id,
    is_active
)
SELECT 
    o.id,
    'EMP003',
    'Hari',
    '',
    'Gurung',
    'hari.gurung@biobridge.com',
    '9841000003',
    b.id,
    (SELECT id FROM departments WHERE code = 'FINANCE' LIMIT 1),
    (SELECT id FROM designations WHERE code = 'MGR' LIMIT 1),
    'Full-time',
    'Active',
    '2076-05-01',
    (SELECT id FROM employees WHERE employee_code = 'EMP001'), -- Reports to CEO
    true
FROM organizations o
CROSS JOIN branches b
WHERE o.name = 'BioBridge ERP'
AND b.name = 'Head Office'
ON CONFLICT (employee_code) DO NOTHING;

-- IT Manager (Reports to CEO)
INSERT INTO employees (
    organization_id,
    employee_code,
    first_name,
    middle_name,
    last_name,
    personal_email,
    personal_phone,
    branch_id,
    department_id,
    designation_id,
    employment_type,
    employment_status,
    date_of_joining,
    reporting_manager_id,
    is_active
)
SELECT 
    o.id,
    'EMP004',
    'Binod',
    '',
    'Rai',
    'binod.rai@biobridge.com',
    '9841000004',
    b.id,
    (SELECT id FROM departments WHERE code = 'IT' LIMIT 1),
    (SELECT id FROM designations WHERE code = 'MGR' LIMIT 1),
    'Full-time',
    'Active',
    '2076-06-10',
    (SELECT id FROM employees WHERE employee_code = 'EMP001'), -- Reports to CEO
    true
FROM organizations o
CROSS JOIN branches b
WHERE o.name = 'BioBridge ERP'
AND b.name = 'Head Office'
ON CONFLICT (employee_code) DO NOTHING;

-- HR Supervisor (Reports to HR Manager)
INSERT INTO employees (
    organization_id,
    employee_code,
    first_name,
    middle_name,
    last_name,
    personal_email,
    personal_phone,
    branch_id,
    department_id,
    designation_id,
    employment_type,
    employment_status,
    date_of_joining,
    reporting_manager_id,
    is_active
)
SELECT 
    o.id,
    'EMP005',
    'Anita',
    '',
    'Maharjan',
    'anita.maharjan@biobridge.com',
    '9841000005',
    b.id,
    (SELECT id FROM departments WHERE code = 'HR' LIMIT 1),
    (SELECT id FROM designations WHERE code = 'SUP' LIMIT 1),
    'Full-time',
    'Active',
    '2077-01-15',
    (SELECT id FROM employees WHERE employee_code = 'EMP002'), -- Reports to HR Manager
    true
FROM organizations o
CROSS JOIN branches b
WHERE o.name = 'BioBridge ERP'
AND b.name = 'Head Office'
ON CONFLICT (employee_code) DO NOTHING;

-- Finance Supervisor (Reports to Finance Manager)
INSERT INTO employees (
    organization_id,
    employee_code,
    first_name,
    middle_name,
    last_name,
    personal_email,
    personal_phone,
    branch_id,
    department_id,
    designation_id,
    employment_type,
    employment_status,
    date_of_joining,
    reporting_manager_id,
    is_active
)
SELECT 
    o.id,
    'EMP006',
    'Rajesh',
    '',
    'Thapa',
    'rajesh.thapa@biobridge.com',
    '9841000006',
    b.id,
    (SELECT id FROM departments WHERE code = 'FINANCE' LIMIT 1),
    (SELECT id FROM designations WHERE code = 'SUP' LIMIT 1),
    'Full-time',
    'Active',
    '2077-02-20',
    (SELECT id FROM employees WHERE employee_code = 'EMP003'), -- Reports to Finance Manager
    true
FROM organizations o
CROSS JOIN branches b
WHERE o.name = 'BioBridge ERP'
AND b.name = 'Head Office'
ON CONFLICT (employee_code) DO NOTHING;

-- IT Supervisor (Reports to IT Manager)
INSERT INTO employees (
    organization_id,
    employee_code,
    first_name,
    middle_name,
    last_name,
    personal_email,
    personal_phone,
    branch_id,
    department_id,
    designation_id,
    employment_type,
    employment_status,
    date_of_joining,
    reporting_manager_id,
    is_active
)
SELECT 
    o.id,
    'EMP007',
    'Deepak',
    '',
    'Poudel',
    'deepak.poudel@biobridge.com',
    '9841000007',
    b.id,
    (SELECT id FROM departments WHERE code = 'IT' LIMIT 1),
    (SELECT id FROM designations WHERE code = 'SUP' LIMIT 1),
    'Full-time',
    'Active',
    '2077-03-10',
    (SELECT id FROM employees WHERE employee_code = 'EMP004'), -- Reports to IT Manager
    true
FROM organizations o
CROSS JOIN branches b
WHERE o.name = 'BioBridge ERP'
AND b.name = 'Head Office'
ON CONFLICT (employee_code) DO NOTHING;

-- HR Executive (Reports to HR Supervisor)
INSERT INTO employees (
    organization_id,
    employee_code,
    first_name,
    middle_name,
    last_name,
    personal_email,
    personal_phone,
    branch_id,
    department_id,
    designation_id,
    employment_type,
    employment_status,
    date_of_joining,
    reporting_manager_id,
    is_active
)
SELECT 
    o.id,
    'EMP008',
    'Sneha',
    '',
    'Tamang',
    'sneha.tamang@biobridge.com',
    '9841000008',
    b.id,
    (SELECT id FROM departments WHERE code = 'HR' LIMIT 1),
    (SELECT id FROM designations WHERE code = 'EXE' LIMIT 1),
    'Full-time',
    'Active',
    '2078-01-05',
    (SELECT id FROM employees WHERE employee_code = 'EMP005'), -- Reports to HR Supervisor
    true
FROM organizations o
CROSS JOIN branches b
WHERE o.name = 'BioBridge ERP'
AND b.name = 'Head Office'
ON CONFLICT (employee_code) DO NOTHING;

-- IT Developer 1 (Reports to IT Supervisor)
INSERT INTO employees (
    organization_id,
    employee_code,
    first_name,
    middle_name,
    last_name,
    personal_email,
    personal_phone,
    branch_id,
    department_id,
    designation_id,
    employment_type,
    employment_status,
    date_of_joining,
    reporting_manager_id,
    is_active
)
SELECT 
    o.id,
    'EMP009',
    'Rohit',
    '',
    'Joshi',
    'rohit.joshi@biobridge.com',
    '9841000009',
    b.id,
    (SELECT id FROM departments WHERE code = 'IT' LIMIT 1),
    (SELECT id FROM designations WHERE code = 'SR_EXE' LIMIT 1),
    'Full-time',
    'Active',
    '2078-04-12',
    (SELECT id FROM employees WHERE employee_code = 'EMP007'), -- Reports to IT Supervisor
    true
FROM organizations o
CROSS JOIN branches b
WHERE o.name = 'BioBridge ERP'
AND b.name = 'Head Office'
ON CONFLICT (employee_code) DO NOTHING;

-- IT Developer 2 (Reports to IT Supervisor)
INSERT INTO employees (
    organization_id,
    employee_code,
    first_name,
    middle_name,
    last_name,
    personal_email,
    personal_phone,
    branch_id,
    department_id,
    designation_id,
    employment_type,
    employment_status,
    date_of_joining,
    reporting_manager_id,
    is_active
)
SELECT 
    o.id,
    'EMP010',
    'Priya',
    '',
    'Sharma',
    'priya.sharma@biobridge.com',
    '9841000010',
    b.id,
    (SELECT id FROM departments WHERE code = 'IT' LIMIT 1),
    (SELECT id FROM designations WHERE code = 'SR_EXE' LIMIT 1),
    'Full-time',
    'Active',
    '2078-05-20',
    (SELECT id FROM employees WHERE employee_code = 'EMP007'), -- Reports to IT Supervisor
    true
FROM organizations o
CROSS JOIN branches b
WHERE o.name = 'BioBridge ERP'
AND b.name = 'Head Office'
ON CONFLICT (employee_code) DO NOTHING;

-- Finance Executive (Reports to Finance Supervisor)
INSERT INTO employees (
    organization_id,
    employee_code,
    first_name,
    middle_name,
    last_name,
    personal_email,
    personal_phone,
    branch_id,
    department_id,
    designation_id,
    employment_type,
    employment_status,
    date_of_joining,
    reporting_manager_id,
    is_active
)
SELECT 
    o.id,
    'EMP011',
    'Kiran',
    '',
    'Lama',
    'kiran.lama@biobridge.com',
    '9841000011',
    b.id,
    (SELECT id FROM departments WHERE code = 'FINANCE' LIMIT 1),
    (SELECT id FROM designations WHERE code = 'EXE' LIMIT 1),
    'Full-time',
    'Active',
    '2078-06-15',
    (SELECT id FROM employees WHERE employee_code = 'EMP006'), -- Reports to Finance Supervisor
    true
FROM organizations o
CROSS JOIN branches b
WHERE o.name = 'BioBridge ERP'
AND b.name = 'Head Office'
ON CONFLICT (employee_code) DO NOTHING;

-- Intern (Reports to HR Executive)
INSERT INTO employees (
    organization_id,
    employee_code,
    first_name,
    middle_name,
    last_name,
    personal_email,
    personal_phone,
    branch_id,
    department_id,
    designation_id,
    employment_type,
    employment_status,
    date_of_joining,
    reporting_manager_id,
    is_active
)
SELECT 
    o.id,
    'EMP012',
    'Sabin',
    '',
    'Bhattarai',
    'sabin.bhattarai@biobridge.com',
    '9841000012',
    b.id,
    (SELECT id FROM departments WHERE code = 'HR' LIMIT 1),
    (SELECT id FROM designations WHERE code = 'INTERN' LIMIT 1),
    'Contract',
    'Active',
    '2079-09-01',
    (SELECT id FROM employees WHERE employee_code = 'EMP008'), -- Reports to HR Executive
    true
FROM organizations o
CROSS JOIN branches b
WHERE o.name = 'BioBridge ERP'
AND b.name = 'Head Office'
ON CONFLICT (employee_code) DO NOTHING;

-- ============================================================================
-- VERIFICATION - Show the hierarchy
-- ============================================================================

-- Show all employees with their reporting structure
SELECT 
    e.employee_code,
    e.full_name,
    d.name as department,
    des.name as designation,
    mgr.full_name as reports_to,
    e.employment_status,
    e.date_of_joining
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id
ORDER BY e.employee_code;

-- Show hierarchy as tree structure
WITH RECURSIVE org_tree AS (
    -- Top level (CEO - no manager)
    SELECT 
        id,
        employee_code,
        full_name,
        department_id,
        designation_id,
        reporting_manager_id,
        1 as level,
        full_name as path
    FROM employees
    WHERE reporting_manager_id IS NULL
    
    UNION ALL
    
    -- Subordinates
    SELECT 
        e.id,
        e.employee_code,
        e.full_name,
        e.department_id,
        e.designation_id,
        e.reporting_manager_id,
        t.level + 1,
        t.path || ' > ' || e.full_name
    FROM employees e
    INNER JOIN org_tree t ON e.reporting_manager_id = t.id
)
SELECT 
    REPEAT('  ', level - 1) || '└─ ' || full_name as hierarchy,
    employee_code,
    level
FROM org_tree
ORDER BY path;
