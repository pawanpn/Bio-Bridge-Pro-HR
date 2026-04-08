import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';

interface UsePermissionReturn {
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  userRole: string | null;
  loading: boolean;
}

export const usePermission = (userId?: string): UsePermissionReturn => {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    if (!userId) {
      // Try to get from localStorage
      const stored = localStorage.getItem('biobridge_user');
      if (stored) {
        const user = JSON.parse(stored);
        userId = user.id;
      } else {
        setLoading(false);
        return;
      }
    }

    try {
      // Get user's role (your schema uses role VARCHAR field)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (userError) throw userError;
      if (!userData?.role) {
        setLoading(false);
        return;
      }

      setUserRole(userData.role);

      // Get permissions for this role (your schema: role_permissions uses role VARCHAR)
      const { data: rolePerms, error: permError } = await supabase
        .from('role_permissions')
        .select(`
          permission_id,
          permissions:permissions(module, permission)
        `)
        .eq('role', userData.role);

      if (permError) throw permError;

      const permStrings = rolePerms?.map(rp => {
        const perm = Array.isArray(rp.permissions) ? rp.permissions[0] : rp.permissions;
        return `${perm.module}:${perm.permission}`;
      }) || [];

      setPermissions(permStrings);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const hasPermission = useCallback((permission: string): boolean => {
    // Format: "module:permission" or just "permission"
    if (permission.includes(':')) {
      return permissions.includes(permission);
    }
    return permissions.some(p => p.endsWith(`:${permission}`));
  }, [permissions]);

  const hasAnyPermission = useCallback((perms: string[]): boolean => {
    return perms.some(p => hasPermission(p));
  }, [hasPermission]);

  const hasAllPermissions = useCallback((perms: string[]): boolean => {
    return perms.every(p => hasPermission(p));
  }, [hasPermission]);

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    userRole,
    loading
  };
};
