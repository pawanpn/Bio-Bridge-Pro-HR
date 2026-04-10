-- ══════════════════════════════════════════════════════════════════════════════
-- COMPREHENSIVE DEMO DATA SEEDER
-- Inserts demo data across ALL modules for testing
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. BRANCHES ──────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO Branches (id, name, location) VALUES
(1, 'Head Office', 'Kathmandu, Nepal'),
(2, 'Pokhara Branch', 'Pokhara, Nepal'),
(3, 'Biratnagar Branch', 'Biratnagar, Nepal');

-- ── 2. GATES ─────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO Gates (id, branch_id, name) VALUES
(1, 1, 'Main Entrance'),
(2, 1, 'Back Gate'),
(3, 2, 'Main Gate'),
(4, 3, 'Main Gate');

-- ── 3. DEVICES ───────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO Devices (id, name, brand, ip, port, comm_key, machine_number, branch_id, gate_id, status, is_default) VALUES
(1, 'ZKTeco Main', 'ZKTeco', '192.168.1.201', 4370, 0, 1, 1, 1, 'online', 1),
(2, 'ZKTeco Back', 'ZKTeco', '192.168.1.202', 4370, 0, 2, 1, 2, 'offline', 0),
(3, 'Hikvision Pokhara', 'Hikvision', '192.168.2.101', 8000, 0, 3, 2, 3, 'offline', 0);

-- ── 4. EMPLOYEES ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO Employees (
  id, first_name, last_name, email, phone, department, designation, 
  branch_id, device_enroll_number, base_salary, status
) VALUES
(1, 'Purushottam', 'Sharma', 'purushottam@biobridge.com', '9841000001', 'IT', 'Manager', 1, '1001', 85000, 'active'),
(2, 'Amit', 'Shah', 'amit@biobridge.com', '9841000002', 'Finance', 'Accountant', 1, '1002', 65000, 'active'),
(3, 'Binod', 'Karki', 'binod@biobridge.com', '9841000003', 'HR', 'Manager', 1, '1003', 75000, 'active'),
(4, 'Deepak', 'Chaudhary', 'deepak@biobridge.com', '9841000004', 'IT', 'Senior Developer', 1, '1004', 95000, 'active'),
(5, 'Eran', 'Khadka', 'eran@biobridge.com', '9841000005', 'Marketing', 'Executive', 2, '1005', 55000, 'active'),
(6, 'Firoz', 'Maharjan', 'firoz@biobridge.com', '9841000006', 'Sales', 'Manager', 2, '1006', 70000, 'active'),
(7, 'Ganesh', 'Bhandari', 'ganesh@biobridge.com', '9841000007', 'Operations', 'Analyst', 1, '1007', 60000, 'active'),
(8, 'Hari', 'Prasad', 'hari@biobridge.com', '9841000008', 'IT', 'Developer', 1, '1008', 70000, 'active'),
(9, 'Ishwar', 'Dahal', 'ishwar@biobridge.com', '9841000009', 'Finance', 'Analyst', 3, '1009', 65000, 'active'),
(10, 'Jiban', 'Gurung', 'jiban@biobridge.com', '9841000010', 'Admin', 'Assistant', 3, '1010', 45000, 'active'),
(11, 'Kisan', 'Rai', 'kisan@biobridge.com', '9841000011', 'IT', 'Developer', 2, '1011', 72000, 'active'),
(12, 'Laxman', 'Shrestha', 'laxman@biobridge.com', '9841000012', 'Sales', 'Executive', 3, '1012', 50000, 'active'),
(13, 'Manoj', 'Kumar', 'manoj@biobridge.com', '9841000013', 'HR', 'Executive', 1, '1013', 55000, 'active'),
(14, 'Narayan', 'Thapa', 'narayan@biobridge.com', '9841000014', 'Operations', 'Manager', 2, '1014', 80000, 'active'),
(15, 'Ojasvi', 'Pandey', 'ojasvi@biobridge.com', '9841000015', 'Marketing', 'Manager', 3, '1015', 75000, 'active');

-- ── 5. ATTENDANCE LOGS (Today + Yesterday) ───────────────────────────────────
INSERT OR IGNORE INTO AttendanceLogs (employee_id, device_id, timestamp, punch_method, is_synced) VALUES
-- Today (April 10, 2026)
(1001, 1, '2026-04-10 09:15:00', 'Fingerprint', 1),
(1002, 1, '2026-04-10 09:20:00', 'Fingerprint', 1),
(1003, 1, '2026-04-10 09:10:00', 'Fingerprint', 1),
(1004, 1, '2026-04-10 09:25:00', 'Fingerprint', 1),
(1005, 1, '2026-04-10 09:30:00', 'Fingerprint', 1),
(1006, 1, '2026-04-10 09:18:00', 'Fingerprint', 1),
(1007, 1, '2026-04-10 09:22:00', 'Fingerprint', 1),
(1008, 1, '2026-04-10 09:35:00', 'Fingerprint', 1),
(1009, 1, '2026-04-10 09:28:00', 'Fingerprint', 1),
(1010, 1, '2026-04-10 09:40:00', 'Fingerprint', 1),
(1011, 1, '2026-04-10 09:12:00', 'Fingerprint', 1),
(1012, 1, '2026-04-10 09:45:00', 'Fingerprint', 1),
(1013, 1, '2026-04-10 09:08:00', 'Fingerprint', 1),
(1014, 1, '2026-04-10 09:33:00', 'Fingerprint', 1),
(1015, 1, '2026-04-10 09:27:00', 'Fingerprint', 1),
-- Yesterday (April 9, 2026)
(1001, 1, '2026-04-09 09:10:00', 'Fingerprint', 1),
(1002, 1, '2026-04-09 09:15:00', 'Fingerprint', 1),
(1003, 1, '2026-04-09 09:05:00', 'Fingerprint', 1),
(1004, 1, '2026-04-09 09:20:00', 'Fingerprint', 1),
(1005, 1, '2026-04-09 09:25:00', 'Fingerprint', 1),
(1006, 1, '2026-04-09 09:18:00', 'Fingerprint', 1),
(1007, 1, '2026-04-09 09:22:00', 'Fingerprint', 1),
(1008, 1, '2026-04-09 09:35:00', 'Fingerprint', 1),
(1009, 1, '2026-04-09 09:28:00', 'Fingerprint', 1),
(1010, 1, '2026-04-09 09:40:00', 'Fingerprint', 1);

-- ── 6. LEAVE REQUESTS ────────────────────────────────────────────────────────
INSERT OR IGNORE INTO LeaveRequests (employee_id, leave_type, start_date, end_date, reason, status) VALUES
(1001, 'Annual', '2026-04-15', '2026-04-17', 'Family function', 'Pending'),
(1003, 'Sick', '2026-04-12', '2026-04-13', 'Medical appointment', 'Approved'),
(1005, 'Casual', '2026-04-20', '2026-04-20', 'Personal work', 'Pending'),
(1008, 'Annual', '2026-04-25', '2026-04-27', 'Vacation', 'Pending');

-- ── 7. INVENTORY ITEMS ───────────────────────────────────────────────────────
INSERT OR IGNORE INTO InventoryItems (name, category, sku, quantity, unit_price, reorder_level, status) VALUES
('Laptop Dell XPS 15', 'Electronics', 'ELEC-001', 25, 150000, 5, 'Active'),
('Office Chair Ergonomic', 'Furniture', 'FURN-001', 50, 15000, 10, 'Active'),
('A4 Paper Ream', 'Stationery', 'STAT-001', 200, 350, 50, 'Active'),
('HP Printer LaserJet', 'Electronics', 'ELEC-002', 10, 35000, 3, 'Active'),
('Whiteboard Marker Set', 'Stationery', 'STAT-002', 100, 250, 20, 'Active'),
('USB Flash Drive 32GB', 'Electronics', 'ELEC-003', 75, 800, 15, 'Active'),
('Desk Lamp LED', 'Furniture', 'FURN-002', 30, 2500, 8, 'Active');

-- ── 8. PROJECTS ──────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO Projects (name, status, priority, start_date, end_date, budget) VALUES
('BioBridge ERP v2.0', 'Active', 'High', '2026-01-15', '2026-06-30', 5000000),
('Mobile App Development', 'Active', 'Medium', '2026-02-01', '2026-08-31', 3000000),
('Infrastructure Upgrade', 'Planning', 'Low', '2026-05-01', '2026-09-30', 2000000);

-- ── 9. TASKS ─────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO Tasks (project_id, title, status, priority, assigned_to, due_date) VALUES
(1, 'Implement Attendance Module', 'In Progress', 'High', 'Deepak Chaudhary', '2026-04-20'),
(1, 'Payroll Integration', 'Todo', 'Medium', 'Amit Shah', '2026-05-15'),
(2, 'UI/UX Design', 'Completed', 'High', 'Purushottam Sharma', '2026-03-30'),
(2, 'Backend API Development', 'In Progress', 'High', 'Hari Prasad', '2026-05-01'),
(3, 'Server Procurement', 'Todo', 'Low', 'Ganesh Bhandari', '2026-05-10');

-- ── 10. CRM LEADS ────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO Leads (name, company, email, phone, status, estimated_value) VALUES
('ABC Corporation', 'ABC Corp', 'contact@abccorp.com', '01-4000001', 'New', 2500000),
('XYZ Enterprises', 'XYZ Ent', 'info@xyzent.com', '01-4000002', 'Qualified', 5000000),
('PQR Industries', 'PQR Ind', 'sales@pqrind.com', '01-4000003', 'Proposal', 3500000),
('LMN Solutions', 'LMN Sol', 'hello@lmnsol.com', '01-4000004', 'New', 1500000);

-- ── 11. ASSETS ───────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO Assets (name, category, serial_number, assigned_to, purchase_date, value, status) VALUES
('Dell Laptop #001', 'Electronics', 'DL-2026-001', 'Purushottam Sharma', '2025-01-15', 150000, 'Active'),
('HP Printer #001', 'Electronics', 'HP-2025-001', 'Office', '2025-02-20', 35000, 'Active'),
('Office Desk #001', 'Furniture', 'FURN-001', 'Reception', '2024-06-10', 25000, 'Active'),
('MacBook Pro #001', 'Electronics', 'MB-2026-001', 'Deepak Chaudhary', '2025-03-10', 250000, 'Active'),
('Projector #001', 'Electronics', 'PROJ-2025-001', 'Conference Room', '2024-08-15', 45000, 'Active');

-- ── 12. INVOICES ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO Invoices (invoice_number, client_name, amount, status, issue_date, due_date) VALUES
('INV-2026-001', 'ABC Corporation', 2500000, 'Paid', '2026-03-01', '2026-03-31'),
('INV-2026-002', 'XYZ Enterprises', 5000000, 'Pending', '2026-04-01', '2026-04-30'),
('INV-2026-003', 'PQR Industries', 3500000, 'Overdue', '2026-02-15', '2026-03-15');

-- ── VERIFICATION QUERIES ─────────────────────────────────────────────────────
SELECT '✅ Branches' as module, COUNT(*) as count FROM Branches
UNION ALL
SELECT '✅ Gates', COUNT(*) FROM Gates
UNION ALL
SELECT '✅ Devices', COUNT(*) FROM Devices
UNION ALL
SELECT '✅ Employees', COUNT(*) FROM Employees
UNION ALL
SELECT '✅ Attendance Logs', COUNT(*) FROM AttendanceLogs
UNION ALL
SELECT '✅ Leave Requests', COUNT(*) FROM LeaveRequests
UNION ALL
SELECT '✅ Inventory Items', COUNT(*) FROM InventoryItems
UNION ALL
SELECT '✅ Projects', COUNT(*) FROM Projects
UNION ALL
SELECT '✅ Tasks', COUNT(*) FROM Tasks
UNION ALL
SELECT '✅ CRM Leads', COUNT(*) FROM Leads
UNION ALL
SELECT '✅ Assets', COUNT(*) FROM Assets
UNION ALL
SELECT '✅ Invoices', COUNT(*) FROM Invoices;
