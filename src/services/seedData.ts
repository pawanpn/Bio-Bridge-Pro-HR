import { supabase } from '@/config/supabase';
import { invoke } from '@tauri-apps/api/core';

export interface SeedResult {
  module: string;
  recordsCreated: number;
  errors: string[];
}

/**
 * SEED DATABASE - Supabase FIRST, then Local SQLite
 * This ensures data appears in Supabase Table Editor immediately.
 */
export async function seedDatabase(): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  console.log('🌱 Starting Supabase + Local seed...');

  // 1. Seed Employees to Supabase first
  try {
    const count = await seedEmployeesSupabase();
    results.push({ module: 'Employees', recordsCreated: count, errors: [] });
    console.log(`✅ Seeded ${count} employees to Supabase`);
  } catch (e: any) {
    results.push({ module: 'Employees', recordsCreated: 0, errors: [e?.message || String(e)] });
  }

  // 2. Seed Inventory to Supabase
  try {
    const count = await seedItemsSupabase();
    results.push({ module: 'Inventory', recordsCreated: count, errors: [] });
    console.log(`✅ Seeded ${count} items to Supabase`);
  } catch (e: any) {
    results.push({ module: 'Inventory', recordsCreated: 0, errors: [e?.message || String(e)] });
  }

  // 3. Seed Projects to Supabase
  try {
    const count = await seedProjectsSupabase();
    results.push({ module: 'Projects', recordsCreated: count, errors: [] });
    console.log(`✅ Seeded ${count} projects to Supabase`);
  } catch (e: any) {
    results.push({ module: 'Projects', recordsCreated: 0, errors: [e?.message || String(e)] });
  }

  // 4. Seed CRM Leads to Supabase
  try {
    const count = await seedLeadsSupabase();
    results.push({ module: 'CRM', recordsCreated: count, errors: [] });
    console.log(`✅ Seeded ${count} leads to Supabase`);
  } catch (e: any) {
    results.push({ module: 'CRM', recordsCreated: 0, errors: [e?.message || String(e)] });
  }

  // 5. Seed Leave Requests to Supabase
  try {
    const count = await seedLeavesSupabase();
    results.push({ module: 'Leave Requests', recordsCreated: count, errors: [] });
    console.log(`✅ Seeded ${count} leaves to Supabase`);
  } catch (e: any) {
    results.push({ module: 'Leave Requests', recordsCreated: 0, errors: [e?.message || String(e)] });
  }

  // 6. Seed Assets to Supabase
  try {
    const count = await seedAssetsSupabase();
    results.push({ module: 'Assets', recordsCreated: count, errors: [] });
    console.log(`✅ Seeded ${count} assets to Supabase`);
  } catch (e: any) {
    results.push({ module: 'Assets', recordsCreated: 0, errors: [e?.message || String(e)] });
  }

  // 7. Sync Supabase data to local SQLite (optional - runs in background)
  try {
    await syncSupabaseToLocal();
  } catch (e: any) {
    console.warn('⚠️ Local sync failed (non-critical):', e?.message);
  }

  console.log('🌱 Seed complete! Check Supabase Table Editor.');
  return results;
}

// ── SUPABASE SEEDING (Direct, bypasses Rust) ────────────────────

async function seedEmployeesSupabase(): Promise<number> {
  // Based on ACTUAL Supabase CSV columns
  const data = [
    { employee_code: 'EMP-001', first_name: 'Rajesh', middle_name: 'Kumar', last_name: 'Sharma', personal_email: 'rajesh@biobridge.com', personal_phone: '9841000001', employment_status: 'Active', date_of_joining: '2024-01-15', gender: 'Male', citizenship_number: '12345678901', pan_number: 'PAN001', bank_name: 'Nabil Bank', account_number: 'ACC001' },
    { employee_code: 'EMP-002', first_name: 'Sita', middle_name: '', last_name: 'Magar', personal_email: 'sita@biobridge.com', personal_phone: '9841000002', employment_status: 'Active', date_of_joining: '2024-03-20', gender: 'Female', citizenship_number: '12345678902', pan_number: 'PAN002', bank_name: 'Global IME', account_number: 'ACC002' },
    { employee_code: 'EMP-003', first_name: 'Bikash', middle_name: 'Bahadur', last_name: 'Thapa', personal_email: 'bikash@biobridge.com', personal_phone: '9841000003', employment_status: 'Active', date_of_joining: '2024-06-10', gender: 'Male', citizenship_number: '12345678903', pan_number: 'PAN003', bank_name: 'Everest Bank', account_number: 'ACC003' },
    { employee_code: 'EMP-004', first_name: 'Anita', middle_name: '', last_name: 'Gurung', personal_email: 'anita@biobridge.com', personal_phone: '9841000004', employment_status: 'On Leave', date_of_joining: '2023-11-05', gender: 'Female', citizenship_number: '12345678904', pan_number: 'PAN004', bank_name: 'Standard Chartered', account_number: 'ACC004' },
    { employee_code: 'EMP-005', first_name: 'Sanjay', middle_name: 'Prasad', last_name: 'Pokharel', personal_email: 'sanjay@biobridge.com', personal_phone: '9841000005', employment_status: 'Active', date_of_joining: '2024-08-01', gender: 'Male', citizenship_number: '12345678905', pan_number: 'PAN005', bank_name: 'NIC Asia', account_number: 'ACC005' },
  ];

  const { error } = await supabase.from('employees').upsert(data, {
    onConflict: 'employee_code',
    ignoreDuplicates: false
  });

  if (error) throw error;
  return data.length;
}

async function seedItemsSupabase(): Promise<number> {
  // Based on ACTUAL Supabase CSV columns: item_code, item_name, organization_id, sale_price
  const data = [
    { item_code: 'INV-001', item_name: 'ZKTeco SpeedFace V5L', organization_id: '00000000-0000-0000-0000-000000000000', sale_price: 25000 },
    { item_code: 'INV-002', item_name: 'Hikvision DS-K1T804MF', organization_id: '00000000-0000-0000-0000-000000000000', sale_price: 18000 },
    { item_code: 'INV-003', item_name: 'Cat6 Cable 100m', organization_id: '00000000-0000-0000-0000-000000000000', sale_price: 3500 },
    { item_code: 'INV-004', item_name: 'Biometric Cards 100pk', organization_id: '00000000-0000-0000-0000-000000000000', sale_price: 5000 },
    { item_code: 'INV-005', item_name: 'UPS 1KVA', organization_id: '00000000-0000-0000-0000-000000000000', sale_price: 12000 },
  ];

  const { error } = await supabase.from('items').upsert(data, {
    onConflict: 'item_code',
    ignoreDuplicates: false
  });

  if (error) throw error;
  return data.length;
}

async function seedProjectsSupabase(): Promise<number> {
  const data = [
    { name: 'Kathmandu Office Deployment', description: 'Install 25 attendance devices', status: 'In Progress', start_date: '2026-01-15', end_date: '2026-04-30', budget: 1500000, organization_id: '00000000-0000-0000-0000-000000000000' },
    { name: 'HRMS Integration', description: 'Integrate biometric with payroll', status: 'Planning', start_date: '2026-05-01', end_date: '2026-08-31', budget: 800000, organization_id: '00000000-0000-0000-0000-000000000000' },
    { name: 'Cloud Migration', description: 'Migrate device logs to cloud', status: 'Completed', start_date: '2025-11-01', end_date: '2026-02-28', budget: 500000, organization_id: '00000000-0000-0000-0000-000000000000' },
    { name: 'Mobile App Development', description: 'Employee self-service app', status: 'In Progress', start_date: '2026-03-01', end_date: '2026-09-30', budget: 2000000, organization_id: '00000000-0000-0000-0000-000000000000' },
    { name: 'Security Upgrade', description: 'Upgrade all device firmware', status: 'On Hold', start_date: '2026-06-01', end_date: '2026-07-31', budget: 300000, organization_id: '00000000-0000-0000-0000-000000000000' },
  ];

  const { error } = await supabase.from('projects').insert(data);
  if (error) throw error;
  return data.length;
}

async function seedLeadsSupabase(): Promise<number> {
  const data = [
    { name: 'ABC Manufacturing', company: 'ABC Pvt Ltd', email: 'ram@abc.com', phone: '9841111111', status: 'New', source: 'Website', value: 500000, organization_id: '00000000-0000-0000-0000-000000000000' },
    { name: 'XYZ Construction', company: 'XYZ Corp', email: 'sita@xyz.com', phone: '9841222222', status: 'Contacted', source: 'Referral', value: 750000, organization_id: '00000000-0000-0000-0000-000000000000' },
    { name: 'Global Tech Solutions', company: 'Global Tech', email: 'hari@global.com', phone: '9841333333', status: 'Qualified', source: 'LinkedIn', value: 1200000, organization_id: '00000000-0000-0000-0000-000000000000' },
    { name: 'Mountain View Hospital', company: 'MV Hospital', email: 'admin@mv.com', phone: '9841444444', status: 'Proposal', source: 'Direct', value: 350000, organization_id: '00000000-0000-0000-0000-000000000000' },
    { name: 'Nepal Education Board', company: 'NEB', email: 'info@neb.gov.np', phone: '9841555555', status: 'Negotiation', source: 'Tender', value: 2000000, organization_id: '00000000-0000-0000-0000-000000000000' },
  ];

  const { error } = await supabase.from('leads').insert(data);
  if (error) throw error;
  return data.length;
}

async function seedLeavesSupabase(): Promise<number> {
  const data = [
    { employee_id: null, leave_type: 'Annual Leave', start_date: '2026-04-15', end_date: '2026-04-17', reason: 'Family function', status: 'Approved' },
    { employee_id: null, leave_type: 'Sick Leave', start_date: '2026-04-20', end_date: '2026-04-21', reason: 'Medical appointment', status: 'Pending' },
    { employee_id: null, leave_type: 'Casual Leave', start_date: '2026-05-01', end_date: '2026-05-01', reason: 'Personal work', status: 'Pending' },
    { employee_id: null, leave_type: 'Maternity Leave', start_date: '2026-06-01', end_date: '2026-09-30', reason: 'Maternity', status: 'Approved' },
    { employee_id: null, leave_type: 'Annual Leave', start_date: '2026-07-10', end_date: '2026-07-15', reason: 'Summer vacation', status: 'Pending' },
  ];

  const { error } = await supabase.from('leave_requests').insert(data);
  if (error) throw error;
  return data.length;
}

async function seedAssetsSupabase(): Promise<number> {
  const data = [
    { name: 'Dell Latitude 5520', description: 'Laptop for HR', status: 'In Use', purchase_date: '2024-01-15', purchase_cost: 120000, location: 'HR Office', organization_id: '00000000-0000-0000-0000-000000000000' },
    { name: 'HP LaserJet Pro', description: 'Network printer', status: 'Available', purchase_date: '2023-06-01', purchase_cost: 45000, location: 'Warehouse', organization_id: '00000000-0000-0000-0000-000000000000' },
    { name: 'ZKTeco SpeedFace', description: 'Face recognition device', status: 'In Use', purchase_date: '2024-03-01', purchase_cost: 25000, location: 'Main Gate', organization_id: '00000000-0000-0000-0000-000000000000' },
    { name: 'Cisco Switch 2960', description: '24-port switch', status: 'In Use', purchase_date: '2023-09-15', purchase_cost: 35000, location: 'Server Room', organization_id: '00000000-0000-0000-0000-000000000000' },
    { name: 'APC UPS 3KVA', description: 'Power supply', status: 'In Use', purchase_date: '2023-11-01', purchase_cost: 28000, location: 'Server Room', organization_id: '00000000-0000-0000-0000-000000000000' },
  ];

  const { error } = await supabase.from('assets').insert(data);
  if (error) throw error;
  return data.length;
}

// ── Optional: Sync Supabase → Local SQLite ──────────────────────

async function syncSupabaseToLocal() {
  console.log('🔄 Syncing Supabase data to local SQLite...');

  try {
    // Sync employees
    const { data: emps } = await supabase.from('employees').select('*').limit(50);
    if (emps) {
      for (const emp of emps) {
        try {
          await invoke('upsert_employee_from_cloud', { employeeData: JSON.stringify(emp) });
        } catch { /* skip individual failures */ }
      }
    }
  } catch { /* non-critical */ }

  try {
    // Sync items
    const { data: items } = await supabase.from('items').select('*').limit(50);
    if (items) {
      for (const item of items) {
        try {
          await invoke('upsert_item_from_cloud', { itemData: JSON.stringify(item) });
        } catch { /* skip */ }
      }
    }
  } catch { /* non-critical */ }
}
