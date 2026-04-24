import { isSuperAdmin, type ScopedUser } from '@/config/accessPolicy';

export interface DataScope {
  role: string;
  organizationId: string | null;
  branchIds: string[];
  superAdmin: boolean;
}

const parseStoredUser = (): ScopedUser | null => {
  try {
    const raw = localStorage.getItem('biobridge_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getDataScope = (): DataScope => {
  const user = parseStoredUser();
  const superAdmin = isSuperAdmin(user?.role);
  const branchIds = superAdmin
    ? []
    : (Array.isArray(user?.branch_ids) && user?.branch_ids.length > 0
        ? user!.branch_ids!.filter(Boolean)
        : user?.branch_id
          ? [user.branch_id]
          : []);

  return {
    role: (user?.role || 'EMPLOYEE').toUpperCase(),
    organizationId: user?.organization_id || null,
    branchIds,
    superAdmin,
  };
};

export const hasBranchAccess = (branchId?: string | number | null): boolean => {
  if (!branchId) return true;
  const scope = getDataScope();
  if (scope.superAdmin || scope.branchIds.length === 0) return true;
  return scope.branchIds.includes(String(branchId));
};

export const applyBranchScope = <T extends { in: Function; eq: Function }>(
  query: T,
  branchColumn = 'branch_id'
) => {
  const scope = getDataScope();
  if (scope.superAdmin || scope.branchIds.length === 0) return query;
  return query.in(branchColumn, scope.branchIds);
};

export const applyOrganizationScope = <T extends { eq: Function }>(
  query: T,
  organizationColumn = 'organization_id'
) => {
  const scope = getDataScope();
  if (scope.superAdmin || !scope.organizationId) return query;
  return query.eq(organizationColumn, scope.organizationId);
};
