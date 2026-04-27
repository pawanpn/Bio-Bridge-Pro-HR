import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/AuthContext';
import { EnhancedSetupWizard } from '@/components/EnhancedSetupWizard';
import { Login } from '@/pages/Login';
import { ProviderLayout } from '@/layouts/ProviderLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { StaffLayout } from '@/layouts/StaffLayout';
import { ProviderDashboard } from '@/pages/provider/ProviderDashboard';
import { StaffDashboard } from '@/pages/staff/StaffDashboard';
import { LicenseExpired } from '@/pages/LicenseExpired';
import { getDefaultPortalPath, getPortalForRole, type PortalType } from '@/config/portalPolicy';
import { isOrganizationActive, isOrganizationApprovalPending, getOrganizationInactiveReason, type OrganizationStatusLike } from '@/config/organizationStatus';
import { PortalAccessGuard } from '@/components/auth/PortalAccessGuard';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ModuleGuard } from '@/components/ModuleGuard';
import { EmployeeManagement } from '@/pages/EmployeeManagement';
import { EmployeeHierarchyTree } from '@/components/EmployeeHierarchyTree';
import { LeaveManagement } from '@/pages/LeaveManagement';
import { AttendanceManagement } from '@/pages/AttendanceManagement';
import { PayrollManagement } from '@/pages/PayrollManagement';
import { FinanceManagement } from '@/pages/FinanceManagement';
import { BranchGateDeviceManagement } from '@/pages/BranchGateDeviceManagement';
import { DeviceSettings } from '@/pages/DeviceSettings';
import { NotificationSystem } from '@/pages/NotificationSystem';
import { DynamicSystemSettings } from '@/pages/DynamicSystemSettings';
import { Reports } from '@/pages/Reports';
import { InventoryManagement } from '@/pages/InventoryManagement';
import { ProjectsManagement } from '@/pages/ProjectsManagement';
import { CRMManagement } from '@/pages/CRMManagement';
import { AssetsManagement } from '@/pages/AssetsManagement';
import { SystemTools } from '@/components/SystemTools';
import { PermissionManagement } from '@/components/PermissionManagement';
import { ERPDashboard } from '@/pages/ERPDashboard';
import { EmployeeDetail } from '@/pages/EmployeeDetail';
import { OrganizationPendingApproval } from '@/pages/OrganizationPendingApproval';
import { PortalPreview } from '@/pages/PortalPreview';

const legacyRedirects: Array<[string, string]> = [
  ['/dashboard', '/admin/dashboard'],
  ['/employees', '/admin/employees'],
  ['/employee-hierarchy', '/admin/employee-hierarchy'],
  ['/leave-management', '/admin/leave-management'],
  ['/attendance', '/admin/attendance'],
  ['/payroll', '/admin/payroll'],
  ['/finance', '/admin/finance'],
  ['/organization', '/admin/organization'],
  ['/device-settings', '/admin/device-settings'],
  ['/notifications', '/admin/notifications'],
  ['/system-settings', '/admin/system-settings'],
  ['/system-tools', '/admin/system-tools'],
  ['/permissions', '/admin/permissions'],
  ['/reports', '/admin/reports'],
  ['/inventory', '/admin/inventory'],
  ['/projects', '/admin/projects'],
  ['/crm', '/admin/crm'],
  ['/assets', '/admin/assets'],
  ['/cloud-settings', '/admin/system-settings'],
];

const AdminArea = () => (
  <Route
    path="/admin"
    element={
      <PortalAccessGuard allowedPortals="admin">
        <AdminLayout />
      </PortalAccessGuard>
    }
  >
    <Route index element={<Navigate to="/admin/dashboard" replace />} />
    <Route path="dashboard" element={<ERPDashboard />} />
    <Route path="employee/:employeeId" element={<EmployeeDetail />} />
    <Route
      path="employees"
      element={
        <ModuleGuard requiredModule="employees">
          <EmployeeManagement />
        </ModuleGuard>
      }
    />
    <Route
      path="employee-hierarchy"
      element={
        <ModuleGuard requiredModule="employees">
          <EmployeeHierarchyTree />
        </ModuleGuard>
      }
    />
    <Route
      path="leave-management"
      element={
        <ModuleGuard requiredModule="leave">
          <PermissionGuard requiredPermission={['view_leaves', 'apply_leave', 'approve_leave']} showAccessDenied>
            <LeaveManagement />
          </PermissionGuard>
        </ModuleGuard>
      }
    />
    <Route
      path="attendance"
      element={
        <ModuleGuard requiredModule="attendance">
          <AttendanceManagement />
        </ModuleGuard>
      }
    />
    <Route
      path="payroll"
      element={
        <ModuleGuard requiredModule="payroll">
          <PayrollManagement />
        </ModuleGuard>
      }
    />
    <Route
      path="finance"
      element={
        <ModuleGuard requiredModule="finance">
          <FinanceManagement />
        </ModuleGuard>
      }
    />
    <Route
      path="organization"
      element={
        <ModuleGuard requiredModule="organization">
          <BranchGateDeviceManagement />
        </ModuleGuard>
      }
    />
    <Route
      path="device-settings"
      element={
        <ModuleGuard requiredModule="organization">
          <DeviceSettings />
        </ModuleGuard>
      }
    />
    <Route
      path="notifications"
      element={
        <ModuleGuard requiredModule="notifications">
          <NotificationSystem />
        </ModuleGuard>
      }
    />
    <Route
      path="system-settings"
      element={
        <ModuleGuard requiredModule="system-settings">
          <DynamicSystemSettings />
        </ModuleGuard>
      }
    />
    <Route
      path="system-tools"
      element={
        <ModuleGuard requiredModule="system-tools">
          <SystemTools />
        </ModuleGuard>
      }
    />
    <Route
      path="permissions"
      element={
        <ModuleGuard requiredModule="permissions">
          <PermissionManagement />
        </ModuleGuard>
      }
    />
    <Route
      path="reports"
      element={
        <ModuleGuard requiredModule="reports">
          <Reports />
        </ModuleGuard>
      }
    />
    <Route
      path="inventory"
      element={
        <ModuleGuard requiredModule="inventory">
          <InventoryManagement />
        </ModuleGuard>
      }
    />
    <Route
      path="projects"
      element={
        <ModuleGuard requiredModule="projects">
          <ProjectsManagement />
        </ModuleGuard>
      }
    />
    <Route
      path="crm"
      element={
        <ModuleGuard requiredModule="crm">
          <CRMManagement />
        </ModuleGuard>
      }
    />
    <Route
      path="assets"
      element={
        <ModuleGuard requiredModule="assets">
          <AssetsManagement />
        </ModuleGuard>
      }
    />
    <Route path="cloud-settings" element={<Navigate to="/admin/system-settings" replace />} />
  </Route>
);

const ProviderArea = () => (
  <Route
    path="/provider"
    element={
      <PortalAccessGuard allowedPortals="provider">
        <ProviderLayout />
      </PortalAccessGuard>
    }
  >
    <Route index element={<Navigate to="/provider/dashboard" replace />} />
    <Route path="dashboard" element={<ProviderDashboard />} />
    <Route path="organizations" element={<BranchGateDeviceManagement />} />
    <Route path="roles" element={<PermissionManagement />} />
    <Route path="settings" element={<DynamicSystemSettings />} />
  </Route>
);

const StaffArea = () => (
  <Route
    path="/staff"
    element={
      <PortalAccessGuard allowedPortals="staff">
        <StaffLayout />
      </PortalAccessGuard>
    }
  >
    <Route index element={<Navigate to="/staff/dashboard" replace />} />
    <Route path="dashboard" element={<StaffDashboard />} />
    <Route path="attendance" element={<AttendanceManagement />} />
    <Route path="leaves" element={<LeaveManagement />} />
  </Route>
);

export const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();
  const location = window.location;
  const [org, setOrg] = useState<OrganizationStatusLike | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  // When a user is logged in, respect their role's portal. For unauthenticated state, default to admin in Tauri.
  const userPortalFromRole = user ? getPortalForRole(user.role) : null;
  const runtimePortal: PortalType = userPortalFromRole ?? (isTauri() ? 'admin' : 'provider');
  const isPreviewRoute = import.meta.env.DEV && location.pathname.startsWith('/preview');

  const isSetupComplete = useMemo(() => {
    try {
      return localStorage.getItem('setupComplete') === 'true';
    } catch {
      return false;
    }
  }, []);

  const portal = getPortalForRole(user?.role);
  const defaultPath = getDefaultPortalPath(portal);

  useEffect(() => {
    const organizationId = user?.organization_id;
    if (!organizationId) {
      setOrg(null);
      return;
    }

    let cancelled = false;
    setOrgLoading(true);

    const loadOrganization = async () => {
      // For Tauri (local) users, fetch org status from local SQLite.
      // For web (Supabase) users, fetch from cloud.
      if (isTauri()) {
        try {
          const result: any = await invoke('get_organization_status', { organizationId: Number(organizationId) });
          if (!cancelled) {
            setOrg(result ? {
              org_status: result.org_status || 'active',
              status: result.status || 'active',
              payment_status: result.payment_status || 'Paid',
              provider_approved: result.provider_approved !== 0,
              license_expiry: result.license_expiry || null,
            } : null);
          }
        } catch {
          // No org found in local DB — treat as fully active (no cloud restriction)
          if (!cancelled) setOrg(null);
        }
      } else {
        const { data, error } = await supabase
          .from('organizations')
          .select('org_status, status, payment_status, provider_approved, license_expiry')
          .eq('id', organizationId)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error('Failed to load organization status:', error);
          setOrg(null);
        } else {
          setOrg(data || null);
        }
      }

      if (!cancelled) setOrgLoading(false);
    };

    void loadOrganization();

    return () => {
      cancelled = true;
    };
  }, [user?.organization_id]);

  if (loading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isPreviewRoute) {
    return <PortalPreview />;
  }

  if (!isSetupComplete) {
    return <EnhancedSetupWizard />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to={`/${runtimePortal}/login`} replace />} />
        <Route path="/login" element={<Navigate to={`/${runtimePortal}/login`} replace />} />
        <Route path="/provider/login" element={<Login portal="provider" />} />
        <Route path="/admin/login" element={<Login portal="admin" />} />
        <Route path="/staff/login" element={<Navigate to={`/${runtimePortal}/login`} replace />} />
        <Route path="*" element={<Navigate to={`/${runtimePortal}/login`} replace />} />
      </Routes>
    );
  }

  const userPortal = getPortalForRole(user?.role);

  // Only enforce org checks for non-provider roles, and only when org data is actually loaded.
  // If org is null (no cloud record for local users), treat as active/approved.
  if (userPortal !== 'provider' && org && isOrganizationApprovalPending(org)) {
    return <OrganizationPendingApproval reason={getOrganizationInactiveReason(org)} />;
  }

  if (userPortal !== 'provider' && org && !isOrganizationActive(org)) {
    return <LicenseExpired reason={getOrganizationInactiveReason(org)} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={defaultPath} replace />} />
      <Route path="/license-expired" element={<LicenseExpired reason={getOrganizationInactiveReason(org)} />} />
      <Route path="/organization-pending" element={<OrganizationPendingApproval reason={getOrganizationInactiveReason(org)} />} />
      <Route path="/login" element={<Navigate to={defaultPath} replace />} />
      <Route path="/provider/login" element={<Navigate to={defaultPath} replace />} />
      <Route path="/admin/login" element={<Navigate to={defaultPath} replace />} />
      <Route path="/staff/login" element={<Navigate to={defaultPath} replace />} />

      {legacyRedirects.map(([from, to]) => (
        <Route key={from} path={from} element={<Navigate to={to} replace />} />
      ))}

      {ProviderArea()}
      {AdminArea()}
      {StaffArea()}

      <Route path="*" element={<Navigate to={defaultPath} replace />} />
    </Routes>
  );
};
