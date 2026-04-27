export interface OrganizationStatusLike {
  org_status?: string | null;
  status?: string | null;
  payment_status?: string | null;
  provider_approved?: boolean | null;
  license_expiry?: string | null;
}

const INACTIVE_STATES = new Set(['inactive', 'suspended', 'expired', 'disabled']);

export const isOrganizationActive = (
  organization?: OrganizationStatusLike | null,
  now: Date = new Date()
): boolean => {
  if (!organization) return true;

  const status = String(organization.org_status || organization.status || '').trim().toLowerCase();
  if (INACTIVE_STATES.has(status)) return false;

  if (organization.provider_approved === false) return false;

  if (organization.license_expiry) {
    const expiry = new Date(organization.license_expiry);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < now.getTime()) {
      return false;
    }
  }

  return true;
};

export const getOrganizationInactiveReason = (
  organization?: OrganizationStatusLike | null,
  now: Date = new Date()
): string => {
  if (!organization) return 'Organization not loaded.';

  const status = String(organization.org_status || organization.status || '').trim().toLowerCase();
  if (INACTIVE_STATES.has(status)) {
    return `Organization status is ${status || 'inactive'}.`;
  }

  if (organization.license_expiry) {
    const expiry = new Date(organization.license_expiry);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < now.getTime()) {
      return `License expired on ${expiry.toLocaleDateString()}.`;
    }
  }

  if (organization.provider_approved === false) return 'Provider approval is pending.';

  return 'Organization access is temporarily unavailable.';
};

export const isOrganizationApprovalPending = (
  organization?: OrganizationStatusLike | null
): boolean => {
  if (!organization) return false;
  const status = String(organization.org_status || organization.status || '').trim().toLowerCase();
  return organization.provider_approved === false || status === 'pending_approval' || status === 'pending';
};
