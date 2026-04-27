export type AppRole =
  | 'PROVIDER'
  | 'SUPER_ADMIN'
  | 'ORG_SUPERADMIN'
  | 'ADMIN'
  | 'ORG_ADMIN'
  | 'BRANCH_HEAD'
  | 'ORG_MANAGER'
  | 'MANAGER'
  | 'SUPERVISOR'
  | 'HR'
  | 'EMPLOYEE'
  | 'OPERATOR'
  | 'VIEWER';

export type AppModule =
  | 'dashboard'
  | 'employees'
  | 'attendance'
  | 'leave'
  | 'payroll'
  | 'finance'
  | 'reports'
  | 'inventory'
  | 'projects'
  | 'crm'
  | 'assets'
  | 'organization'
  | 'permissions'
  | 'notifications'
  | 'system-tools'
  | 'system-settings';

export interface ScopedUser {
  role?: string | null;
  branch_id?: string | null;
  branch_ids?: string[] | null;
  organization_id?: string | null;
}

const ALL_MODULES: AppModule[] = [
  'dashboard',
  'employees',
  'attendance',
  'leave',
  'payroll',
  'finance',
  'reports',
  'inventory',
  'projects',
  'crm',
  'assets',
  'organization',
  'permissions',
  'notifications',
  'system-tools',
  'system-settings',
];

const ROLE_MODULES: Record<AppRole, AppModule[]> = {
  PROVIDER: ALL_MODULES,
  SUPER_ADMIN: ALL_MODULES,
  ORG_SUPERADMIN: ALL_MODULES,
  ADMIN: ALL_MODULES,
  ORG_ADMIN: ALL_MODULES,
  BRANCH_HEAD: ['dashboard', 'employees', 'attendance', 'leave', 'reports', 'organization', 'notifications'],
  ORG_MANAGER: ['dashboard', 'employees', 'attendance', 'leave', 'reports', 'notifications'],
  MANAGER: ['dashboard', 'employees', 'attendance', 'leave', 'reports', 'notifications'],
  SUPERVISOR: ['dashboard', 'employees', 'attendance', 'reports', 'notifications'],
  HR: ['dashboard', 'employees', 'attendance', 'leave', 'reports', 'organization', 'notifications'],
  EMPLOYEE: ['dashboard', 'attendance', 'leave', 'reports', 'notifications'],
  OPERATOR: ['dashboard', 'attendance', 'notifications'],
  VIEWER: ['dashboard', 'reports', 'notifications'],
};

export const normalizeRole = (role?: string | null): AppRole => {
  const value = (role || '').toUpperCase();
  if (
    value === 'PROVIDER' ||
    value === 'SUPER_ADMIN' ||
    value === 'ORG_SUPERADMIN' ||
    value === 'ADMIN' ||
    value === 'ORG_ADMIN' ||
    value === 'BRANCH_HEAD' ||
    value === 'ORG_MANAGER' ||
    value === 'MANAGER' ||
    value === 'SUPERVISOR' ||
    value === 'HR' ||
    value === 'EMPLOYEE' ||
    value === 'OPERATOR' ||
    value === 'VIEWER'
  ) {
    return value;
  }
  return 'EMPLOYEE';
};

export const isSuperAdmin = (role?: string | null): boolean => {
  const normalized = normalizeRole(role);
  return normalized === 'SUPER_ADMIN' || normalized === 'PROVIDER';
};

export const getAccessibleBranchIds = (user: ScopedUser | null | undefined): string[] => {
  if (!user) return [];
  const role = normalizeRole(user.role);
  if (role === 'SUPER_ADMIN') return [];

  const branchIds = Array.isArray(user.branch_ids) ? user.branch_ids.filter(Boolean) : [];
  if (branchIds.length > 0) return branchIds;

  return user.branch_id ? [user.branch_id] : [];
};

export const canAccessBranch = (
  user: ScopedUser | null | undefined,
  branchId?: string | null
): boolean => {
  if (!branchId) return true;
  const role = normalizeRole(user?.role);
  if (role === 'SUPER_ADMIN') return true;

  const accessible = getAccessibleBranchIds(user);
  if (accessible.length === 0) return true;

  return accessible.includes(branchId);
};

export const canAccessModule = (role: string | null | undefined, module: AppModule): boolean => {
  const normalized = normalizeRole(role);
  return ROLE_MODULES[normalized].includes(module);
};

export const getRoleLabel = (role?: string | null): string => {
  switch (normalizeRole(role)) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'PROVIDER':
      return 'Provider';
    case 'ORG_SUPERADMIN':
      return 'Org Super Admin';
    case 'ADMIN':
      return 'Admin';
    case 'ORG_ADMIN':
      return 'Org Admin';
    case 'BRANCH_HEAD':
      return 'Branch Head';
    case 'ORG_MANAGER':
      return 'Org Manager';
    case 'MANAGER':
      return 'Manager';
    case 'SUPERVISOR':
      return 'Supervisor';
    case 'HR':
      return 'HR';
    case 'EMPLOYEE':
      return 'Employee';
    case 'OPERATOR':
      return 'Operator';
    case 'VIEWER':
      return 'Viewer';
  }
};
