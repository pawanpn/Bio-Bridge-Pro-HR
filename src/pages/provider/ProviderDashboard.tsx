import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Shield, CreditCard, Server } from 'lucide-react';

const metrics = [
  { title: 'Organizations', value: 'All tenants', icon: Building2 },
  { title: 'Licenses', value: 'Manage status', icon: CreditCard },
  { title: 'RBAC Rules', value: 'Global defaults', icon: Shield },
  { title: 'Sync Layer', value: 'Supabase + Desktop', icon: Server },
];

export const ProviderDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="mb-3 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/20">Provider control</Badge>
            <h1 className="text-3xl font-bold">Multi-tenant SaaS command center</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              This portal manages global licensing, organization activation, and the default permission model that
              the client admin and staff portals inherit.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <Card key={item.title} className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              <item.icon className="h-5 w-5 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

