-- ============================================
-- BioBridge Pro HR - COMPLETE DATABASE SEED
-- Run this ENTIRE script in Supabase SQL Editor
-- All tables seeded in correct dependency order
-- ============================================

-- Step 1: Disable RLS temporarily for seeding
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.gates DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.designations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- Step 2: Create Branches (needed by employees)
INSERT INTO public.branches (name, location, phone, email, is_active) VALUES
('Head Office', 'Kamaladi, Kathmandu', '01-4444444', 'headoffice@biobridge.com', true),
('Kathmandu Branch', 'Dillibazar, Kathmandu', '01-4555555', 'ktm@biobridge.com', true),
('Lalitpur Branch', 'Kupandol, Lalitpur', '01-5555555', 'ltp@biobridge.com', true),
('Bhaktapur Branch', 'Bhaktapur Durbar Square', '01-6666666', 'bhaktapur@biobridge.com', true),
('Pokhara Branch', 'Lakeside, Pokhara', '061-444444', 'pokhara@biobridge.com', true)
ON CONFLICT DO NOTHING;

-- Step 3: Create Departments
INSERT INTO public.departments (name, code, description, is_active) VALUES
('Human Resources', 'HR', 'Human Resources Department', true),
('Information Technology', 'IT', 'IT Department', true),
('Finance & Accounts', 'FIN', 'Finance Department', true),
('Operations', 'OPS', 'Operations Department', true),
('Sales & Marketing', 'SM', 'Sales Department', true)
ON CONFLICT DO NOTHING;

-- Step 4: Create Designations
INSERT INTO public.designations (name, code, level, grade, description, is_active) VALUES
('Manager', 'MGR', 3, 'M3', 'Department Manager', true),
('Senior Developer', 'SDEV', 2, 'T2', 'Senior Software Developer', true),
('HR Executive', 'HRE', 1, 'A1', 'HR Executive', true),
('Accountant', 'ACC', 1, 'A1', 'Finance Accountant', true),
('Operator', 'OPR', 0, 'L1', 'Device Operator', true)
ON CONFLICT DO NOTHING;

-- Step 5: Seed Employees (with ALL CSV columns)
INSERT INTO public.employees (employee_code, first_name, middle_name, last_name, personal_email, personal_phone, employment_status, date_of_joining, gender, citizenship_number, pan_number, bank_name, account_number) VALUES
('EMP-001', 'Rajesh', 'Kumar', 'Sharma', 'rajesh@biobridge.com', '9841000001', 'Active', '2024-01-15', 'Male', '12345678901', 'PAN001', 'Nabil Bank', 'ACC001'),
('EMP-002', 'Sita', 'Devi', 'Magar', 'sita@biobridge.com', '9841000002', 'Active', '2024-03-20', 'Female', '12345678902', 'PAN002', 'Global IME Bank', 'ACC002'),
('EMP-003', 'Bikash', 'Bahadur', 'Thapa', 'bikash@biobridge.com', '9841000003', 'Active', '2024-06-10', 'Male', '12345678903', 'PAN003', 'Everest Bank', 'ACC003'),
('EMP-004', 'Anita', 'Kumari', 'Gurung', 'anita@biobridge.com', '9841000004', 'On Leave', '2023-11-05', 'Female', '12345678904', 'PAN004', 'Standard Chartered', 'ACC004'),
('EMP-005', 'Sanjay', 'Prasad', 'Pokharel', 'sanjay@biobridge.com', '9841000005', 'Active', '2024-08-01', 'Male', '12345678905', 'PAN005', 'NIC Asia Bank', 'ACC005'),
('EMP-006', 'Priya', 'Shrestha', 'Joshi', 'priya@biobridge.com', '9841000006', 'Active', '2024-02-14', 'Female', '12345678906', 'PAN006', 'Bank of Kathmandu', 'ACC006'),
('EMP-007', 'Ramesh', 'Bahadur', 'KC', 'ramesh@biobridge.com', '9841000007', 'Active', '2023-09-01', 'Male', '12345678907', 'PAN007', 'NMB Bank', 'ACC007'),
('EMP-008', 'Sunita', 'Maya', 'Sharma', 'sunita@biobridge.com', '9841000008', 'Active', '2024-04-18', 'Female', '12345678908', 'PAN008', 'Himalayan Bank', 'ACC008'),
('EMP-009', 'Deepak', 'Kumar', 'Rai', 'deepak@biobridge.com', '9841000009', 'Active', '2024-07-22', 'Male', '12345678909', 'PAN009', 'Siddhartha Bank', 'ACC009'),
('EMP-010', 'Meena', 'Kumari', 'Limbu', 'meena@biobridge.com', '9841000010', 'Inactive', '2023-05-10', 'Female', '12345678910', 'PAN010', 'Laxmi Bank', 'ACC010')
ON CONFLICT (employee_code) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  personal_email = EXCLUDED.personal_email,
  personal_phone = EXCLUDED.personal_phone,
  employment_status = EXCLUDED.employment_status,
  updated_at = NOW();

-- Step 6: Seed Inventory Items (matching actual Supabase columns)
INSERT INTO public.items (item_code, item_name, unit_of_measure, sale_price) VALUES
('INV-001', 'ZKTeco SpeedFace V5L', 'Unit', 25000),
('INV-002', 'Hikvision DS-K1T804MF', 'Unit', 18000),
('INV-003', 'Cat6 Network Cable 100m', 'Roll', 3500),
('INV-004', 'Biometric Cards 100 Pack', 'Pack', 5000),
('INV-005', 'UPS 1KVA APC', 'Unit', 12000),
('INV-006', 'Cisco Switch 2960 24-Port', 'Unit', 35000),
('INV-007', 'Dell Monitor 24 inch', 'Unit', 22000),
('INV-008', 'HP LaserJet Printer', 'Unit', 45000),
('INV-009', 'Network Rack 42U', 'Unit', 15000),
('INV-010', 'Fingerprint Scanner ZKTeco', 'Unit', 8000)
ON CONFLICT (item_code) DO UPDATE SET
  item_name = EXCLUDED.item_name,
  sale_price = EXCLUDED.sale_price,
  updated_at = NOW();

-- Step 7: Seed Projects
INSERT INTO public.projects (name, description, status, start_date, end_date, budget) VALUES
('Kathmandu Office Deployment', 'Install 25 attendance devices across all floors', 'In Progress', '2026-01-15', '2026-04-30', 1500000),
('HRMS Integration Project', 'Integrate biometric data with payroll system', 'Planning', '2026-05-01', '2026-08-31', 800000),
('Cloud Migration', 'Migrate all device logs to Supabase cloud', 'Completed', '2025-11-01', '2026-02-28', 500000),
('Mobile App Development', 'Employee self-service mobile application', 'In Progress', '2026-03-01', '2026-09-30', 2000000),
('Security Upgrade', 'Upgrade all devices to latest firmware', 'On Hold', '2026-06-01', '2026-07-31', 300000)
ON CONFLICT DO NOTHING;

-- Step 8: Seed CRM Leads
INSERT INTO public.leads (name, company, email, phone, status, source, value) VALUES
('ABC Manufacturing Pvt Ltd', 'ABC Manufacturing', 'ram@abc.com', '9841111111', 'New', 'Website', 500000),
('XYZ Construction', 'XYZ Corp', 'sita@xyz.com', '9841222222', 'Contacted', 'Referral', 750000),
('Global Tech Solutions', 'Global Tech', 'hari@global.com', '9841333333', 'Qualified', 'LinkedIn', 1200000),
('Mountain View Hospital', 'MV Hospital', 'admin@mv.com', '9841444444', 'Proposal', 'Direct', 350000),
('Nepal Education Board', 'NEB', 'info@neb.gov.np', '9841555555', 'Negotiation', 'Government Tender', 2000000)
ON CONFLICT DO NOTHING;

-- Step 9: Seed Leave Requests (linked to employees by employee_id - using IDs from step 5)
INSERT INTO public.leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
SELECT id, 'Annual Leave', '2026-04-15', '2026-04-17', 'Family function', 'Approved' FROM employees WHERE employee_code = 'EMP-001'
UNION ALL
SELECT id, 'Sick Leave', '2026-04-20', '2026-04-21', 'Medical appointment', 'Pending' FROM employees WHERE employee_code = 'EMP-002'
UNION ALL
SELECT id, 'Casual Leave', '2026-05-01', '2026-05-01', 'Personal work', 'Pending' FROM employees WHERE employee_code = 'EMP-003'
UNION ALL
SELECT id, 'Maternity Leave', '2026-06-01', '2026-09-30', 'Maternity', 'Approved' FROM employees WHERE employee_code = 'EMP-004'
UNION ALL
SELECT id, 'Annual Leave', '2026-07-10', '2026-07-15', 'Summer vacation', 'Pending' FROM employees WHERE employee_code = 'EMP-005'
ON CONFLICT DO NOTHING;

-- Step 10: Seed Assets
INSERT INTO public.assets (name, description, status, purchase_date, purchase_cost, location) VALUES
('Dell Latitude 5520', 'Laptop for HR department', 'In Use', '2024-01-15', 120000, 'HR Office'),
('HP LaserJet Pro', 'Network printer for office', 'Available', '2023-06-01', 45000, 'Warehouse'),
('ZKTeco SpeedFace', 'Face recognition attendance device', 'In Use', '2024-03-01', 25000, 'Main Gate'),
('Cisco Switch 2960', '24-port network switch', 'In Use', '2023-09-15', 35000, 'Server Room'),
('APC UPS 3KVA', 'Uninterruptible power supply', 'In Use', '2023-11-01', 28000, 'Server Room')
ON CONFLICT DO NOTHING;

-- Step 11: Seed Attendance Logs (sample data for last 30 days)
INSERT INTO public.attendance_logs (employee_id, timestamp, log_type, punch_method, is_synced)
SELECT e.id, 
       (CURRENT_DATE - (random() * 30)::int) + (random() * 1440 * INTERVAL '1 minute') - INTERVAL '8 hours',
       CASE WHEN random() < 0.5 THEN 'in' ELSE 'out' END,
       'device',
       true
FROM employees e, generate_series(1, 50)
WHERE e.employment_status = 'Active'
ON CONFLICT DO NOTHING;

-- Step 12: Seed Notifications
INSERT INTO public.notifications (sender_id, sender_name, receiver_id, receiver_type, branch_id, title, message, notification_type, is_read, created_at) VALUES
(NULL, 'System', NULL, 'ALL', NULL, 'Welcome to BioBridge Pro HR', 'Your system has been successfully set up with sample data.', 'ANNOUNCEMENT', false, NOW()),
(NULL, 'System', NULL, 'ALL', NULL, 'New Feature: Realtime Sync', 'Cloud sync is now enabled. All changes are automatically backed up.', 'ANNOUNCEMENT', false, NOW()),
(NULL, 'HR Admin', NULL, 'ALL', NULL, 'Payroll Processing', 'Monthly payroll for March 2026 is ready for review.', 'URGENT', false, NOW()),
(NULL, 'System', NULL, 'ALL', NULL, 'Device Maintenance', 'Scheduled maintenance for all devices on April 15, 2026.', 'REMINDER', false, NOW()),
(NULL, 'IT Admin', NULL, 'ALL', NULL, 'System Update', 'Software version 2.5.0 has been deployed successfully.', 'GENERAL', false, NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION: Show counts
-- ============================================
SELECT 'EMPLOYEES' as table_name, COUNT(*) as record_count FROM public.employees
UNION ALL
SELECT 'ITEMS', COUNT(*) FROM public.items
UNION ALL
SELECT 'PROJECTS', COUNT(*) FROM public.projects
UNION ALL
SELECT 'LEADS', COUNT(*) FROM public.leads
UNION ALL
SELECT 'LEAVE_REQUESTS', COUNT(*) FROM public.leave_requests
UNION ALL
SELECT 'ASSETS', COUNT(*) FROM public.assets
UNION ALL
SELECT 'BRANCHES', COUNT(*) FROM public.branches
UNION ALL
SELECT 'DEPARTMENTS', COUNT(*) FROM public.departments
UNION ALL
SELECT 'ATTENDANCE_LOGS', COUNT(*) FROM public.attendance_logs
UNION ALL
SELECT 'NOTIFICATIONS', COUNT(*) FROM public.notifications
ORDER BY table_name;

-- ============================================
-- DONE: All tables seeded successfully!
-- ============================================
