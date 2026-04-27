import React from 'react';
import { Shield, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/hooks/usePermission';

interface PermissionGuardProps {
  requiredPermission: string | string[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showAccessDenied?: boolean;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  requiredPermission,
  requireAll = false,
  children,
  fallback,
  showAccessDenied = false,
}) => {
  const { user } = useAuth();
  const { hasAnyPermission, hasAllPermissions, loading } = usePermission(user?.id);

  if (loading) {
    return <div className="flex items-center justify-center p-4">Loading...</div>;
  }

  const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
  const hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showAccessDenied) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <Lock size={48} className="text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-sm text-muted-foreground">
            You don't have permission to access this feature.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Required: {permissions.join(', ')}
          </p>
        </div>
      );
    }

    return null;
  }

  return <>{children}</>;
};

interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  requiredPermission: string | string[];
  requireAll?: boolean;
}

export const PermissionButton: React.FC<PermissionButtonProps> = ({
  requiredPermission,
  requireAll = false,
  children,
  disabled,
  ...props
}) => {
  const { user } = useAuth();
  const { hasAnyPermission, hasAllPermissions, loading } = usePermission(user?.id);

  const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
  const hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);

  if (!hasAccess || loading) {
    return (
      <button
        disabled
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-muted text-muted-foreground cursor-not-allowed opacity-50"
        title="You don't have permission to perform this action"
      >
        <Shield size={14} />
        {children}
      </button>
    );
  }

  return (
    <button disabled={disabled} {...props}>
      {children}
    </button>
  );
};

