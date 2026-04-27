import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  Shield,
  CreditCard,
  Users2,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Phone,
  Mail,
  FileText,
} from 'lucide-react';

interface Organization {
  id: number;
  name: string;
  address?: string | null;
  contact_info?: string | null;
  auth_key?: string | null;
  license_expiry?: string | null;
  provider_name?: string | null;
  provider_contact?: string | null;
  payment_term_days?: number | null;
  payment_status?: string | null;
  provider_approved?: boolean;
  notes?: string | null;
}

type StatusFilter = 'all' | 'approved' | 'pending' | 'expired';

export const ProviderDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [previewOrg, setPreviewOrg] = useState<Organization | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const loadOrganizations = useCallback(async () => {
    try {
      const data = await invoke<Organization[]>('list_organizations');
      setOrganizations(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load organizations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const isExpired = (expiry?: string | null): boolean => {
    if (!expiry) return false;
    try {
      const d = new Date(expiry);
      return !isNaN(d.getTime()) && d < new Date();
    } catch {
      return false;
    }
  };

  const stats = {
    total: organizations.length,
    approved: organizations.filter((o) => o.provider_approved).length,
    pending: organizations.filter((o) => !o.provider_approved).length,
    expired: organizations.filter((o) => isExpired(o.license_expiry)).length,
  };

  const filteredOrgs = organizations
    .filter((o) => {
      if (statusFilter === 'approved') return o.provider_approved;
      if (statusFilter === 'pending') return !o.provider_approved;
      if (statusFilter === 'expired') return isExpired(o.license_expiry);
      return true;
    })
    .filter((o) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        o.name.toLowerCase().includes(q) ||
        (o.address || '').toLowerCase().includes(q) ||
        (o.contact_info || '').toLowerCase().includes(q)
      );
    });

  const handleApproveToggle = async (org: Organization) => {
    setApprovingId(org.id);
    try {
      await invoke('update_organization', {
        id: org.id,
        name: org.name,
        address: org.address || null,
        contact_info: org.contact_info || null,
        auth_key: org.auth_key || null,
        license_expiry: org.license_expiry || null,
        provider_name: org.provider_name || null,
        provider_contact: org.provider_contact || null,
        payment_term_days: org.payment_term_days ?? null,
        payment_status: org.payment_status || null,
        provider_approved: !org.provider_approved,
        notes: org.notes || null,
      });
      await loadOrganizations();
      window.dispatchEvent(new CustomEvent('data-synced', { detail: { table: 'organizations' } }));
    } catch (e) {
      console.error('Failed to approve organization:', e);
    } finally {
      setApprovingId(null);
    }
  };

  const handleOpenClient = (org: Organization) => {
    sessionStorage.setItem('impersonated_org_id', String(org.id));
    sessionStorage.setItem('impersonated_org_name', org.name);
    sessionStorage.setItem('provider_original_portal', 'provider');
    navigate('/admin/dashboard', { replace: true });
  };

  const formatDate = (d?: string | null): string => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return d;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading organizations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="mb-3 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/20">Provider Control</Badge>
            <h1 className="text-3xl font-bold">Multi-tenant SaaS Command Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Manage client organizations, approve registrations, and control licensing globally.
            </p>
          </div>
          <Button
            onClick={loadOrganizations}
            variant="outline"
            className="border-white/20 bg-transparent text-white hover:bg-white/10"
          >
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStatusFilter('all')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Building2 className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-slate-500 mt-1">All registered clients</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStatusFilter('approved')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
            <p className="text-xs text-slate-500 mt-1">Active client organizations</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStatusFilter('pending')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-slate-500 mt-1">Awaiting provider review</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStatusFilter('expired')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">License Expired</CardTitle>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expired}</div>
            <p className="text-xs text-slate-500 mt-1">Requires renewal</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'approved', 'pending', 'expired'] as StatusFilter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={statusFilter === f ? 'default' : 'outline'}
              onClick={() => setStatusFilter(f)}
              className={statusFilter === f ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}
            >
              {f === 'all' ? 'All' : f === 'approved' ? 'Approved' : f === 'pending' ? 'Pending' : 'Expired'}
              {f !== 'all' && (
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">
                  {f === 'approved' ? stats.approved : f === 'pending' ? stats.pending : stats.expired}
                </span>
              )}
            </Button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Organizations Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 size={20} className="text-slate-500" />
            Client Organizations ({filteredOrgs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredOrgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Building2 size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No organizations found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>License Expiry</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrgs.map((org) => {
                  const expired = isExpired(org.license_expiry);
                  return (
                    <TableRow key={org.id} className="group">
                      <TableCell>
                        <div className="flex flex-col">
                          <button
                            className="text-left font-medium text-slate-900 hover:text-cyan-600 transition-colors"
                            onClick={() => setPreviewOrg(org)}
                          >
                            {org.name}
                          </button>
                          <span className="text-xs text-slate-400 mt-0.5">
                            {org.address || 'No address'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} className={expired ? 'text-red-400' : 'text-slate-400'} />
                          <span className={expired ? 'text-red-600 text-sm font-medium' : 'text-sm'}>
                            {formatDate(org.license_expiry)}
                          </span>
                          {expired && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0">Expired</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            org.payment_status === 'Paid'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : org.payment_status === 'Pending'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-slate-200 bg-slate-50 text-slate-500'
                          }
                        >
                          {org.payment_status || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {org.provider_approved ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                            <CheckCircle2 size={12} className="mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                            <Clock size={12} className="mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            title="View Details"
                            onClick={() => setPreviewOrg(org)}
                            className="h-8 w-8 p-0"
                          >
                            <FileText size={15} />
                          </Button>
                          <Button
                            size="sm"
                            variant={org.provider_approved ? 'outline' : 'default'}
                            onClick={() => handleApproveToggle(org)}
                            disabled={approvingId === org.id}
                            title={org.provider_approved ? 'Revoke Approval' : 'Approve'}
                            className={org.provider_approved ? 'h-8 border-amber-200 text-amber-600 hover:bg-amber-50' : 'h-8 bg-emerald-600 hover:bg-emerald-700'}
                          >
                            {approvingId === org.id ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : org.provider_approved ? (
                              <XCircle size={14} />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            <span className="ml-1.5 hidden lg:inline">
                              {org.provider_approved ? 'Revoke' : 'Approve'}
                            </span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenClient(org)}
                            title="Open Client Portal"
                            className="h-8 border-cyan-200 text-cyan-600 hover:bg-cyan-50"
                          >
                            <ExternalLink size={14} />
                            <span className="ml-1.5 hidden lg:inline">Open</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RBAC Rules</CardTitle>
            <Shield className="h-5 w-5 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-slate-600">
              Global permission defaults that client organizations inherit.
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => navigate('/provider/roles')}
            >
              Manage Permissions
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <CreditCard className="h-5 w-5 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-slate-600">
              {stats.approved} client{stats.approved !== 1 ? 's' : ''} currently active with valid licenses.
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => setStatusFilter('approved')}
            >
              View Active
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Layer</CardTitle>
            <Users2 className="h-5 w-5 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-slate-600">
              Bi-directional sync between Supabase cloud and local desktop databases.
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => navigate('/provider/settings')}
            >
              Sync Settings
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Organization Detail Dialog */}
      <Dialog open={!!previewOrg} onOpenChange={(open) => { if (!open) setPreviewOrg(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 size={20} className="text-slate-500" />
              {previewOrg?.name}
            </DialogTitle>
            <DialogDescription>Organization details and licensing information</DialogDescription>
          </DialogHeader>
          {previewOrg && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Status</Label>
                  <div className="mt-1">
                    {previewOrg.provider_approved ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        <CheckCircle2 size={12} className="mr-1" /> Approved
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                        <Clock size={12} className="mr-1" /> Pending Approval
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Payment</Label>
                  <p className="mt-1 text-sm font-medium">{previewOrg.payment_status || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">License Expiry</Label>
                  <p className={`mt-1 text-sm font-medium ${isExpired(previewOrg.license_expiry) ? 'text-red-600' : ''}`}>
                    {formatDate(previewOrg.license_expiry)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Auth Key</Label>
                  <p className="mt-1 text-sm font-mono text-slate-500 truncate max-w-[180px]" title={previewOrg.auth_key || ''}>
                    {previewOrg.auth_key || '—'}
                  </p>
                </div>
              </div>
              <div className="border-t pt-3">
                <Label className="text-xs text-slate-500">Contact</Label>
                <div className="mt-2 space-y-1.5 text-sm">
                  {previewOrg.contact_info && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail size={13} /> {previewOrg.contact_info}
                    </div>
                  )}
                  {previewOrg.address && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Building2 size={13} /> {previewOrg.address}
                    </div>
                  )}
                  {previewOrg.provider_name && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Shield size={13} /> Provider: {previewOrg.provider_name}
                      {previewOrg.provider_contact && (
                        <span className="flex items-center gap-1 ml-2">
                          <Phone size={12} /> {previewOrg.provider_contact}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {previewOrg.notes && (
                <div className="border-t pt-3">
                  <Label className="text-xs text-slate-500">Notes</Label>
                  <p className="mt-1 text-sm text-slate-600">{previewOrg.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOrg(null)}>Close</Button>
            {previewOrg && (
              <>
                <Button
                  variant={previewOrg.provider_approved ? 'outline' : 'default'}
                  onClick={() => { handleApproveToggle(previewOrg); setPreviewOrg(null); }}
                  disabled={approvingId === previewOrg.id}
                  className={previewOrg.provider_approved ? 'border-amber-200 text-amber-600 hover:bg-amber-50' : 'bg-emerald-600 hover:bg-emerald-700'}
                >
                  {previewOrg.provider_approved ? 'Revoke Approval' : 'Approve'}
                </Button>
                <Button
                  variant="default"
                  onClick={() => { handleOpenClient(previewOrg); setPreviewOrg(null); }}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  <ExternalLink size={14} className="mr-1.5" />
                  Open Client
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
