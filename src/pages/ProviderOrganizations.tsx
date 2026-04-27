import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  RefreshCw,
  Loader2,
  Users,
  ShieldOff,
  Globe,
  AlertCircle,
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  contact_email?: string;
  contact_phone?: string;
  created_at: string;
  user_count?: number;
}

export const ProviderOrganizations: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .order('name', { ascending: true });

      if (orgError) throw orgError;

      const orgsWithCounts = await Promise.all((orgs || []).map(async (org) => {
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id);

        return { ...org, user_count: count || 0 };
      }));

      setOrganizations(orgsWithCounts);
    } catch (err: any) {
      setError(err.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizations</h1>
          <p className="text-sm text-slate-400 mt-1">
            {organizations.length} client organizations
          </p>
        </div>
        <Button
          onClick={loadData}
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          <RefreshCw size={14} className="mr-1" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {organizations.map((org) => (
          <Card key={org.id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  org.is_active ? 'bg-blue-500/10' : 'bg-slate-700'
                }`}>
                  <Building2 size={20} className={org.is_active ? 'text-blue-400' : 'text-slate-500'} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white truncate">{org.name}</h3>
                  {org.code && (
                    <p className="text-xs text-slate-500 mt-0.5">{org.code}</p>
                  )}
                  {org.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{org.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-700/50">
                <Badge variant="outline" className={org.is_active
                  ? 'bg-green-500/10 text-green-400 border-green-500/30'
                  : 'bg-slate-700 text-slate-500'
                }>
                  {org.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Users size={12} />
                  {org.user_count} users
                </div>
                {org.contact_email && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
                    <Globe size={12} />
                    {org.contact_email}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
