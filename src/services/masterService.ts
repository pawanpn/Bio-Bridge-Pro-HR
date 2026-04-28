import { supabase } from '@/config/supabase';

const isTauri = !!(window as any).__TAURI_INTERNALS__;

let _invoke: any = null;
async function callBackend(cmd: string, args?: Record<string, any>) {
  if (!isTauri) return null;
  if (!_invoke) {
    try { const m = await import('@tauri-apps/api/core'); _invoke = m.invoke; } catch { return null; }
  }
  return _invoke(cmd, args);
}

const getOrgId = (orgId?: number | string): number | undefined => {
  if (orgId !== undefined && orgId !== null) return Number(orgId);
  try {
    const user = JSON.parse(localStorage.getItem('biobridge_user') || '{}');
    if (user.organization_id) return Number(user.organization_id);
  } catch {}
  try {
    const imp = JSON.parse(localStorage.getItem('biobridge_impersonate_user') || '{}');
    if (imp.organization_id) return Number(imp.organization_id);
  } catch {}
  return undefined;
};

// ============================================================================
// BRANCHES
// ============================================================================

export async function listBranches(orgId?: number | string): Promise<any[]> {
  const organization_id = getOrgId(orgId);
  const result = await callBackend('list_branches', { organizationId: organization_id });
  if (result !== null) return Array.isArray(result) ? result : [];

  const query = supabase.from('branches').select('*');
  if (organization_id) query.eq('organization_id', organization_id);
  const { data } = await query;
  return data || [];
}

export async function addBranch(name: string, location?: string | null, orgId?: number | string): Promise<any> {
  const organization_id = getOrgId(orgId) || 1;
  const result = await callBackend('add_branch', { name, location, organizationId: organization_id });
  if (result !== null) return result;

  const { data, error } = await supabase.from('branches').insert({
    name, location, organization_id,
  }).select().single();
  if (error) throw error;
  return data;
}

// ============================================================================
// EMPLOYEES
// ============================================================================

export async function listEmployees(options?: {
  branch?: string;
  status?: string;
  orgId?: number | string;
}): Promise<any> {
  const organization_id = getOrgId(options?.orgId);
  const result = await callBackend('list_employees', {
    statusFilter: options?.status || 'active',
    branchId: options?.branch || undefined,
    organizationId: organization_id,
  });
  if (result !== null) return result;

  let query = supabase.from('employees').select('*');
  if (organization_id) query = query.eq('organization_id', organization_id);
  if (options?.branch && options.branch !== 'all') query = query.eq('branch_id', options.branch);
  if (options?.status && options.status === 'deleted') {
    query = query.eq('is_active', false);
  } else if (options?.status !== 'all') {
    query = query.eq('is_active', true);
  }
  const { data, count } = await query;
  return { data: data || [], count };
}

export async function createEmployee(request: any): Promise<any> {
  const organization_id = getOrgId(request.organization_id);
  const result = await callBackend('create_employee', { request: { ...request, organization_id } });
  if (result !== null) return result;

  const { data, error } = await supabase.from('employees').insert({
    ...request, organization_id,
  }).select().single();
  if (error) throw error;
  return data;
}

// ============================================================================
// LEAVE REQUESTS
// ============================================================================

export async function listLeaveRequests(options?: {
  employeeId?: number;
  status?: string;
  orgId?: number | string;
}): Promise<any> {
  const result = await callBackend('list_leave_requests', {
    employeeId: options?.employeeId,
    status: options?.status,
    organizationId: getOrgId(options?.orgId),
  });
  if (result !== null) return result;

  const organization_id = getOrgId(options?.orgId);
  let query = supabase.from('leave_requests').select('*, employees!inner(id, first_name, last_name, organization_id)');
  if (organization_id) query = query.eq('employees.organization_id', organization_id);
  if (options?.employeeId) query = query.eq('employee_id', options.employeeId);
  if (options?.status && options.status !== 'all') query = query.eq('status', options.status);
  const { data } = await query;
  return { data: data || [] };
}

// ============================================================================
// ITEMS / INVENTORY
// ============================================================================

export async function listItems(orgId?: number | string): Promise<any[]> {
  const result = await callBackend('list_items', { organizationId: getOrgId(orgId) });
  if (result !== null) return result;

  const organization_id = getOrgId(orgId);
  let query = supabase.from('items').select('*').eq('is_active', true);
  if (organization_id) query = query.eq('organization_id', organization_id);
  const { data } = await query;
  return data || [];
}

// ============================================================================
// PROJECTS
// ============================================================================

export async function listProjects(orgId?: number | string): Promise<any[]> {
  const result = await callBackend('list_projects', { organizationId: getOrgId(orgId) });
  if (result !== null) return result;

  const organization_id = getOrgId(orgId);
  let query = supabase.from('projects').select('*');
  if (organization_id) query = query.eq('organization_id', organization_id);
  const { data } = await query;
  return data || [];
}

// ============================================================================
// LEADS
// ============================================================================

export async function listLeads(orgId?: number | string): Promise<any[]> {
  const result = await callBackend('list_leads', { organizationId: getOrgId(orgId) });
  if (result !== null) return result;

  const organization_id = getOrgId(orgId);
  let query = supabase.from('leads').select('*');
  if (organization_id) query = query.eq('organization_id', organization_id);
  const { data } = await query;
  return data || [];
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export async function getDashboardStats(orgId?: number | string): Promise<any> {
  const organization_id = getOrgId(orgId);
  const result = await callBackend('get_dashboard_stats', { organizationId: organization_id });
  if (result !== null) return result;

  try {
    const empQuery = supabase.from('employees').select('id, employment_status, is_active, date_of_joining');
    if (organization_id) empQuery.eq('organization_id', organization_id);
    const { data: employees } = await empQuery;

    const allEmployees = (employees || []);
    const activeEmployees = allEmployees.filter((e: any) => e.is_active !== false);
    const newHiresThisMonth = activeEmployees.filter((e: any) => {
      if (!e.date_of_joining) return false;
      const d = new Date(e.date_of_joining);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const today = new Date().toISOString().split('T')[0];
    const attQuery = supabase.from('attendance_logs').select('employee_id', { count: 'exact', head: false })
      .gte('timestamp', today + 'T00:00:00')
      .lte('timestamp', today + 'T23:59:59');
    if (organization_id) attQuery.eq('organization_id', organization_id);
    const { count: presentToday } = await attQuery;

    return {
      totalEmployees: activeEmployees.length,
      presentToday: presentToday || 0,
      absentToday: Math.max(0, activeEmployees.length - (presentToday || 0)),
      lateToday: 0,
      onLeave: 0,
      pendingLeaveRequests: 0,
      newHiresThisMonth,
      resignationsThisMonth: 0,
      attendanceRate: activeEmployees.length > 0 ? Math.round(((presentToday || 0) / activeEmployees.length) * 100) : 0,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// DEPARTMENTS & DESIGNATIONS
// ============================================================================

export async function listDepartments(orgId?: number | string): Promise<any[]> {
  const result = await callBackend('list_departments');
  if (result !== null) return result;

  const organization_id = getOrgId(orgId);
  let query = supabase.from('departments').select('*');
  if (organization_id) query = query.eq('organization_id', organization_id);
  const { data } = await query;
  return data || [];
}

export async function listDesignations(orgId?: number | string): Promise<any[]> {
  const result = await callBackend('list_designations');
  if (result !== null) return result;

  const organization_id = getOrgId(orgId);
  let query = supabase.from('designations').select('*');
  if (organization_id) query = query.eq('organization_id', organization_id);
  const { data } = await query;
  return data || [];
}

// ============================================================================
// DEVICES & GATES
// ============================================================================

export async function listAllDevices(branchId?: number | string): Promise<any[]> {
  const result = await callBackend('list_all_devices', { branchId });
  if (result !== null) return result;

  let query = supabase.from('devices').select('*');
  if (branchId) query = query.eq('branch_id', branchId);
  const { data } = await query;
  return data || [];
}

export async function listGates(branchId?: number | string): Promise<any[]> {
  const result = await callBackend('list_gates', { branchId });
  if (result !== null) return result;

  let query = supabase.from('gates').select('*');
  if (branchId) query = query.eq('branch_id', branchId);
  const { data } = await query;
  return data || [];
}

export { isTauri };
export default { isTauri };
