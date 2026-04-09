import { supabase } from '@/config/supabase';
import { invoke } from '@tauri-apps/api/core';

export interface RebuildStats {
  employees: number;
  attendance: number;
  leaveRequests: number;
  items: number;
  branches: number;
  gates: number;
  devices: number;
  errors: string[];
}

/**
 * REBUILD LOCAL FROM CLOUD
 * Fetches EVERYTHING from Supabase and rebuilds local biobridge_pro.db from scratch
 * Used when installing on a NEW PC or for disaster recovery
 */
export async function rebuildLocalFromCloud(): Promise<RebuildStats> {
  const stats: RebuildStats = {
    employees: 0,
    attendance: 0,
    leaveRequests: 0,
    items: 0,
    branches: 0,
    gates: 0,
    devices: 0,
    errors: [],
  };

  console.log('🔄 Starting full cloud-to-local rebuild...');

  try {
    // 1. Rebuild Employees
    stats.employees = await rebuildEmployees();
    console.log(`✅ Rebuilt ${stats.employees} employees`);

    // 2. Rebuild Attendance Logs
    stats.attendance = await rebuildAttendance();
    console.log(`✅ Rebuilt ${stats.attendance} attendance logs`);

    // 3. Rebuild Leave Requests
    stats.leaveRequests = await rebuildLeaveRequests();
    console.log(`✅ Rebuilt ${stats.leaveRequests} leave requests`);

    // 4. Rebuild Inventory Items
    stats.items = await rebuildItems();
    console.log(`✅ Rebuilt ${stats.items} inventory items`);

    // 5. Rebuild Branches
    stats.branches = await rebuildBranches();
    console.log(`✅ Rebuilt ${stats.branches} branches`);

    // 6. Rebuild Gates
    stats.gates = await rebuildGates();
    console.log(`✅ Rebuilt ${stats.gates} gates`);

    // 7. Rebuild Devices
    stats.devices = await rebuildDevices();
    console.log(`✅ Rebuilt ${stats.devices} devices`);

    console.log('✅ Full cloud-to-local rebuild complete!');

    // Notify app that data has been synced
    window.dispatchEvent(new CustomEvent('data-synced', { detail: { source: 'rebuild' } }));
  } catch (error: any) {
    stats.errors.push(error.message);
    console.error('❌ Rebuild failed:', error);
  }

  return stats;
}

async function rebuildEmployees(): Promise<number> {
  let count = 0;
  let page = 0;
  const pageSize = 100;

  while (true) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !data || data.length === 0) break;

    for (const emp of data) {
      try {
        await invoke('upsert_employee_from_cloud', {
          employeeData: JSON.stringify(emp),
        });
        count++;
      } catch (e: any) {
        console.warn(`Failed to sync employee ${emp.employee_code}:`, e.message);
      }
    }

    if (data.length < pageSize) break;
    page++;
  }

  return count;
}

async function rebuildAttendance(): Promise<number> {
  let count = 0;
  let page = 0;
  const pageSize = 100;

  while (true) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !data || data.length === 0) break;

    for (const log of data) {
      try {
        await invoke('insert_attendance_from_cloud', {
          attendanceData: JSON.stringify(log),
        });
        count++;
      } catch {
        // Skip duplicates
      }
    }

    if (data.length < pageSize) break;
    page++;
  }

  return count;
}

async function rebuildLeaveRequests(): Promise<number> {
  let count = 0;
  let page = 0;
  const pageSize = 100;

  while (true) {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !data || data.length === 0) break;

    for (const leave of data) {
      try {
        await invoke('upsert_leave_from_cloud', {
          leaveData: JSON.stringify(leave),
        });
        count++;
      } catch {
        // Skip duplicates
      }
    }

    if (data.length < pageSize) break;
    page++;
  }

  return count;
}

async function rebuildItems(): Promise<number> {
  const { data, error } = await supabase.from('items').select('*');
  
  if (error || !data) return 0;

  let count = 0;
  for (const item of data) {
    try {
      await invoke('upsert_item_from_cloud', {
        itemData: JSON.stringify(item),
      });
      count++;
    } catch {
      // Skip duplicates
    }
  }

  return count;
}

async function rebuildBranches(): Promise<number> {
  const { data, error } = await supabase.from('branches').select('*');
  
  if (error || !data) return 0;

  let count = 0;
  for (const branch of data) {
    try {
      await invoke('upsert_branch_from_cloud', {
        branchData: JSON.stringify(branch),
      });
      count++;
    } catch {
      // Skip duplicates
    }
  }

  return count;
}

async function rebuildGates(): Promise<number> {
  const { data, error } = await supabase.from('gates').select('*');
  
  if (error || !data) return 0;

  let count = 0;
  for (const gate of data) {
    try {
      await invoke('upsert_gate_from_cloud', {
        gateData: JSON.stringify(gate),
      });
      count++;
    } catch {
      // Skip duplicates
    }
  }

  return count;
}

async function rebuildDevices(): Promise<number> {
  const { data, error } = await supabase.from('devices').select('*');
  
  if (error || !data) return 0;

  let count = 0;
  for (const device of data) {
    try {
      await invoke('upsert_device_from_cloud', {
        deviceData: JSON.stringify(device),
      });
      count++;
    } catch {
      // Skip duplicates
    }
  }

  return count;
}
