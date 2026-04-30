/**
 * BioBridge Pro ERP - Supabase Service Layer
 * 
 * This service provides typed CRUD operations for all ERP modules
 * using Supabase with UUID-based schema.
 */

import { supabase } from '../config/supabase';

// ============================================================================
// TYPE DEFINITIONS (UUID-based)
// ============================================================================

export interface Item {
  id: string; // UUID
  item_code: string;
  name: string; // Maps to item_name in Supabase
  description?: string | null;
  category: string;
  quantity: number;
  unit_price: number;
  reorder_level: number;
  supplier?: string | null;
  location?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Helper to convert between TS interface and Supabase columns
export const toItemDB = (item: Partial<Item>) => ({
  item_code: item.item_code,
  item_name: item.name, // TS 'name' → DB 'item_name'
  description: item.description,
  category: item.category,
  quantity: item.quantity,
  unit_price: item.unit_price,
  reorder_level: item.reorder_level,
  supplier: item.supplier,
  location: item.location,
  is_active: item.is_active,
});

export const fromItemDB = (row: any): Item => ({
  id: row.id,
  item_code: row.item_code,
  name: row.item_name || row.name, // DB 'item_name' → TS 'name'
  description: row.description,
  category: row.category,
  quantity: row.quantity,
  unit_price: row.unit_price,
  reorder_level: row.reorder_level,
  supplier: row.supplier,
  location: row.location,
  is_active: row.is_active,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export interface Project {
  id: string; // UUID
  project_code: string;
  name: string;
  description?: string | null;
  status: string;
  priority: string;
  start_date: string;
  end_date?: string | null;
  budget: number;
  manager_id?: string | null; // UUID
  manager_name?: string;
  progress: number;
  team_size: number;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string; // UUID
  lead_code: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
  source: string;
  value: number;
  assigned_to?: string | null; // UUID
  assigned_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string; // UUID
  asset_code: string;
  name: string;
  description?: string | null;
  category: string;
  status: string;
  purchase_date: string;
  purchase_cost: number;
  assigned_to?: string | null;
  location?: string | null;
  warranty_expiry?: string | null;
  condition: string;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string; // UUID
  employee_code: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  full_name: string;
  date_of_birth?: string | null;
  gender?: string | null;
  personal_email?: string | null;
  personal_phone?: string | null;
  current_address?: string | null;
  permanent_address?: string | null;
  department_id?: string | null;
  designation_id?: string | null;
  branch_id?: string | null;
  date_of_joining?: string | null;
  employment_type: string;
  employment_status: string;
  reporting_manager_id?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string; // UUID
  sender_id?: string | null; // UUID - references public.users(id)
  sender_name?: string | null;
  receiver_id?: string | null; // UUID
  receiver_type: string;
  branch_id?: string | null; // UUID
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  expires_at?: string | null;
}

// ============================================================================
// INVENTORY SERVICE
// ============================================================================

export const inventoryService = {
  /**
   * Get all inventory items
   */
  async getAll(): Promise<Item[]> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('item_code', { ascending: true });

    if (error) {
      console.error('Failed to fetch items:', error);
      throw error;
    }

    return (data || []).map(fromItemDB);
  },

  /**
   * Get item by ID
   */
  async getById(id: string): Promise<Item | null> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to fetch item:', error);
      return null;
    }

    return data;
  },

  /**
   * Create new inventory item
   */
  async create(item: Omit<Item, 'id' | 'item_code' | 'created_at' | 'updated_at'>): Promise<Item> {
    const itemCode = `ITM-${Date.now().toString().slice(-6).padStart(6, '0')}`;
    
    const { data, error } = await supabase
      .from('items')
      .insert([{
        ...item,
        item_code: itemCode,
      }])
      .select()
      .single();

    if (error) {
      console.error('Failed to create item:', error);
      throw error;
    }

    return data;
  },

  /**
   * Update inventory item
   */
  async update(id: string, updates: Partial<Omit<Item, 'id' | 'created_at' | 'updated_at'>>): Promise<Item> {
    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update item:', error);
      throw error;
    }

    return data;
  },

  /**
   * Soft delete inventory item
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('items')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Failed to delete item:', error);
      throw error;
    }
  },

  /**
   * Update stock quantity
   */
  async updateStock(id: string, adjustment: number): Promise<Item> {
    const { data: item } = await supabase
      .from('items')
      .select('quantity')
      .eq('id', id)
      .single();

    if (!item) {
      throw new Error('Item not found');
    }

    const newQuantity = item.quantity + adjustment;

    const { data, error } = await supabase
      .from('items')
      .update({ quantity: newQuantity })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update stock:', error);
      throw error;
    }

    return data;
  },

  /**
   * Get inventory statistics
   */
  async getStats(): Promise<{
    total_items: number;
    total_value: number;
    low_stock: number;
    out_of_stock: number;
  }> {
    const { data: items } = await supabase
      .from('items')
      .select('quantity, unit_price, reorder_level');

    if (!items) {
      return { total_items: 0, total_value: 0, low_stock: 0, out_of_stock: 0 };
    }

    const total_items = items.length;
    const total_value = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const low_stock = items.filter(item => item.quantity <= item.reorder_level && item.quantity > 0).length;
    const out_of_stock = items.filter(item => item.quantity === 0).length;

    return { total_items, total_value, low_stock, out_of_stock };
  },
};

// ============================================================================
// PROJECTS SERVICE
// ============================================================================

export const projectsService = {
  /**
   * Get all projects
   */
  async getAll(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch projects:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get project by ID
   */
  async getById(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to fetch project:', error);
      return null;
    }

    return data;
  },

  /**
   * Create new project
   */
  async create(project: Omit<Project, 'id' | 'project_code' | 'created_at' | 'updated_at' | 'progress' | 'team_size'>): Promise<Project> {
    const projectCode = `PRJ-${Date.now().toString().slice(-6).padStart(6, '0')}`;
    
    const { data, error } = await supabase
      .from('projects')
      .insert([{
        ...project,
        project_code: projectCode,
        progress: 0,
        team_size: 0,
      }])
      .select()
      .single();

    if (error) {
      console.error('Failed to create project:', error);
      throw error;
    }

    return data;
  },

  /**
   * Update project
   */
  async update(id: string, updates: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update project:', error);
      throw error;
    }

    return data;
  },

  /**
   * Delete project
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  },

  /**
   * Get project statistics
   */
  async getStats(): Promise<{
    total_projects: number;
    active_projects: number;
    completed_projects: number;
    overdue_projects: number;
  }> {
    const { data: projects } = await supabase
      .from('projects')
      .select('status, end_date');

    if (!projects) {
      return { total_projects: 0, active_projects: 0, completed_projects: 0, overdue_projects: 0 };
    }

    const today = new Date().toISOString().split('T')[0];
    
    return {
      total_projects: projects.length,
      active_projects: projects.filter(p => p.status === 'Active').length,
      completed_projects: projects.filter(p => p.status === 'Completed').length,
      overdue_projects: projects.filter(p => p.status === 'Active' && p.end_date && p.end_date < today).length,
    };
  },

  /**
   * Update project progress
   */
  async updateProgress(id: string, progress: number): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update({ progress: Math.min(100, Math.max(0, progress)) })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update progress:', error);
      throw error;
    }

    return data;
  },
};

// ============================================================================
// CRM SERVICE
// ============================================================================

export const crmService = {
  /**
   * Get all leads
   */
  async getAll(): Promise<Lead[]> {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch leads:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get lead by ID
   */
  async getById(id: string): Promise<Lead | null> {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to fetch lead:', error);
      return null;
    }

    return data;
  },

  /**
   * Create new lead
   */
  async create(lead: Omit<Lead, 'id' | 'lead_code' | 'created_at' | 'updated_at'>): Promise<Lead> {
    const leadCode = `LEAD-${Date.now().toString().slice(-6).padStart(6, '0')}`;
    
    const { data, error } = await supabase
      .from('leads')
      .insert([{
        ...lead,
        lead_code: leadCode,
      }])
      .select()
      .single();

    if (error) {
      console.error('Failed to create lead:', error);
      throw error;
    }

    return data;
  },

  /**
   * Update lead
   */
  async update(id: string, updates: Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at'>>): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update lead:', error);
      throw error;
    }

    return data;
  },

  /**
   * Delete lead
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete lead:', error);
      throw error;
    }
  },

  /**
   * Get CRM statistics
   */
  async getStats(): Promise<{
    total_leads: number;
    new_leads: number;
    qualified_leads: number;
    converted_leads: number;
    total_pipeline_value: number;
  }> {
    const { data: leads } = await supabase
      .from('leads')
      .select('status, value');

    if (!leads) {
      return { total_leads: 0, new_leads: 0, qualified_leads: 0, converted_leads: 0, total_pipeline_value: 0 };
    }

    return {
      total_leads: leads.length,
      new_leads: leads.filter(l => l.status === 'New').length,
      qualified_leads: leads.filter(l => l.status === 'Qualified').length,
      converted_leads: leads.filter(l => l.status === 'Won').length,
      total_pipeline_value: leads.reduce((sum, lead) => sum + (lead.value || 0), 0),
    };
  },
};

// ============================================================================
// ASSETS SERVICE
// ============================================================================

export const assetsService = {
  /**
   * Get all assets
   */
  async getAll(): Promise<Asset[]> {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch assets:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get asset by ID
   */
  async getById(id: string): Promise<Asset | null> {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to fetch asset:', error);
      return null;
    }

    return data;
  },

  /**
   * Create new asset
   */
  async create(asset: Omit<Asset, 'id' | 'asset_code' | 'created_at' | 'updated_at'>): Promise<Asset> {
    const assetCode = `AST-${Date.now().toString().slice(-6).padStart(6, '0')}`;
    
    const { data, error } = await supabase
      .from('assets')
      .insert([{
        ...asset,
        asset_code: assetCode,
      }])
      .select()
      .single();

    if (error) {
      console.error('Failed to create asset:', error);
      throw error;
    }

    return data;
  },

  /**
   * Update asset
   */
  async update(id: string, updates: Partial<Omit<Asset, 'id' | 'created_at' | 'updated_at'>>): Promise<Asset> {
    const { data, error } = await supabase
      .from('assets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update asset:', error);
      throw error;
    }

    return data;
  },

  /**
   * Delete asset
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete asset:', error);
      throw error;
    }
  },

  /**
   * Get asset statistics
   */
  async getStats(): Promise<{
    total_assets: number;
    active_assets: number;
    maintenance_assets: number;
    retired_assets: number;
    total_value: number;
  }> {
    const { data: assets } = await supabase
      .from('assets')
      .select('status, purchase_cost');

    if (!assets) {
      return { total_assets: 0, active_assets: 0, maintenance_assets: 0, retired_assets: 0, total_value: 0 };
    }

    return {
      total_assets: assets.length,
      active_assets: assets.filter(a => a.status === 'Active').length,
      maintenance_assets: assets.filter(a => a.status === 'Maintenance').length,
      retired_assets: assets.filter(a => a.status === 'Retired' || a.status === 'Disposed').length,
      total_value: assets.reduce((sum, asset) => sum + (asset.purchase_cost || 0), 0),
    };
  },
};

// ============================================================================
// NOTIFICATIONS SERVICE
// ============================================================================

// ============================================================================
// ORGANIZATION SERVICE (Branches, Gates, Devices)
// ============================================================================

export interface Branch {
  id: string;
  organization_id?: string;
  name: string;
  code?: string | null;
  location?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Gate {
  id: string;
  branch_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  name: string;
  brand: string;
  ip_address: string;
  port: number;
  comm_key: number;
  machine_number: number;
  branch_id: string;
  gate_id?: string | null;
  is_default: boolean;
  status: string;
  subnet_mask?: string | null;
  gateway?: string | null;
  dns?: string | null;
  dhcp: boolean;
  server_mode: string;
  server_address?: string | null;
  https_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  organization_id?: string;
  parent_id?: string | null;
  name: string;
  code?: string | null;
  description?: string | null;
  head_id?: string | null;
  budget?: number | null;
  cost_center?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Designation {
  id: string;
  organization_id?: string;
  name: string;
  code?: string | null;
  level: number;
  grade?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  legal_name?: string | null;
  registration_number?: string | null;
  tax_number?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  is_active: boolean;
  subscription_plan?: string;
  max_users?: number | null;
  created_at: string;
  updated_at: string;
}

export const organizationService = {
  async getById(id: string): Promise<Organization | null> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();
    if (error) { console.error('Failed to fetch organization:', error); return null; }
    return data;
  },

  // ── BRANCHES ──────────────────────────────────────────────────────────

  async listBranches(organizationId?: string): Promise<Branch[]> {
    let query = supabase.from('branches').select('*').eq('is_active', true).order('name');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) { console.error('Failed to fetch branches:', error); return []; }
    return data || [];
  },

  async createBranch(branch: { name: string; location?: string | null; organization_id: string }): Promise<Branch | null> {
    const { data, error } = await supabase
      .from('branches')
      .insert({ name: branch.name, location: branch.location || null, organization_id: branch.organization_id, is_active: true })
      .select()
      .single();
    if (error) { console.error('Failed to create branch:', error); return null; }
    return data;
  },

  async updateBranch(id: string, updates: { name?: string; location?: string | null }): Promise<Branch | null> {
    const { data, error } = await supabase
      .from('branches')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('Failed to update branch:', error); return null; }
    return data;
  },

  async deleteBranch(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('branches')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { console.error('Failed to delete branch:', error); return false; }
    return true;
  },

  // ── GATES ─────────────────────────────────────────────────────────────

  async listGates(branchId?: string | null): Promise<Gate[]> {
    let query = supabase.from('gates').select('*').order('name');
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    const { data, error } = await query;
    if (error) { console.error('Failed to fetch gates:', error); return []; }
    return data || [];
  },

  async createGate(gate: { branch_id: string; name: string }): Promise<Gate | null> {
    const { data, error } = await supabase
      .from('gates')
      .insert({ branch_id: gate.branch_id, name: gate.name })
      .select()
      .single();
    if (error) { console.error('Failed to create gate:', error); return null; }
    return data;
  },

  async updateGate(id: string, updates: { name?: string; branch_id?: string }): Promise<Gate | null> {
    const { data, error } = await supabase
      .from('gates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('Failed to update gate:', error); return null; }
    return data;
  },

  async deleteGate(id: string): Promise<boolean> {
    const { error } = await supabase.from('gates').delete().eq('id', id);
    if (error) { console.error('Failed to delete gate:', error); return false; }
    return true;
  },

  // ── DEVICES ───────────────────────────────────────────────────────────

  async listDevices(): Promise<Device[]> {
    const { data, error } = await supabase.from('devices').select('*').order('name');
    if (error) { console.error('Failed to fetch devices:', error); return []; }
    return data || [];
  },

  async listDevicesByBranch(branchId: string): Promise<Device[]> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('branch_id', branchId)
      .order('name');
    if (error) { console.error('Failed to fetch devices by branch:', error); return []; }
    return data || [];
  },

  async createDevice(device: {
    name: string; brand: string; ip_address: string; port: number;
    comm_key: number; machine_number: number; branch_id: string; gate_id?: string | null;
    subnet_mask?: string; gateway?: string; dns?: string; dhcp?: boolean;
    server_mode?: string; server_address?: string; https_enabled?: boolean;
  }): Promise<Device | null> {
    const { data, error } = await supabase
      .from('devices')
      .insert({
        name: device.name, brand: device.brand || 'ZKTeco',
        ip_address: device.ip_address, port: device.port || 4370,
        comm_key: device.comm_key || 0, machine_number: device.machine_number || 1,
        branch_id: device.branch_id, gate_id: device.gate_id || null,
        is_default: false, status: 'offline',
        subnet_mask: device.subnet_mask || '255.255.255.0',
        gateway: device.gateway || '192.168.1.1',
        dns: device.dns || '8.8.8.8',
        dhcp: device.dhcp || false,
        server_mode: device.server_mode || 'Standalone',
        server_address: device.server_address || '0.0.0.0',
        https_enabled: device.https_enabled || false,
      })
      .select()
      .single();
    if (error) { console.error('Failed to create device:', error); return null; }
    return data;
  },

  async updateDevice(id: string, updates: Record<string, any>): Promise<Device | null> {
    const { data, error } = await supabase
      .from('devices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('Failed to update device:', error); return null; }
    return data;
  },

  async deleteDevice(id: string): Promise<boolean> {
    const { error } = await supabase.from('devices').delete().eq('id', id);
    if (error) { console.error('Failed to delete device:', error); return false; }
    return true;
  },

  async setDefaultDevice(id: string): Promise<boolean> {
    const { data: device } = await supabase.from('devices').select('branch_id').eq('id', id).single();
    if (!device) return false;
    await supabase.from('devices').update({ is_default: false }).eq('branch_id', device.branch_id);
    const { error } = await supabase.from('devices').update({ is_default: true }).eq('id', id);
    return !error;
  },

  // ── DEPARTMENTS ───────────────────────────────────────────────────────

  async listDepartments(organizationId?: string): Promise<Department[]> {
    let query = supabase.from('departments').select('*').eq('is_active', true).order('name');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) { console.error('Failed to fetch departments:', error); return []; }
    return data || [];
  },

  async createDepartment(dept: { name: string; organization_id: string; code?: string; description?: string }): Promise<Department | null> {
    const { data, error } = await supabase
      .from('departments')
      .insert({ name: dept.name, organization_id: dept.organization_id, code: dept.code || null, description: dept.description || null, is_active: true })
      .select()
      .single();
    if (error) { console.error('Failed to create department:', error); return null; }
    return data;
  },

  async deleteDepartment(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('departments')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { console.error('Failed to delete department:', error); return false; }
    return true;
  },

  // ── DESIGNATIONS ──────────────────────────────────────────────────────

  async listDesignations(organizationId?: string): Promise<Designation[]> {
    let query = supabase.from('designations').select('*').eq('is_active', true).order('name');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) { console.error('Failed to fetch designations:', error); return []; }
    return data || [];
  },

  async createDesignation(desig: { name: string; organization_id: string; code?: string; level?: number }): Promise<Designation | null> {
    const { data, error } = await supabase
      .from('designations')
      .insert({ name: desig.name, organization_id: desig.organization_id, code: desig.code || null, level: desig.level || 1, is_active: true })
      .select()
      .single();
    if (error) { console.error('Failed to create designation:', error); return null; }
    return data;
  },

  async deleteDesignation(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('designations')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { console.error('Failed to delete designation:', error); return false; }
    return true;
  },
};

export const notificationsService = {
  /**
   * Get notifications for a user
   */
  async getByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`receiver_id.eq.${userId},receiver_type.eq.ALL`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch notifications:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Create notification
   */
  async create(notification: Omit<Notification, 'id' | 'created_at'>): Promise<Notification> {
    const { data, error } = await supabase
      .from('notifications')
      .insert([notification])
      .select()
      .single();

    if (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }

    return data;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .or(`receiver_id.eq.${userId},receiver_type.eq.ALL`)
      .eq('is_read', false);

    if (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  },

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .or(`receiver_id.eq.${userId},receiver_type.eq.ALL`)
      .eq('is_read', false);

    if (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }

    return count || 0;
  },
};
