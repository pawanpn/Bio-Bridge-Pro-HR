import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { canAccessModule, type AppModule } from '@/config/accessPolicy';
import { Lock } from 'lucide-react';

interface ModuleGuardProps {
  requiredModule: AppModule | AppModule[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ModuleGuard: React.FC<ModuleGuardProps> = ({ requiredModule, children, fallback }) => {
  const { user, loading } = useAuth();
  const modules = Array.isArray(requiredModule) ? requiredModule : [requiredModule];

  if (loading) {
    return <div className="flex items-center justify-center p-4">Loading...</div>;
  }

  const hasAccess = modules.some(module => canAccessModule(user?.role, module));

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Lock size={48} className="text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
        <p className="text-sm text-muted-foreground">
          You do not have access to this module.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
