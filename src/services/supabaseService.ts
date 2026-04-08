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
  name: string;
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
   * Get all active inventory items
   */
  async getAll(): Promise<Item[]> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('is_active', true)
      .order('item_code', { ascending: true });

    if (error) {
      console.error('Failed to fetch items:', error);
      throw error;
    }

    return data || [];
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
      .select('quantity, unit_price, reorder_level')
      .eq('is_active', true);

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
