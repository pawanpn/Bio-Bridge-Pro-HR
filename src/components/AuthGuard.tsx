// ============================================================
// Bio-Bridge Pro HR — Route-Level Auth Guard
// Wrap every protected <Route> with this.
// Usage in App.tsx:
//   <Route path="/payroll" element={
//     <AuthGuard permission="payroll:view">
//       <PayrollPage />
//     </AuthGuard>
//   } />
// ============================================================

import { type ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "../types";

interface AuthGuardProps {
  children: ReactNode;
  /** Single permission string e.g. "payroll:view" */
  permission?: string;
  /** Any of these roles can access */
  roles?: UserRole[];
  /** Redirect target when auth fails — default "/login" */
  redirectTo?: string;
}

export function AuthGuard({
  children,
  permission,
  roles,
  redirectTo = "/login",
}: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthenticated = !!user;
  const hasPermission = permission ? user?.permissions?.includes(permission) : true;
  const hasRole = roles?.length ? roles.includes(user?.role as UserRole) : true;

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate(redirectTo, { replace: true, state: { from: location.pathname } });
      return;
    }
    if (!hasPermission || !hasRole) {
      navigate("/unauthorized", { replace: true });
    }
  }, [isLoading, isAuthenticated, hasPermission, hasRole, navigate, redirectTo, location.pathname]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated || !hasPermission || !hasRole) return null;

  return <>{children}</>;
}

// ─── Permission-only guard (lighter, inline) ─────────────────

/** Render children only if user has the permission. No redirect — just hides UI. */
export function PermissionGate({
  permission,
  roles,
  children,
  fallback = null,
}: {
  permission?: string;
  roles?: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user } = useAuth();
  const hasPermission = permission ? user?.permissions?.includes(permission) : true;
  const hasRole = roles?.length ? roles.includes(user?.role as UserRole) : true;

  if (!hasPermission || !hasRole) return <>{fallback}</>;
  return <>{children}</>;
}

export default AuthGuard;
