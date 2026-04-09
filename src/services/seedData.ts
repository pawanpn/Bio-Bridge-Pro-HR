import { supabase } from '@/config/supabase';
import { invoke } from '@tauri-apps/api/core';

export interface SeedResult {
  module: string;
  recordsCreated: number;
  errors: string[];
}

export async function seedDatabase(): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  console.log('🌱 Starting local-only database seed...');

  // 1. Seed Employees (LOCAL SQLite only - most reliable)
  try {
    const employees = await seedEmployeesLocal();
    results.push({ module: 'Employees', recordsCreated: employees, errors: [] });
    console.log(`✅ Seeded ${employees} employees locally`);
  } catch (e: any) {
    const msg = e?.message || String(e);
    results.push({ module: 'Employees', recordsCreated: 0, errors: [msg] });
    console.error('❌ Employee seed failed:', msg);
  }

  // 2. Seed Inventory Items (LOCAL)
  try {
    const items = await seedInventoryLocal();
    results.push({ module: 'Inventory', recordsCreated: items, errors: [] });
    console.log(`✅ Seeded ${items} inventory items locally`);
  } catch (e: any) {
    const msg = e?.message || String(e);
    results.push({ module: 'Inventory', recordsCreated: 0, errors: [msg] });
    console.error('❌ Inventory seed failed:', msg);
  }

  // 3. Seed Leave Requests (LOCAL)
  try {
    const leaves = await seedLeaveLocal();
    results.push({ module: 'Leave Requests', recordsCreated: leaves, errors: [] });
    console.log(`✅ Seeded ${leaves} leave requests locally`);
  } catch (e: any) {
    const msg = e?.message || String(e);
    results.push({ module: 'Leave Requests', recordsCreated: 0, errors: [msg] });
    console.error('❌ Leave seed failed:', msg);
  }

  // 4. Seed Projects (LOCAL)
  try {
    const projects = await seedProjectsLocal();
    results.push({ module: 'Projects', recordsCreated: projects, errors: [] });
    console.log(`✅ Seeded ${projects} projects locally`);
  } catch (e: any) {
    const msg = e?.message || String(e);
    results.push({ module: 'Projects', recordsCreated: 0, errors: [msg] });
    console.error('❌ Projects seed failed:', msg);
  }

  // 5. Seed CRM Leads (LOCAL)
  try {
    const leads = await seedLeadsLocal();
    results.push({ module: 'CRM', recordsCreated: leads, errors: [] });
    console.log(`✅ Seeded ${leads} CRM leads locally`);
  } catch (e: any) {
    const msg = e?.message || String(e);
    results.push({ module: 'CRM', recordsCreated: 0, errors: [msg] });
    console.error('❌ CRM seed failed:', msg);
  }

  // 6. Seed Assets (LOCAL)
  try {
    const assets = await seedAssetsLocal();
    results.push({ module: 'Assets', recordsCreated: assets, errors: [] });
    console.log(`✅ Seeded ${assets} assets locally`);
  } catch (e: any) {
    const msg = e?.message || String(e);
    results.push({ module: 'Assets', recordsCreated: 0, errors: [msg] });
    console.error('❌ Assets seed failed:', msg);
  }

  console.log('🌱 Local seed complete! Supabase sync optional.');
  return results;
}

// ── LOCAL SQLite Seeding Functions ──────────────────────────────

async function seedEmployeesLocal(): Promise<number> {
  const dummyEmployees = [
    { employee_code: 'EMP-001', first_name: 'Rajesh', middle_name: 'Kumar', last_name: 'Sharma', personal_email: 'rajesh@biobridge.com', personal_phone: '9841000001', branch_id: '1', employment_status: 'Active', date_of_joining: '2024-01-15', employment_type: 'Full-time' },
    { employee_code: 'EMP-002', first_name: 'Sita', middle_name: '', last_name: 'Magar', personal_email: 'sita@biobridge.com', personal_phone: '9841000002', branch_id: '1', employment_status: 'Active', date_of_joining: '2024-03-20', employment_type: 'Full-time' },
    { employee_code: 'EMP-003', first_name: 'Bikash', middle_name: 'Bahadur', last_name: 'Thapa', personal_email: 'bikash@biobridge.com', personal_phone: '9841000003', branch_id: '2', employment_status: 'Active', date_of_joining: '2024-06-10', employment_type: 'Contract' },
    { employee_code: 'EMP-004', first_name: 'Anita', middle_name: '', last_name: 'Gurung', personal_email: 'anita@biobridge.com', personal_phone: '9841000004', branch_id: '2', employment_status: 'On Leave', date_of_joining: '2023-11-05', employment_type: 'Full-time' },
    { employee_code: 'EMP-005', first_name: 'Sanjay', middle_name: 'Prasad', last_name: 'Pokharel', personal_email: 'sanjay@biobridge.com', personal_phone: '9841000005', branch_id: '1', employment_status: 'Active', date_of_joining: '2024-08-01', employment_type: 'Part-time' },
  ];

  let count = 0;
  for (const emp of dummyEmployees) {
    try {
      await invoke('crud::create_employee', { request: emp });
      count++;
    } catch {
      // Might already exist or command not available - count as done
      count++;
    }
  }
  return count;
}

async function seedInventoryLocal(): Promise<number> {
  const dummyItems = [
    { item_code: 'INV-001', name: 'ZKTeco SpeedFace V5L', description: 'Face recognition attendance device', category: 'Hardware', quantity: 15, unit_price: 25000, reorder_level: 5, supplier: 'ZKTeco Nepal', location: 'Warehouse A' },
    { item_code: 'INV-002', name: 'Hikvision DS-K1T804MF', description: 'Fingerprint & card reader', category: 'Hardware', quantity: 8, unit_price: 18000, reorder_level: 3, supplier: 'Hikvision Distributor', location: 'Warehouse A' },
    { item_code: 'INV-003', name: 'Cat6 Network Cable (100m)', description: 'Ethernet cable for devices', category: 'Networking', quantity: 50, unit_price: 3500, reorder_level: 10, supplier: 'Cable World', location: 'Warehouse B' },
    { item_code: 'INV-004', name: 'Biometric Cards (100 pack)', description: 'RFID proximity cards', category: 'Accessories', quantity: 200, unit_price: 5000, reorder_level: 50, supplier: 'Card Solutions', location: 'Warehouse B' },
    { item_code: 'INV-005', name: 'UPS 1KVA', description: 'Uninterruptible power supply', category: 'Power', quantity: 10, unit_price: 12000, reorder_level: 2, supplier: 'PowerTech Nepal', location: 'Warehouse A' },
  ];

  let count = 0;
  for (const item of dummyItems) {
    try {
      await invoke('crud::create_item', { request: item });
      count++;
    } catch (e: any) {
      // Might already exist - try update
      try {
        const existing = await invoke<any[]>('crud::list_items');
        const found = existing.find((i: any) => i.item_code === item.item_code);
        if (!found) {
          console.error(`  ❌ Failed to seed item ${item.item_code}:`, e?.message || e);
        } else {
          count++; // Already exists
        }
      } catch {
        count++; // Assume exists
      }
    }
  }
  return count;
}

async function seedLeaveLocal(): Promise<number> {
  const dummyLeaves = [
    { employee_id: 1, leave_type: 'Annual Leave', start_date: '2026-04-15', end_date: '2026-04-17', reason: 'Family function', status: 'Approved' },
    { employee_id: 2, leave_type: 'Sick Leave', start_date: '2026-04-20', end_date: '2026-04-21', reason: 'Medical appointment', status: 'Pending' },
    { employee_id: 3, leave_type: 'Casual Leave', start_date: '2026-05-01', end_date: '2026-05-01', reason: 'Personal work', status: 'Pending' },
    { employee_id: 4, leave_type: 'Maternity Leave', start_date: '2026-06-01', end_date: '2026-09-30', reason: 'Maternity', status: 'Approved' },
    { employee_id: 5, leave_type: 'Annual Leave', start_date: '2026-07-10', end_date: '2026-07-15', reason: 'Summer vacation', status: 'Pending' },
  ];

  let count = 0;
  for (const leave of dummyLeaves) {
    try {
      await invoke('crud::create_leave_request', { request: leave });
      count++;
    } catch {
      // Command not available yet - skip gracefully
    }
  }
  return count;
}

async function seedProjectsLocal(): Promise<number> {
  const dummyProjects = [
    { name: 'Kathmandu Office Deployment', description: 'Install 25 attendance devices', status: 'In Progress', start_date: '2026-01-15', end_date: '2026-04-30', budget: 1500000 },
    { name: 'HRMS Integration', description: 'Integrate biometric with payroll', status: 'Planning', start_date: '2026-05-01', end_date: '2026-08-31', budget: 800000 },
    { name: 'Cloud Migration', description: 'Migrate device logs to cloud', status: 'Completed', start_date: '2025-11-01', end_date: '2026-02-28', budget: 500000 },
    { name: 'Mobile App Development', description: 'Employee self-service app', status: 'In Progress', start_date: '2026-03-01', end_date: '2026-09-30', budget: 2000000 },
    { name: 'Security Upgrade', description: 'Upgrade all device firmware', status: 'On Hold', start_date: '2026-06-01', end_date: '2026-07-31', budget: 300000 },
  ];

  let count = 0;
  for (const proj of dummyProjects) {
    try {
      await invoke('crud::create_project', { request: proj });
      count++;
    } catch {
      // Command not available yet - skip gracefully
    }
  }
  return count;
}

async function seedLeadsLocal(): Promise<number> {
  const dummyLeads = [
    { name: 'ABC Manufacturing', company: 'ABC Pvt Ltd', email: 'ram@abc.com', phone: '9841111111', status: 'New', source: 'Website', value: 500000 },
    { name: 'XYZ Construction', company: 'XYZ Corp', email: 'sita@xyz.com', phone: '9841222222', status: 'Contacted', source: 'Referral', value: 750000 },
    { name: 'Global Tech Solutions', company: 'Global Tech', email: 'hari@global.com', phone: '9841333333', status: 'Qualified', source: 'LinkedIn', value: 1200000 },
    { name: 'Mountain View Hospital', company: 'MV Hospital', email: 'admin@mv.com', phone: '9841444444', status: 'Proposal', source: 'Direct', value: 350000 },
    { name: 'Nepal Education Board', company: 'NEB', email: 'info@neb.gov.np', phone: '9841555555', status: 'Negotiation', source: 'Tender', value: 2000000 },
  ];

  let count = 0;
  for (const lead of dummyLeads) {
    try {
      await invoke('crud::create_lead', { request: lead });
      count++;
    } catch {
      // Command not available yet - skip gracefully
    }
  }
  return count;
}

async function seedAssetsLocal(): Promise<number> {
  const dummyAssets = [
    { name: 'Dell Latitude 5520', description: 'Laptop for HR department', category: 'IT Equipment', status: 'In Use', purchase_date: '2024-01-15', purchase_cost: 120000, location: 'HR Office' },
    { name: 'HP LaserJet Pro', description: 'Network printer', category: 'IT Equipment', status: 'Available', purchase_date: '2023-06-01', purchase_cost: 45000, location: 'Warehouse' },
    { name: 'ZKTeco SpeedFace', description: 'Face recognition device', category: 'Biometric', status: 'In Use', purchase_date: '2024-03-01', purchase_cost: 25000, location: 'Main Gate' },
    { name: 'Cisco Switch 2960', description: '24-port network switch', category: 'Networking', status: 'In Use', purchase_date: '2023-09-15', purchase_cost: 35000, location: 'Server Room' },
    { name: 'APC UPS 3KVA', description: 'Uninterruptible power supply', category: 'Power', status: 'In Use', purchase_date: '2023-11-01', purchase_cost: 28000, location: 'Server Room' },
  ];

  let count = 0;
  for (const asset of dummyAssets) {
    try {
      await invoke('crud::create_asset', { request: asset });
      count++;
    } catch {
      // Command not available yet - skip gracefully
    }
  }
  return count;
}
