import React from 'react';
import { MainLayout } from '@/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Eye, X } from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { isImpersonating, impersonatedOrgName, stopImpersonating } = useAuth();

  return (
    <div className="flex flex-col min-h-screen">
      {isImpersonating && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm font-medium z-50">
          <div className="flex items-center gap-2">
            <Eye size={16} />
            <span>
              Viewing as client: <strong>{impersonatedOrgName || 'Unknown'}</strong>
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={stopImpersonating}
            className="text-white hover:bg-amber-600 h-7 px-2"
          >
            <X size={14} className="mr-1" />
            Return to Provider
          </Button>
        </div>
      )}
      <MainLayout />
    </div>
  );
};

