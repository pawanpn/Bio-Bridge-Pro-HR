import { supabase } from '@/config/supabase';
import { invoke } from '@tauri-apps/api/core';

export interface SeedResult {
  module: string;
  recordsCreated: number;
  errors: string[];
}

export async function seedDatabase(): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  const errors: string[] = [];

  console.log('🌱 Starting database seed...');

  // 1. Seed Employees
  try {
    const employees = await seedEmployees();
    results.push({ module: 'Employees', recordsCreated: employees, errors: [] });
    console.log(`✅ Seeded ${employees} employees`);
  } catch (e: any) {
    results.push({ module: 'Employees', recordsCreated: 0, errors: [e.message] });
  }

  // 2. Seed Inventory Items
  try {
    const items = await seedInventory();
    results.push({ module: 'Inventory', recordsCreated: items, errors: [] });
    console.log(`✅ Seeded ${items} inventory items`);
  } catch (e: any) {
    results.push({ module: 'Inventory', recordsCreated: 0, errors: [e.message] });
  }

  // 3. Seed CRM Leads
  try {
    const leads = await seedCRMLeads();
    results.push({ module: 'CRM', recordsCreated: leads, errors: [] });
    console.log(`✅ Seeded ${leads} CRM leads`);
  } catch (e: any) {
    results.push({ module: 'CRM', recordsCreated: 0, errors: [e.message] });
  }

  // 4. Seed Projects
  try {
    const projects = await seedProjects();
    results.push({ module: 'Projects', recordsCreated: projects, errors: [] });
    console.log(`✅ Seeded ${projects} projects`);
  } catch (e: any) {
    results.push({ module: 'Projects', recordsCreated: 0, errors: [e.message] });
  }

  // 5. Seed Leave Requests
  try {
    const leaves = await seedLeaveRequests();
    results.push({ module: 'Leave Requests', recordsCreated: leaves, errors: [] });
    console.log(`✅ Seeded ${leaves} leave requests`);
  } catch (e: any) {
    results.push({ module: 'Leave Requests', recordsCreated: 0, errors: [e.message] });
  }

  console.log('🌱 Database seed complete!');
  return results;
}

async function seedEmployees(): Promise<number> {
  const dummyEmployees = [
    {
      employee_code: 'EMP-SEED-001',
      first_name: 'Rajesh',
      middle_name: 'Kumar',
      last_name: 'Sharma',
      personal_email: 'rajesh.sharma@biobridge.com',
      personal_phone: '9841000001',
      branch_id: '1',
      employment_status: 'Active',
      date_of_joining: '2024-01-15',
      employment_type: 'Full-time',
    },
    {
      employee_code: 'EMP-SEED-002',
      first_name: 'Sita',
      middle_name: '',
      last_name: 'Magar',
      personal_email: 'sita.magar@biobridge.com',
      personal_phone: '9841000002',
      branch_id: '1',
      employment_status: 'Active',
      date_of_joining: '2024-03-20',
      employment_type: 'Full-time',
    },
    {
      employee_code: 'EMP-SEED-003',
      first_name: 'Bikash',
      middle_name: 'Bahadur',
      last_name: 'Thapa',
      personal_email: 'bikash.thapa@biobridge.com',
      personal_phone: '9841000003',
      branch_id: '2',
      employment_status: 'Active',
      date_of_joining: '2024-06-10',
      employment_type: 'Contract',
    },
    {
      employee_code: 'EMP-SEED-004',
      first_name: 'Anita',
      middle_name: '',
      last_name: 'Gurung',
      personal_email: 'anita.gurung@biobridge.com',
      personal_phone: '9841000004',
      branch_id: '2',
      employment_status: 'On Leave',
      date_of_joining: '2023-11-05',
      employment_type: 'Full-time',
    },
    {
      employee_code: 'EMP-SEED-005',
      first_name: 'Sanjay',
      middle_name: 'Prasad',
      last_name: 'Pokharel',
      personal_email: 'sanjay.pokharel@biobridge.com',
      personal_phone: '9841000005',
      branch_id: '1',
      employment_status: 'Active',
      date_of_joining: '2024-08-01',
      employment_type: 'Part-time',
    },
  ];

  // Insert to Supabase first (FINAL DESTINATION)
  const { error } = await supabase
    .from('employees')
    .upsert(dummyEmployees, { onConflict: 'employee_code', ignoreDuplicates: true });

  if (error) throw error;

  // Sync to local SQLite
  for (const emp of dummyEmployees) {
    try {
      await invoke('upsert_employee_from_cloud', {
        employeeData: JSON.stringify(emp),
      });
    } catch {
      // Local sync failed but cloud has data - that's OK
    }
  }

  return dummyEmployees.length;
}

async function seedInventory(): Promise<number> {
  const dummyItems = [
    {
      item_code: 'INV-001',
      item_name: 'ZKTeco SpeedFace V5L', // Supabase uses item_name
      name: 'ZKTeco SpeedFace V5L', // For TypeScript compatibility
      description: 'Face recognition attendance device',
      category: 'Hardware',
      quantity: 15,
      unit_price: 25000,
      reorder_level: 5,
      supplier: 'ZKTeco Nepal',
      location: 'Warehouse A',
    },
    {
      item_code: 'INV-002',
      item_name: 'Hikvision DS-K1T804MF',
      name: 'Hikvision DS-K1T804MF',
      description: 'Fingerprint & card reader',
      category: 'Hardware',
      quantity: 8,
      unit_price: 18000,
      reorder_level: 3,
      supplier: 'Hikvision Distributor',
      location: 'Warehouse A',
    },
    {
      item_code: 'INV-003',
      item_name: 'Cat6 Network Cable (100m)',
      name: 'Cat6 Network Cable (100m)',
      description: 'Ethernet cable for device connectivity',
      category: 'Networking',
      quantity: 50,
      unit_price: 3500,
      reorder_level: 10,
      supplier: 'Cable World',
      location: 'Warehouse B',
    },
    {
      item_code: 'INV-004',
      item_name: 'Biometric Cards (Pack of 100)',
      name: 'Biometric Cards (Pack of 100)',
      description: 'RFID proximity cards for attendance',
      category: 'Accessories',
      quantity: 200,
      unit_price: 5000,
      reorder_level: 50,
      supplier: 'Card Solutions Nepal',
      location: 'Warehouse B',
    },
    {
      item_code: 'INV-005',
      item_name: 'UPS 1KVA',
      name: 'UPS 1KVA',
      description: 'Uninterruptible power supply for devices',
      category: 'Power',
      quantity: 10,
      unit_price: 12000,
      reorder_level: 2,
      supplier: 'PowerTech Nepal',
      location: 'Warehouse A',
    },
  ];

  // Map to Supabase column names (item_name not name)
  const dbItems = dummyItems.map(item => ({
    item_code: item.item_code,
    item_name: item.item_name,
    description: item.description,
    category: item.category,
    quantity: item.quantity,
    unit_price: item.unit_price,
    reorder_level: item.reorder_level,
    supplier: item.supplier,
    location: item.location,
  }));

  const { error } = await supabase
    .from('items')
    .upsert(dbItems, { onConflict: 'item_code', ignoreDuplicates: true });

  if (error) throw error;

  return dummyItems.length;
}

async function seedCRMLeads(): Promise<number> {
  const dummyLeads = [
    {
      name: 'ABC Manufacturing Pvt Ltd',
      contact_person: 'Ram Bahadur',
      email: 'ram@abcmanufacturing.com',
      phone: '9841111111',
      status: 'New',
      source: 'Website',
      estimated_value: 500000,
      notes: 'Interested in 50-device deployment',
    },
    {
      name: 'XYZ Construction',
      contact_person: 'Sita Devi',
      email: 'sita@xyzconstruction.com',
      phone: '9841222222',
      status: 'Contacted',
      source: 'Referral',
      estimated_value: 750000,
      notes: 'Multi-branch attendance system needed',
    },
    {
      name: 'Global Tech Solutions',
      contact_person: 'Hari Prasad',
      email: 'hari@globaltech.com',
      phone: '9841333333',
      status: 'Qualified',
      source: 'LinkedIn',
      estimated_value: 1200000,
      notes: 'Enterprise HRMS + Biometric integration',
    },
    {
      name: 'Mountain View Hospital',
      contact_person: 'Dr. Sharma',
      email: 'admin@mountainview.com',
      phone: '9841444444',
      status: 'Proposal',
      source: 'Direct',
      estimated_value: 350000,
      notes: 'Staff attendance + shift management',
    },
    {
      name: 'Nepal Education Board',
      contact_person: 'Director Office',
      email: 'info@neb.gov.np',
      phone: '9841555555',
      status: 'Negotiation',
      source: 'Government Tender',
      estimated_value: 2000000,
      notes: 'Nationwide deployment across 20 branches',
    },
  ];

  const { error } = await supabase
    .from('crm_leads')
    .upsert(dummyLeads, { onConflict: 'id', ignoreDuplicates: false });

  if (error) {
    // Table might not exist, try creating it first
    console.log('CRM leads table may need creation, skipping...');
    return 0;
  }

  return dummyLeads.length;
}

async function seedProjects(): Promise<number> {
  const dummyProjects = [
    {
      name: 'Kathmandu Office Deployment',
      description: 'Install 25 attendance devices across all floors',
      status: 'In Progress',
      start_date: '2026-01-15',
      end_date: '2026-04-30',
      budget: 1500000,
      assigned_to: 'Rajesh Sharma',
    },
    {
      name: 'HRMS Integration Project',
      description: 'Integrate biometric data with payroll system',
      status: 'Planning',
      start_date: '2026-05-01',
      end_date: '2026-08-31',
      budget: 800000,
      assigned_to: 'Bikash Thapa',
    },
    {
      name: 'Cloud Migration',
      description: 'Migrate all device logs to Supabase cloud',
      status: 'Completed',
      start_date: '2025-11-01',
      end_date: '2026-02-28',
      budget: 500000,
      assigned_to: 'Sanjay Pokharel',
    },
    {
      name: 'Mobile App Development',
      description: 'Employee self-service mobile application',
      status: 'In Progress',
      start_date: '2026-03-01',
      end_date: '2026-09-30',
      budget: 2000000,
      assigned_to: 'Anita Gurung',
    },
    {
      name: 'Security Upgrade',
      description: 'Upgrade all devices to latest firmware',
      status: 'On Hold',
      start_date: '2026-06-01',
      end_date: '2026-07-31',
      budget: 300000,
      assigned_to: 'Sita Magar',
    },
  ];

  const { error } = await supabase
    .from('projects')
    .upsert(dummyProjects, { onConflict: 'id', ignoreDuplicates: false });

  if (error) {
    console.log('Projects table may need creation, skipping...');
    return 0;
  }

  return dummyProjects.length;
}

async function seedLeaveRequests(): Promise<number> {
  const dummyLeaves = [
    {
      employee_id: 1,
      leave_type: 'Annual Leave',
      start_date: '2026-04-15',
      end_date: '2026-04-17',
      reason: 'Family function',
      status: 'Approved',
    },
    {
      employee_id: 2,
      leave_type: 'Sick Leave',
      start_date: '2026-04-20',
      end_date: '2026-04-21',
      reason: 'Medical appointment',
      status: 'Pending',
    },
    {
      employee_id: 3,
      leave_type: 'Casual Leave',
      start_date: '2026-05-01',
      end_date: '2026-05-01',
      reason: 'Personal work',
      status: 'Pending',
    },
    {
      employee_id: 4,
      leave_type: 'Maternity Leave',
      start_date: '2026-06-01',
      end_date: '2026-09-30',
      reason: 'Maternity',
      status: 'Approved',
    },
    {
      employee_id: 5,
      leave_type: 'Annual Leave',
      start_date: '2026-07-10',
      end_date: '2026-07-15',
      reason: 'Summer vacation',
      status: 'Pending',
    },
  ];

  const { error } = await supabase
    .from('leave_requests')
    .upsert(dummyLeaves, { onConflict: 'id', ignoreDuplicates: false });

  if (error) throw error;

  return dummyLeaves.length;
}
