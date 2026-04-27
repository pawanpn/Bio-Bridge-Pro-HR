import { normalizeRole, type AppRole } from '@/config/accessPolicy';

export type PortalType = 'provider' | 'admin' | 'staff';

const PROVIDER_ROLES: AppRole[] = ['PROVIDER', 'SUPER_ADMIN'];
const ADMIN_ROLES: AppRole[] = ['ORG_SUPERADMIN', 'ORG_ADMIN', 'ORG_MANAGER', 'ADMIN', 'BRANCH_HEAD', 'MANAGER', 'SUPERVISOR', 'HR'];
const STAFF_ROLES: AppRole[] = ['EMPLOYEE', 'OPERATOR', 'VIEWER'];

export const getPortalForRole = (role?: string | null): PortalType => {
  const normalized = normalizeRole(role);
  if (PROVIDER_ROLES.includes(normalized)) return 'provider';
  if (ADMIN_ROLES.includes(normalized)) return 'admin';
  if (STAFF_ROLES.includes(normalized)) return 'staff';
  return 'staff';
};

export const getDefaultPortalPath = (portal: PortalType): string => {
  switch (portal) {
    case 'provider':
      return '/provider/dashboard';
    case 'admin':
      return '/admin/dashboard';
    case 'staff':
      return '/staff/dashboard';
  }
};

export const getPortalLabel = (portal: PortalType): string => {
  switch (portal) {
    case 'provider':
      return 'Provider Portal';
    case 'admin':
      return 'Client Portal';
    case 'staff':
      return 'Staff Portal';
  }
};
