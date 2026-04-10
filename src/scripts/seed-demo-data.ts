/**
 * Comprehensive Demo Data Seeder
 * Seeds demo data across ALL modules and submenus
 */

import { invoke } from '@tauri-apps/api/core';

// ── Demo Data Definitions ───────────────────────────────────────────────────

const DEMO_BRANCHES = [
  { name: 'Head Office', location: 'Kathmandu, Nepal' },
  { name: 'Pokhara Branch', location: 'Pokhara, Nepal' },
  { name: 'Biratnagar Branch', location: 'Biratnagar, Nepal' },
];

const DEMO_GATES = [
  { branchId: 1, name: 'Main Entrance' },
  { branchId: 1, name: 'Back Gate' },
  { branchId: 2, name: 'Main Gate' },
  { branchId: 3, name: 'Main Gate' },
];

const DEMO_DEVICES = [
  { name: 'ZKTeco Main', brand: 'ZKTeco', ip: '192.168.1.201', port: 4370, branchId: 1, gateId: 1, machineNumber: 1, isDefault: true },
  { name: 'ZKTeco Back', brand: 'ZKTeco', ip: '192.168.1.202', port: 4370, branchId: 1, gateId: 2, machineNumber: 2, isDefault: false },
  { name: 'Hikvision Pokhara', brand: 'Hikvision', ip: '192.168.2.101', port: 8000, branchId: 2, gateId: 3, machineNumber: 3, isDefault: true },
];

const DEMO_DEPARTMENTS = [
  'HR', 'IT', 'Finance', 'Marketing', 'Sales', 'Operations', 'Admin'
];

const DEMO_DESIGNATIONS = [
  'Manager', 'Senior Developer', 'Developer', 'Analyst', 'Accountant', 'Executive', 'Assistant'
];

const DEMO_EMPLOYEES = [
  { firstName: 'Purushottam', lastName: 'Sharma', email: 'purushottam@biobridge.com', phone: '9841000001', department: 'IT', designation: 'Manager', branchId: 1, deviceEnrollNumber: '1001', salary: 85000 },
  { firstName: 'Amit', lastName: 'Shah', email: 'amit@biobridge.com', phone: '9841000002', department: 'Finance', designation: 'Accountant', branchId: 1, deviceEnrollNumber: '1002', salary: 65000 },
  { firstName: 'Binod', lastName: 'Karki', email: 'binod@biobridge.com', phone: '9841000003', department: 'HR', designation: 'Manager', branchId: 1, deviceEnrollNumber: '1003', salary: 75000 },
  { firstName: 'Deepak', lastName: 'Chaudhary', email: 'deepak@biobridge.com', phone: '9841000004', department: 'IT', designation: 'Senior Developer', branchId: 1, deviceEnrollNumber: '1004', salary: 95000 },
  { firstName: 'Eran', lastName: 'Khadka', email: 'eran@biobridge.com', phone: '9841000005', department: 'Marketing', designation: 'Executive', branchId: 2, deviceEnrollNumber: '1005', salary: 55000 },
  { firstName: 'Firoz', lastName: 'Maharjan', email: 'firoz@biobridge.com', phone: '9841000006', department: 'Sales', designation: 'Manager', branchId: 2, deviceEnrollNumber: '1006', salary: 70000 },
  { firstName: 'Ganesh', lastName: 'Bhandari', email: 'ganesh@biobridge.com', phone: '9841000007', department: 'Operations', designation: 'Analyst', branchId: 1, deviceEnrollNumber: '1007', salary: 60000 },
  { firstName: 'Hari', lastName: 'Prasad', email: 'hari@biobridge.com', phone: '9841000008', department: 'IT', designation: 'Developer', branchId: 1, deviceEnrollNumber: '1008', salary: 70000 },
  { firstName: 'Ishwar', lastName: 'Dahal', email: 'ishwar@biobridge.com', phone: '9841000009', department: 'Finance', designation: 'Analyst', branchId: 3, deviceEnrollNumber: '1009', salary: 65000 },
  { firstName: 'Jiban', lastName: 'Gurung', email: 'jiban@biobridge.com', phone: '9841000010', department: 'Admin', designation: 'Assistant', branchId: 3, deviceEnrollNumber: '1010', salary: 45000 },
  { firstName: 'Kisan', lastName: 'Rai', email: 'kisan@biobridge.com', phone: '9841000011', department: 'IT', designation: 'Developer', branchId: 2, deviceEnrollNumber: '1011', salary: 72000 },
  { firstName: 'Laxman', lastName: 'Shrestha', email: 'laxman@biobridge.com', phone: '9841000012', department: 'Sales', designation: 'Executive', branchId: 3, deviceEnrollNumber: '1012', salary: 50000 },
  { firstName: 'Manoj', lastName: 'Kumar', email: 'manoj@biobridge.com', phone: '9841000013', department: 'HR', designation: 'Executive', branchId: 1, deviceEnrollNumber: '1013', salary: 55000 },
  { firstName: 'Narayan', lastName: 'Thapa', email: 'narayan@biobridge.com', phone: '9841000014', department: 'Operations', designation: 'Manager', branchId: 2, deviceEnrollNumber: '1014', salary: 80000 },
  { firstName: 'Ojasvi', lastName: 'Pandey', email: 'ojasvi@biobridge.com', phone: '9841000015', department: 'Marketing', designation: 'Manager', branchId: 3, deviceEnrollNumber: '1015', salary: 75000 },
];

const DEMO_ATTENDANCE_LOGS = [
  // Today's logs
  { employeeId: 1001, timestamp: '2026-04-10 09:15:00', punchMethod: 'Fingerprint' },
  { employeeId: 1002, timestamp: '2026-04-10 09:20:00', punchMethod: 'Fingerprint' },
  { employeeId: 1003, timestamp: '2026-04-10 09:10:00', punchMethod: 'Fingerprint' },
  { employeeId: 1004, timestamp: '2026-04-10 09:25:00', punchMethod: 'Fingerprint' },
  { employeeId: 1005, timestamp: '2026-04-10 09:30:00', punchMethod: 'Fingerprint' },
  { employeeId: 1006, timestamp: '2026-04-10 09:18:00', punchMethod: 'Fingerprint' },
  { employeeId: 1007, timestamp: '2026-04-10 09:22:00', punchMethod: 'Fingerprint' },
  { employeeId: 1008, timestamp: '2026-04-10 09:35:00', punchMethod: 'Fingerprint' },
  { employeeId: 1009, timestamp: '2026-04-10 09:28:00', punchMethod: 'Fingerprint' },
  { employeeId: 1010, timestamp: '2026-04-10 09:40:00', punchMethod: 'Fingerprint' },
  // Yesterday's logs
  { employeeId: 1001, timestamp: '2026-04-09 09:10:00', punchMethod: 'Fingerprint' },
  { employeeId: 1002, timestamp: '2026-04-09 09:15:00', punchMethod: 'Fingerprint' },
  { employeeId: 1003, timestamp: '2026-04-09 09:05:00', punchMethod: 'Fingerprint' },
  { employeeId: 1004, timestamp: '2026-04-09 09:20:00', punchMethod: 'Fingerprint' },
  { employeeId: 1005, timestamp: '2026-04-09 09:25:00', punchMethod: 'Fingerprint' },
];

const DEMO_LEAVE_REQUESTS = [
  { employeeId: 1001, leaveType: 'Annual', startDate: '2026-04-15', endDate: '2026-04-17', reason: 'Family function', status: 'Pending' },
  { employeeId: 1003, leaveType: 'Sick', startDate: '2026-04-12', endDate: '2026-04-13', reason: 'Medical appointment', status: 'Approved' },
  { employeeId: 1005, leaveType: 'Casual', startDate: '2026-04-20', endDate: '2026-04-20', reason: 'Personal work', status: 'Pending' },
];

const DEMO_ITEMS = [
  { name: 'Laptop Dell XPS 15', category: 'Electronics', sku: 'ELEC-001', quantity: 25, unitPrice: 150000, reorderLevel: 5 },
  { name: 'Office Chair Ergonomic', category: 'Furniture', sku: 'FURN-001', quantity: 50, unitPrice: 15000, reorderLevel: 10 },
  { name: 'A4 Paper Ream', category: 'Stationery', sku: 'STAT-001', quantity: 200, unitPrice: 350, reorderLevel: 50 },
  { name: 'HP Printer LaserJet', category: 'Electronics', sku: 'ELEC-002', quantity: 10, unitPrice: 35000, reorderLevel: 3 },
  { name: 'Whiteboard Marker Set', category: 'Stationery', sku: 'STAT-002', quantity: 100, unitPrice: 250, reorderLevel: 20 },
];

const DEMO_PROJECTS = [
  { name: 'BioBridge ERP v2.0', status: 'Active', priority: 'High', startDate: '2026-01-15', endDate: '2026-06-30', budget: 5000000 },
  { name: 'Mobile App Development', status: 'Active', priority: 'Medium', startDate: '2026-02-01', endDate: '2026-08-31', budget: 3000000 },
  { name: 'Infrastructure Upgrade', status: 'Planning', priority: 'Low', startDate: '2026-05-01', endDate: '2026-09-30', budget: 2000000 },
];

const DEMO_TASKS = [
  { projectId: 1, title: 'Implement Attendance Module', status: 'In Progress', priority: 'High', assignedTo: 'Deepak Chaudhary', dueDate: '2026-04-20' },
  { projectId: 1, title: 'Payroll Integration', status: 'Todo', priority: 'Medium', assignedTo: 'Amit Shah', dueDate: '2026-05-15' },
  { projectId: 2, title: 'UI/UX Design', status: 'Completed', priority: 'High', assignedTo: 'Purushottam Sharma', dueDate: '2026-03-30' },
  { projectId: 2, title: 'Backend API Development', status: 'In Progress', priority: 'High', assignedTo: 'Hari Prasad', dueDate: '2026-05-01' },
];

const DEMO_LEADS = [
  { name: 'ABC Corporation', company: 'ABC Corp', email: 'contact@abccorp.com', phone: '01-4000001', status: 'New', value: 2500000 },
  { name: 'XYZ Enterprises', company: 'XYZ Ent', email: 'info@xyzent.com', phone: '01-4000002', status: 'Qualified', value: 5000000 },
  { name: 'PQR Industries', company: 'PQR Ind', email: 'sales@pqrind.com', phone: '01-4000003', status: 'Proposal', value: 3500000 },
];

const DEMO_ASSETS = [
  { name: 'Dell Laptop #001', category: 'Electronics', serialNumber: 'DL-2026-001', assignedTo: 'Purushottam Sharma', purchaseDate: '2025-01-15', value: 150000, status: 'Active' },
  { name: 'HP Printer #001', category: 'Electronics', serialNumber: 'HP-2025-001', assignedTo: 'Office', purchaseDate: '2025-02-20', value: 35000, status: 'Active' },
  { name: 'Office Desk #001', category: 'Furniture', serialNumber: 'FURN-001', assignedTo: 'Reception', purchaseDate: '2024-06-10', value: 25000, status: 'Active' },
];

const DEMO_INVOICES = [
  { invoiceNumber: 'INV-2026-001', clientId: 1, amount: 2500000, status: 'Paid', issueDate: '2026-03-01', dueDate: '2026-03-31' },
  { invoiceNumber: 'INV-2026-002', clientId: 2, amount: 5000000, status: 'Pending', issueDate: '2026-04-01', dueDate: '2026-04-30' },
  { invoiceNumber: 'INV-2026-003', clientId: 3, amount: 3500000, status: 'Overdue', issueDate: '2026-02-15', dueDate: '2026-03-15' },
];

// ── Main Seeder Function ────────────────────────────────────────────────────

export async function seedAllDemoData(): Promise<string> {
  const results: string[] = [];
  
  try {
    // 1. Seed Branches
    results.push(' Seeding Branches...');
    for (const branch of DEMO_BRANCHES) {
      try {
        await invoke('add_branch', branch);
        results.push(`  ✅ Branch: ${branch.name}`);
      } catch (e) {
        results.push(`  ⚠️ Branch ${branch.name} may already exist`);
      }
    }

    // 2. Seed Gates
    results.push('\n🚪 Seeding Gates...');
    for (const gate of DEMO_GATES) {
      try {
        await invoke('add_gate', gate);
        results.push(`  ✅ Gate: ${gate.name}`);
      } catch (e) {
        results.push(`  ⚠️ Gate ${gate.name} may already exist`);
      }
    }

    // 3. Seed Devices
    results.push('\n📱 Seeding Devices...');
    for (const device of DEMO_DEVICES) {
      try {
        await invoke('add_device', { device });
        results.push(`  ✅ Device: ${device.name}`);
      } catch (e) {
        results.push(`  ⚠️ Device ${device.name} may already exist`);
      }
    }

    // 4. Seed Employees
    results.push('\n👥 Seeding Employees...');
    for (const emp of DEMO_EMPLOYEES) {
      try {
        await invoke('create_employee', emp);
        results.push(`  ✅ Employee: ${emp.firstName} ${emp.lastName}`);
      } catch (e) {
        results.push(`  ⚠️ Employee ${emp.firstName} may already exist`);
      }
    }

    // 5. Seed Attendance Logs
    results.push('\n⏰ Seeding Attendance Logs...');
    for (const log of DEMO_ATTENDANCE_LOGS) {
      try {
        await invoke('add_manual_attendance', {
          employeeId: log.employeeId,
          date: log.timestamp.split(' ')[0],
          time: log.timestamp.split(' ')[1],
          method: log.punchMethod,
        });
        results.push(`  ✅ Attendance: Employee ${log.employeeId} at ${log.timestamp}`);
      } catch (e) {
        results.push(`  ⚠️ Log for employee ${log.employeeId} may already exist`);
      }
    }

    // 6. Seed Leave Requests
    results.push('\n🏖️ Seeding Leave Requests...');
    for (const leave of DEMO_LEAVE_REQUESTS) {
      try {
        await invoke('create_leave_request', leave);
        results.push(`  ✅ Leave: ${leave.leaveType} for Employee ${leave.employeeId}`);
      } catch (e) {
        results.push(`  ⚠️ Leave request may already exist`);
      }
    }

    // 7. Seed Inventory Items
    results.push('\n📦 Seeding Inventory Items...');
    for (const item of DEMO_ITEMS) {
      try {
        await invoke('create_item', item);
        results.push(`  ✅ Item: ${item.name}`);
      } catch (e) {
        results.push(`  ⚠️ Item ${item.name} may already exist`);
      }
    }

    // 8. Seed Projects
    results.push('\n📋 Seeding Projects...');
    for (const project of DEMO_PROJECTS) {
      try {
        await invoke('create_project', project);
        results.push(`  ✅ Project: ${project.name}`);
      } catch (e) {
        results.push(`  ⚠️ Project ${project.name} may already exist`);
      }
    }

    // 9. Seed Tasks
    results.push('\n✅ Seeding Tasks...');
    for (const task of DEMO_TASKS) {
      try {
        await invoke('create_task', task);
        results.push(`  ✅ Task: ${task.title}`);
      } catch (e) {
        results.push(`  ⚠️ Task ${task.title} may already exist`);
      }
    }

    // 10. Seed CRM Leads
    results.push('\n Seeding CRM Leads...');
    for (const lead of DEMO_LEADS) {
      try {
        await invoke('create_lead', lead);
        results.push(`  ✅ Lead: ${lead.name}`);
      } catch (e) {
        results.push(`  ⚠️ Lead ${lead.name} may already exist`);
      }
    }

    // 11. Seed Assets
    results.push('\n💻 Seeding Assets...');
    for (const asset of DEMO_ASSETS) {
      try {
        await invoke('create_asset', asset);
        results.push(`  ✅ Asset: ${asset.name}`);
      } catch (e) {
        results.push(`  ⚠️ Asset ${asset.name} may already exist`);
      }
    }

    // 12. Seed Invoices
    results.push('\n💰 Seeding Invoices...');
    for (const invoice of DEMO_INVOICES) {
      try {
        await invoke('create_invoice', invoice);
        results.push(`  ✅ Invoice: ${invoice.invoiceNumber}`);
      } catch (e) {
        results.push(`  ⚠️ Invoice ${invoice.invoiceNumber} may already exist`);
      }
    }

    results.push('\n✅ Demo data seeding complete!');
    return results.join('\n');
    
  } catch (error) {
    return `❌ Seeding failed: ${error}`;
  }
}
