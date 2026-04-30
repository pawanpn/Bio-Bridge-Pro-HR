import { invoke } from '@tauri-apps/api/core';
import { isTauriPlatform } from '../utils/platform';
import { organizationService } from './supabaseService';

function getOrgId(): string | null {
  try {
    const stored = localStorage.getItem('biobridge_user');
    if (stored) {
      const user = JSON.parse(stored);
      return user.organization_id || null;
    }
  } catch {}
  try {
    const imp = localStorage.getItem('biobridge_impersonate_user');
    if (imp) {
      const user = JSON.parse(imp);
      return user.organization_id || null;
    }
  } catch {}
  return null;
}

type BranchRaw = { id: number; name: string; location?: string | null; gate_count?: number; device_count?: number; employee_count?: number };
type GateRaw = { id: number; branch_id: number; name: string; device_count?: number };
type DeviceRaw = {
  id: number; name: string; brand: string; ip: string; port: number; comm_key: number;
  machine_number: number; branch_id: number; branch_name: string; gate_id: number;
  gate_name: string; status: string; is_default: boolean;
  subnet_mask?: string; gateway?: string; dns?: string; dhcp?: boolean;
  server_mode?: string; server_address?: string; https_enabled?: boolean;
};

const branchService = {
  async listBranches(): Promise<BranchRaw[]> {
    if (isTauriPlatform()) {
      return invoke<BranchRaw[]>('list_branches');
    }
    const orgId = getOrgId();
    const cloudBranches = await organizationService.listBranches(orgId || undefined);
    return cloudBranches.map((b: any) => ({
      id: b.id,
      name: b.name,
      location: b.location || null,
    }));
  },

  async addBranch(name: string, location?: string | null): Promise<{ success: boolean; id?: string }> {
    if (isTauriPlatform()) {
      await invoke('add_branch', { name, location });
      return { success: true };
    }
    const orgId = getOrgId();
    if (!orgId) throw new Error('Organization not found. Please ensure you are logged in.');
    const result = await organizationService.createBranch({ name, location: location || null, organization_id: orgId });
    return { success: !!result, id: result?.id };
  },

  async updateBranch(id: string | number, name: string, location?: string | null): Promise<{ success: boolean }> {
    if (isTauriPlatform()) {
      await invoke('update_branch', { id: id as number, name, location });
      return { success: true };
    }
    const result = await organizationService.updateBranch(String(id), { name, location });
    return { success: !!result };
  },

  async deleteBranch(id: string | number): Promise<void> {
    if (isTauriPlatform()) {
      await invoke('delete_branch', { id: id as number });
      return;
    }
    await organizationService.deleteBranch(String(id));
  },

  async listGates(branchId?: string | number | null): Promise<GateRaw[]> {
    if (isTauriPlatform()) {
      return invoke<GateRaw[]>('list_gates', { branchId: branchId as number || null });
    }
    const cloudGates = await organizationService.listGates(branchId ? String(branchId) : null);
    return cloudGates.map((g: any) => ({
      id: g.id,
      branch_id: g.branch_id,
      name: g.name,
    }));
  },

  async addGate(branchId: string | number, name: string): Promise<{ success: boolean }> {
    if (isTauriPlatform()) {
      await invoke('add_gate', { branchId: branchId as number, name });
      return { success: true };
    }
    const result = await organizationService.createGate({ branch_id: String(branchId), name });
    return { success: !!result };
  },

  async updateGate(id: string | number, branchId: string | number, name: string): Promise<{ success: boolean }> {
    if (isTauriPlatform()) {
      await invoke('update_gate', { id: id as number, branchId: branchId as number, name });
      return { success: true };
    }
    const result = await organizationService.updateGate(String(id), { name, branch_id: String(branchId) });
    return { success: !!result };
  },

  async deleteGate(id: string | number): Promise<void> {
    if (isTauriPlatform()) {
      await invoke('delete_gate', { id: id as number });
      return;
    }
    await organizationService.deleteGate(String(id));
  },

  async listAllDevices(): Promise<DeviceRaw[]> {
    if (isTauriPlatform()) {
      return invoke<DeviceRaw[]>('list_all_devices');
    }
    const cloudDevices = await organizationService.listDevices();
    return Promise.all(cloudDevices.map(async (d: any) => {
      let branchName = '';
      let gateName = '';
      if (d.branch_id) {
        try {
          const { data: br } = await (await import('../config/supabase')).supabase
            .from('branches').select('name').eq('id', d.branch_id).single();
          branchName = br?.name || '';
        } catch {}
      }
      if (d.gate_id) {
        try {
          const { data: gt } = await (await import('../config/supabase')).supabase
            .from('gates').select('name').eq('id', d.gate_id).single();
          gateName = gt?.name || '';
        } catch {}
      }
      return {
        id: d.id,
        name: d.name,
        brand: d.brand,
        ip: d.ip_address,
        port: d.port,
        comm_key: d.comm_key,
        machine_number: d.machine_number,
        branch_id: d.branch_id,
        branch_name: branchName,
        gate_id: d.gate_id || 0,
        gate_name: gateName,
        status: d.status,
        is_default: d.is_default,
        subnet_mask: d.subnet_mask,
        gateway: d.gateway,
        dns: d.dns,
        dhcp: d.dhcp,
        server_mode: d.server_mode,
        server_address: d.server_address,
        https_enabled: d.https_enabled,
      };
    }));
  },

  async addDevice(device: Record<string, any>): Promise<{ success: boolean }> {
    if (isTauriPlatform()) {
      await invoke('add_device', { device });
      return { success: true };
    }
    const result = await organizationService.createDevice({
      name: device.name, brand: device.brand,
      ip_address: device.ip, port: device.port,
      comm_key: device.comm_key, machine_number: device.machine_number,
      branch_id: String(device.branch_id), gate_id: device.gate_id ? String(device.gate_id) : null,
      subnet_mask: device.subnet_mask, gateway: device.gateway, dns: device.dns,
      dhcp: device.dhcp, server_mode: device.server_mode,
      server_address: device.server_address, https_enabled: device.https_enabled,
    });
    return { success: !!result };
  },

  async updateDevice(id: string | number, device: Record<string, any>): Promise<{ success: boolean }> {
    if (isTauriPlatform()) {
      await invoke('update_device', { id: id as number, device });
      return { success: true };
    }
    const updates: Record<string, any> = {};
    if (device.name !== undefined) updates.name = device.name;
    if (device.brand !== undefined) updates.brand = device.brand;
    if (device.ip !== undefined) updates.ip_address = device.ip;
    if (device.port !== undefined) updates.port = device.port;
    if (device.comm_key !== undefined) updates.comm_key = device.comm_key;
    if (device.machine_number !== undefined) updates.machine_number = device.machine_number;
    if (device.branch_id !== undefined) updates.branch_id = String(device.branch_id);
    if (device.gate_id !== undefined) updates.gate_id = device.gate_id ? String(device.gate_id) : null;
    const result = await organizationService.updateDevice(String(id), updates);
    return { success: !!result };
  },

  async deleteDevice(id: string | number): Promise<void> {
    if (isTauriPlatform()) {
      await invoke('delete_device', { id: id as number });
      return;
    }
    await organizationService.deleteDevice(String(id));
  },

  async setDefaultDevice(id: string | number): Promise<void> {
    if (isTauriPlatform()) {
      await invoke('set_default_device', { id: id as number });
      return;
    }
    await organizationService.setDefaultDevice(String(id));
  },

  async syncDeviceLogs(params: { ip: string; port: number; deviceId: string | number; brand: string; targetBranchId: number; targetGateId: number }): Promise<string> {
    if (isTauriPlatform()) {
      return invoke<string>('sync_device_logs', params);
    }
    return 'Sync from device logs is only supported in the desktop app.';
  },

  async syncEmployeesToDevice(deviceId: string | number): Promise<{ success: boolean; synced: number; failed: number; error?: string }> {
    if (isTauriPlatform()) {
      return invoke('sync_employees_to_device', { deviceId: deviceId as number });
    }
    return { success: false, synced: 0, failed: 0, error: 'Device sync is only supported in the desktop app.' };
  },

  async testDeviceConnection(params: { ip: string; port: number; commKey: number; machineNumber: number; brand: string }): Promise<void> {
    if (isTauriPlatform()) {
      await invoke('test_device_connection', params);
      return;
    }
    throw new Error('Device connection testing is only supported in the desktop app.');
  },

  async updateDeviceStatus(ip: string, status: string): Promise<void> {
    if (isTauriPlatform()) {
      await invoke('update_device_status', { ip, status });
      return;
    }
  },

  // ── DEPARTMENTS ─────────────────────────────────────────────────────

  async listDepartments(): Promise<{ id: string | number; name: string; branch_id?: string | number }[]> {
    if (isTauriPlatform()) {
      return invoke<any[]>('list_departments');
    }
    const orgId = getOrgId();
    const depts = await organizationService.listDepartments(orgId || undefined);
    return depts.map((d: any) => ({ id: d.id, name: d.name }));
  },

  async createDepartment(name: string, branchId?: number | null): Promise<{ success: boolean }> {
    if (isTauriPlatform()) {
      await invoke('create_department', { name, branchId });
      return { success: true };
    }
    const orgId = getOrgId();
    if (!orgId) throw new Error('Organization not found');
    const result = await organizationService.createDepartment({ name, organization_id: orgId });
    return { success: !!result };
  },

  async deleteDepartment(id: string | number): Promise<void> {
    if (isTauriPlatform()) {
      await invoke('delete_department', { id: id as number });
      return;
    }
    await organizationService.deleteDepartment(String(id));
  },

  // ── DESIGNATIONS ─────────────────────────────────────────────────────

  async listDesignations(): Promise<{ id: string | number; name: string; branch_id?: string | number }[]> {
    if (isTauriPlatform()) {
      return invoke<any[]>('list_designations');
    }
    const orgId = getOrgId();
    const desigs = await organizationService.listDesignations(orgId || undefined);
    return desigs.map((d: any) => ({ id: d.id, name: d.name }));
  },

  async createDesignation(name: string, branchId?: number | null): Promise<{ success: boolean }> {
    if (isTauriPlatform()) {
      await invoke('create_designation', { name, branchId });
      return { success: true };
    }
    const orgId = getOrgId();
    if (!orgId) throw new Error('Organization not found');
    const result = await organizationService.createDesignation({ name, organization_id: orgId });
    return { success: !!result };
  },

  async deleteDesignation(id: string | number): Promise<void> {
    if (isTauriPlatform()) {
      await invoke('delete_designation', { id: id as number });
      return;
    }
    await organizationService.deleteDesignation(String(id));
  },

  // ── ORGANIZATION ──────────────────────────────────────────────────────

  async getOrganization(): Promise<{ id: string; name: string } | null> {
    if (isTauriPlatform()) {
      return null;
    }
    const orgId = getOrgId();
    if (!orgId) return null;
    return organizationService.getById(orgId);
  },

  // ── MIGRATION ─────────────────────────────────────────────────────────

  async getBranchSummary(id: string | number): Promise<{ employee_count: number; device_count: number; gate_count: number; attendance_logs: number; leave_requests: number }> {
    if (isTauriPlatform()) {
      return invoke('get_branch_summary', { id: id as number });
    }
    return { employee_count: 0, device_count: 0, gate_count: 0, attendance_logs: 0, leave_requests: 0 };
  },

  async migrateBranchData(fromId: string | number, toId: string | number, tables: string[]): Promise<{ success: boolean; message: string }> {
    if (isTauriPlatform()) {
      return invoke('migrate_branch_data', { fromId: fromId as number, toId: toId as number, tables });
    }
    return { success: false, message: 'Branch migration is only supported in the desktop app.' };
  },
};

export default branchService;
