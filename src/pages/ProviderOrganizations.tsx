import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/config/supabase';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2, RefreshCw, Loader2, Users, Globe, AlertCircle,
  Plus, Pencil, Power, PowerOff, Trash2, X, CheckCircle2,
  Mail, Phone, MapPin, Hash, Save, Key, LogIn,
  Search, LayoutGrid, List, ArrowUpDown, ChevronDown
} from 'lucide-react';

interface Organization {
  id: number | string;
  name: string;
  legal_name?: string;
  registration_number?: string;
  tax_number?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  is_active: boolean;
  subscription_plan?: string;
  max_users?: number | null;
  created_at?: string;
  user_count?: number;
  superadmin_username?: string;
  superadmin_id?: string;
  superadmin_auth_id?: string;
  superadmin_email?: string;
  superadmin_last_sign_in_at?: string | null;
  superadmin_password?: string;
}

const emptyOrg: Organization = {
  id: '', name: '', legal_name: '', registration_number: '', tax_number: '',
  email: '', phone: '', website: '', address: '', city: '', state: '',
  country: 'Nepal', postal_code: '', is_active: true, subscription_plan: 'free',
  max_users: null
};

type SortField = 'name' | 'username' | 'created_at' | 'user_count';
type SortDir = 'asc' | 'desc';

function getAdminClient() {
  const serviceKey = localStorage.getItem('supabaseServiceKey') || '';
  const supabaseUrl = localStorage.getItem('supabaseUrl') || import.meta.env.VITE_SUPABASE_URL || '';
  if (!serviceKey || !supabaseUrl) return null;
  return createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function generateUsername(orgName: string, orgId: number): string {
  const base = 'sa_' + orgName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 35);
  return `${base}_${orgId}`;
}

function generateEmail(orgName: string, orgId: number, orgEmail?: string): string {
  if (orgEmail) return orgEmail;
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
  return `${slug}${orgId}@biobridge.com`;
}

async function createSuperAdminUser(orgId: number, orgName: string, orgEmail?: string, password?: string): Promise<{ userId?: string; authId?: string; email: string; username: string; error?: string }> {
  const username = generateUsername(orgName, orgId);
  const email = generateEmail(orgName, orgId, orgEmail);
  const defaultPassword = password || 'org123456';

  const adminClient = getAdminClient();
  let authUserId: string | undefined;

  if (adminClient) {
    try {
      const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
        email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { username, role: 'SUPER_ADMIN', organization_id: orgId }
      });
      if (authErr) throw authErr;
      authUserId = authUser.user?.id;
    } catch (e: any) {
      console.warn('Failed to create auth user:', e.message);
    }
  }

  const { data: userRecord, error: userErr } = await supabase
    .from('users')
    .insert({
      username,
      email,
      full_name: `Super Admin - ${orgName}`,
      role: 'SUPER_ADMIN',
      organization_id: orgId,
      auth_id: authUserId || null,
      is_active: true,
      must_change_password: true
    })
    .select('id')
    .single();

  if (userErr) {
    return { email, username, error: userErr.message };
  }

  return {
    userId: userRecord?.id,
    authId: authUserId,
    email,
    username
  };
}

export const ProviderOrganizations: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [form, setForm] = useState<Organization>({ ...emptyOrg });
  const [confirmDelete, setConfirmDelete] = useState<Organization | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  const [showPasswordModal, setShowPasswordModal] = useState<Organization | null>(null);
  const [newOrgPassword, setNewOrgPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [storedPasswords, setStoredPasswords] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('biobridge_user_passwords') || '{}'); }
    catch { return {}; }
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true); setError('');
      const { data: orgs, error: orgError } = await supabase
        .from('organizations').select('*').order('name');
      if (orgError) throw orgError;

      const passwords: Record<string, string> = {};
      try { Object.assign(passwords, JSON.parse(localStorage.getItem('biobridge_user_passwords') || '{}')); } catch {}

      const adminIds: string[] = [];
      const withExtras = await Promise.all((orgs || []).map(async (org) => {
        const [{ count }, { data: admins }] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('organization_id', org.id),
          supabase.from('users').select('id, username, auth_id, email').eq('organization_id', org.id).eq('role', 'SUPER_ADMIN').limit(1)
        ]);
        const admin = admins?.[0];
        if (admin?.auth_id || admin?.id) adminIds.push(admin.auth_id || admin.id);
        const saId = admin?.id || '';
        return {
          ...org, user_count: count || 0,
          superadmin_username: admin?.username || '',
          superadmin_id: saId,
          superadmin_auth_id: admin?.auth_id || '',
          superadmin_email: admin?.email || '',
          superadmin_password: passwords[saId] || '',
        };
      }));

      const serviceKey = localStorage.getItem('supabaseServiceKey') || '';
      const supabaseUrl = localStorage.getItem('supabaseUrl') || import.meta.env.VITE_SUPABASE_URL || '';
      const authLastSignIn: Record<string, string | null> = {};
      if (serviceKey && supabaseUrl && adminIds.length > 0) {
        try {
          const adminClient = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
          const { data: authData } = await adminClient.auth.admin.listUsers();
          (authData?.users || []).forEach(au => { authLastSignIn[au.id] = au.last_sign_in_at || null; });
        } catch { /* ignore */ }
      }

      withExtras.forEach(o => {
        const lookupId = o.superadmin_auth_id || o.superadmin_id;
        o.superadmin_last_sign_in_at = authLastSignIn[lookupId] || null;
      });

      setStoredPasswords(passwords);
      setOrganizations(withExtras);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingOrg(null);
    setForm({ ...emptyOrg });
    setShowForm(true);
  };

  const openEdit = (org: Organization) => {
    setEditingOrg(org);
    setForm({ ...org });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Organization name is required'); return; }
    setSaving(true); setError(''); setSuccess('');

    try {
      const payload: any = {
        name: form.name, legal_name: form.legal_name || null,
        registration_number: form.registration_number || null,
        tax_number: form.tax_number || null, email: form.email || null,
        phone: form.phone || null, website: form.website || null,
        address: form.address || null, city: form.city || null,
        state: form.state || null, country: form.country || 'Nepal',
        postal_code: form.postal_code || null,
        is_active: form.is_active, subscription_plan: form.subscription_plan || 'free',
        max_users: form.max_users || null
      };

      if (editingOrg) {
        const { error: updErr } = await supabase.from('organizations').update(payload).eq('id', editingOrg.id);
        if (updErr) throw updErr;
        setSuccess('Organization updated');
      } else {
        const { data: newOrg, error: insErr } = await supabase
          .from('organizations')
          .insert(payload)
          .select('id')
          .single();
        if (insErr) throw insErr;

        const saResult = await createSuperAdminUser(newOrg.id, form.name, form.email || undefined);
        if (saResult.error) {
          setSuccess('Organization created. Super Admin: ' + saResult.username + ' / ' + saResult.email + ' (manual auth setup needed)');
        } else if (!saResult.authId) {
          setSuccess('Organization created. Use "Set SA Password" to activate login for ' + saResult.username);
        } else {
          setSuccess('Organization created with Super Admin: ' + saResult.username);
        }
      }

      setShowForm(false);
      await loadData();
      setTimeout(() => setSuccess(''), 8000);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (org: Organization) => {
    try {
      const { error: updErr } = await supabase.from('organizations').update({ is_active: !org.is_active }).eq('id', org.id);
      if (updErr) throw updErr;
      setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, is_active: !o.is_active } : o));
      setSuccess(`${org.name} ${org.is_active ? 'disabled' : 'enabled'}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const { error: delErr } = await supabase.from('organizations').update({ deleted_at: new Date().toISOString() }).eq('id', confirmDelete.id);
      if (delErr) throw delErr;
      setSuccess(`${confirmDelete.name} deleted`);
      setConfirmDelete(null);
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.message); }
  };

  const handleLoginAs = async (org: Organization) => {
    try {
      const { data: users, error: uErr } = await supabase
        .from('users')
        .select('id, username, email, role')
        .eq('organization_id', org.id)
        .eq('role', 'SUPER_ADMIN')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1);
      if (uErr) throw uErr;
      if (!users || users.length === 0) {
        setError(`No active SUPER_ADMIN found in ${org.name}. Create one first.`);
        return;
      }
      const targetUser = users[0];
      localStorage.setItem('biobridge_impersonate_user', JSON.stringify({
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
        role: 'SUPER_ADMIN',
        full_name: targetUser.username,
        organization_id: org.id,
        organization_name: org.name
      }));
      window.location.href = '/';
    } catch (err: any) { setError(err.message); }
  };

  const handleOrgPasswordSave = async () => {
    if (!showPasswordModal || !newOrgPassword || newOrgPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setPasswordSaving(true); setError(''); setSuccess('');
    try {
      const saId = showPasswordModal.superadmin_id || '';
      let authId = showPasswordModal.superadmin_auth_id || '';

      if (!saId) {
        setError('No SUPER_ADMIN user found for this organization. Create one first.');
        setPasswordSaving(false);
        return;
      }

      if (!authId) {
        const adminClient = getAdminClient();
        if (!adminClient) {
          setError('Service key not configured. Cannot create auth user.');
          setPasswordSaving(false);
          return;
        }
        const email = showPasswordModal.superadmin_email || generateEmail(showPasswordModal.name, Number(showPasswordModal.id), undefined);
        const { data: authUser, error: createErr } = await adminClient.auth.admin.createUser({
          email,
          password: newOrgPassword,
          email_confirm: true,
          user_metadata: { role: 'SUPER_ADMIN', organization_id: showPasswordModal.id }
        });
        if (createErr) throw createErr;
        authId = authUser.user?.id;
        if (!authId) { setError('Failed to get auth user ID'); setPasswordSaving(false); return; }

        await supabase.from('users').update({ auth_id: authId, email }).eq('id', saId);
        setSuccess('Auth user created and password set for ' + showPasswordModal.superadmin_username);
      } else {
        const adminClient = getAdminClient();
        if (!adminClient) {
          setError('Service key not configured. Cannot update password.');
          setPasswordSaving(false);
          return;
        }
        const { error: updErr } = await adminClient.auth.admin.updateUserById(authId, { password: newOrgPassword });
        if (updErr) throw updErr;
        setSuccess('Password updated for ' + showPasswordModal.superadmin_username);
      }

      const updatedPasswords = { ...storedPasswords, [saId]: newOrgPassword };
      setStoredPasswords(updatedPasswords);
      localStorage.setItem('biobridge_user_passwords', JSON.stringify(updatedPasswords));

      setOrganizations(prev => prev.map(o =>
        o.id === showPasswordModal.id
          ? { ...o, superadmin_password: newOrgPassword, superadmin_last_sign_in_at: null, superadmin_auth_id: authId || o.superadmin_auth_id }
          : o
      ));

      setShowPasswordModal(null);
      setNewOrgPassword('');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) { setError(err.message); }
    finally { setPasswordSaving(false); }
  };

  // Filtered and sorted organizations
  const displayedOrganizations = useMemo(() => {
    let filtered = organizations.filter((org) => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q ||
        org.name.toLowerCase().includes(q) ||
        (org.legal_name && org.legal_name.toLowerCase().includes(q)) ||
        (org.email && org.email.toLowerCase().includes(q)) ||
        (org.superadmin_username && org.superadmin_username.toLowerCase().includes(q));
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? org.is_active : !org.is_active);
      const matchPlan = planFilter === 'all' || (org.subscription_plan || 'free') === planFilter;
      return matchSearch && matchStatus && matchPlan;
    });

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'username':
          cmp = (a.superadmin_username || '').localeCompare(b.superadmin_username || '');
          break;
        case 'created_at':
          cmp = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          break;
        case 'user_count':
          cmp = (a.user_count || 0) - (b.user_count || 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [organizations, searchQuery, statusFilter, planFilter, sortField, sortDir]);

  const uniquePlans = useMemo(() => {
    const plans = new Set(organizations.map(o => o.subscription_plan || 'free'));
    return Array.from(plans);
  }, [organizations]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-amber-400" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizations</h1>
          <p className="text-sm text-slate-400 mt-1">{organizations.length} client organizations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadData} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700">
            <RefreshCw size={14} className="mr-1" />Refresh
          </Button>
          <Button onClick={openCreate} size="sm" className="bg-amber-600 hover:bg-amber-700">
            <Plus size={14} className="mr-1" />Add Organization
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-sm"><AlertCircle size={16} />{error}<button onClick={() => setError('')} className="ml-auto">Dismiss</button></div>}
      {success && <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-md text-sm"><CheckCircle2 size={16} />{success}</div>}

      {/* Toolbar: Search, Sort, Filters, View Toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-slate-800 border-slate-600 text-white pl-9 h-9 text-sm"
            placeholder="Search by name, username, email..."
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1">
          <select
            value={sortField}
            onChange={e => setSortField(e.target.value as SortField)}
            className="h-9 px-2 pr-6 rounded-md border border-slate-600 bg-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
          >
            <option value="name">Name</option>
            <option value="username">Username</option>
            <option value="created_at">Date Created</option>
            <option value="user_count">User Count</option>
          </select>
          <button
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="h-9 w-9 flex items-center justify-center rounded-md border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700"
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            <ArrowUpDown size={14} className={sortDir === 'asc' ? '' : 'rotate-180'} />
          </button>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="h-9 px-2 pr-6 rounded-md border border-slate-600 bg-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* Plan Filter */}
        <select
          value={planFilter}
          onChange={e => setPlanFilter(e.target.value)}
          className="h-9 px-2 pr-6 rounded-md border border-slate-600 bg-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
        >
          <option value="all">All Plans</option>
          {uniquePlans.map(p => (
            <option key={p} value={p} className="capitalize">{p}</option>
          ))}
        </select>

        {/* View Toggle */}
        <div className="flex items-center border border-slate-600 rounded-md overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode('card')}
            className={`h-9 px-2 flex items-center gap-1 text-xs transition-colors ${viewMode === 'card' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            <LayoutGrid size={14} />Cards
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`h-9 px-2 flex items-center gap-1 text-xs transition-colors ${viewMode === 'list' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            <List size={14} />List
          </button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <Card className="w-full max-w-lg bg-slate-800 border-slate-700 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{editingOrg ? 'Edit Organization' : 'New Organization'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-slate-700"><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-slate-300">Name *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-slate-700 border-slate-600 text-white" placeholder="Organization name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">Registration #</Label>
                  <Input value={form.registration_number || ''} onChange={e => setForm({ ...form, registration_number: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">Tax #</Label>
                  <Input value={form.tax_number || ''} onChange={e => setForm({ ...form, tax_number: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">Email</Label>
                  <Input value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">Phone</Label>
                  <Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">Website</Label>
                  <Input value={form.website || ''} onChange={e => setForm({ ...form, website: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-slate-300">Address</Label>
                  <Input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">City</Label>
                  <Input value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">State</Label>
                  <Input value={form.state || ''} onChange={e => setForm({ ...form, state: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">Country</Label>
                  <Input value={form.country || ''} onChange={e => setForm({ ...form, country: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">Postal Code</Label>
                  <Input value={form.postal_code || ''} onChange={e => setForm({ ...form, postal_code: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">Subscription Plan</Label>
                  <select value={form.subscription_plan || 'free'} onChange={e => setForm({ ...form, subscription_plan: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-600 bg-slate-700 text-white text-sm">
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">Max Users</Label>
                  <Input type="number" value={form.max_users ?? ''} onChange={e => setForm({ ...form, max_users: e.target.value ? parseInt(e.target.value) : null })} className="bg-slate-700 border-slate-600 text-white" placeholder="Unlimited" min="1" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                  <span className="text-sm text-slate-300">Active</span>
                </label>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setShowForm(false)} className="text-slate-400">Cancel</Button>
                  <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
                    {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
                    {editingOrg ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <Card className="w-full max-w-sm bg-slate-800 border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="p-5 text-center">
              <Trash2 size={40} className="mx-auto text-red-400 mb-3" />
              <h3 className="text-lg font-semibold text-white">Delete Organization?</h3>
              <p className="text-sm text-slate-400 mt-1">This will soft-delete <strong className="text-white">{confirmDelete.name}</strong> and all linked data.</p>
              <div className="flex gap-2 mt-4 justify-center">
                <Button variant="ghost" onClick={() => setConfirmDelete(null)} className="text-slate-400">Cancel</Button>
                <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Card View */}
      {viewMode === 'card' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayedOrganizations.length === 0 && (
            <div className="col-span-full text-center text-slate-500 py-12">
              <Building2 size={48} className="mx-auto mb-3 opacity-30" />
              <p>No organizations found</p>
              <Button onClick={openCreate} size="sm" className="mt-3 bg-amber-600 hover:bg-amber-700"><Plus size={14} className="mr-1" />Create First Organization</Button>
            </div>
          )}
          {displayedOrganizations.map((org) => (
            <Card key={org.id} className={`bg-slate-800 border-slate-700 hover:border-slate-600 transition-all ${!org.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${org.is_active ? 'bg-blue-500/10' : 'bg-slate-700'}`}>
                    <Building2 size={20} className={org.is_active ? 'text-blue-400' : 'text-slate-500'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-white truncate">{org.name}</h3>
                    {org.legal_name && <p className="text-xs text-slate-500">{org.legal_name}</p>}
                    {org.superadmin_username && (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs text-slate-400">
                          <span className="text-slate-600">SA:</span> @{org.superadmin_username}
                        </p>
                        {org.superadmin_password && (
                          <p className="text-xs font-mono">
                            {org.superadmin_last_sign_in_at
                              ? <span className="text-slate-500 tracking-widest">••••••</span>
                              : <span className="text-amber-400">{org.superadmin_password}</span>
                            }
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setShowPasswordModal(org); setNewOrgPassword(''); }} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400" title="Set SA Password"><Key size={14} /></button>
                    <button onClick={() => openEdit(org)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400" title="Edit"><Pencil size={14} /></button>
                    <button onClick={() => handleLoginAs(org)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-green-400" title="Login as this org"><LogIn size={14} /></button>
                    <button onClick={() => toggleActive(org)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400" title={org.is_active ? 'Disable' : 'Enable'}>
                      {org.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                    </button>
                    <button onClick={() => setConfirmDelete(org)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-400">
                  {org.email && <div className="flex items-center gap-1.5"><Mail size={12} />{org.email}</div>}
                  {org.phone && <div className="flex items-center gap-1.5"><Phone size={12} />{org.phone}</div>}
                  {(org.city || org.country) && <div className="flex items-center gap-1.5"><MapPin size={12} />{[org.city, org.state, org.country].filter(Boolean).join(', ')}</div>}
                  {org.registration_number && <div className="flex items-center gap-1.5"><Hash size={12} />{org.registration_number}</div>}
                </div>

                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-700/50">
                  <Badge variant="outline" className={org.is_active ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}>
                    {org.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-slate-400"><Users size={12} />{org.user_count}{org.max_users ? ` / ${org.max_users}` : ''} users</div>
                  <Badge variant="outline" className="ml-auto text-[10px] bg-slate-700 text-slate-400 border-slate-600 uppercase">
                    {org.subscription_plan || 'free'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Organization</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Super Admin</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Email / Phone</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Plan</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Users</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {displayedOrganizations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-8">
                      <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                      No organizations found
                    </td>
                  </tr>
                )}
                {displayedOrganizations.map((org) => (
                  <tr key={org.id} className={`hover:bg-slate-700/30 transition-colors ${!org.is_active ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${org.is_active ? 'bg-blue-500/10' : 'bg-slate-700'}`}>
                          <Building2 size={14} className={org.is_active ? 'text-blue-400' : 'text-slate-500'} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate text-sm">{org.name}</p>
                          {org.legal_name && <p className="text-[11px] text-slate-500 truncate">{org.legal_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <span className="text-slate-300 text-xs">{org.superadmin_username || <span className="text-slate-600">—</span>}</span>
                        {org.superadmin_password && (
                          <p className="text-[11px] font-mono">
                            {org.superadmin_last_sign_in_at
                              ? <span className="text-slate-500 tracking-widest">••••••</span>
                              : <span className="text-amber-400">{org.superadmin_password}</span>
                            }
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5 text-[11px]">
                        {org.email && <div className="flex items-center gap-1 text-slate-400"><Mail size={10} />{org.email}</div>}
                        {org.phone && <div className="flex items-center gap-1 text-slate-400"><Phone size={10} />{org.phone}</div>}
                        {!org.email && !org.phone && <span className="text-slate-600">—</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px] bg-slate-700 text-slate-400 border-slate-600 uppercase">
                        {org.subscription_plan || 'free'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
                        <Users size={12} />{org.user_count}{org.max_users ? ` / ${org.max_users}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline" className={org.is_active ? 'bg-green-500/10 text-green-400 border-green-500/30 text-[10px]' : 'bg-red-500/10 text-red-400 border-red-500/30 text-[10px]'}>
                        {org.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setShowPasswordModal(org); setNewOrgPassword(''); }} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400" title="Set SA Password"><Key size={13} /></button>
                        <button onClick={() => openEdit(org)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400" title="Edit"><Pencil size={13} /></button>
                        <button onClick={() => handleLoginAs(org)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-green-400" title="Login as"><LogIn size={13} /></button>
                        <button onClick={() => toggleActive(org)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400" title={org.is_active ? 'Disable' : 'Enable'}>
                          {org.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                        </button>
                        <button onClick={() => setConfirmDelete(org)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400" title="Delete"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Password Reset Modal for Org Superadmin */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowPasswordModal(null)}>
          <Card className="w-full max-w-sm bg-slate-800 border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Key size={20} className="text-blue-400" />
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {showPasswordModal.superadmin_auth_id ? 'Update Super Admin Password' : 'Create Super Admin Login'}
                  </h3>
                  <p className="text-sm text-slate-400">{showPasswordModal.name}</p>
                  <p className="text-xs text-slate-500">
                    @{showPasswordModal.superadmin_username || 'no superadmin'}
                    {showPasswordModal.superadmin_email && <span className="ml-2 text-slate-600">{showPasswordModal.superadmin_email}</span>}
                  </p>
                </div>
              </div>
              {!showPasswordModal.superadmin_auth_id && (
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300">
                  No login yet. Set a password to create their Super Admin account.
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Password (min 6 chars)</label>
                <Input
                  type="text"
                  value={newOrgPassword}
                  onChange={e => setNewOrgPassword(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white font-mono"
                  placeholder="Enter new password"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShowPasswordModal(null)} className="text-slate-400">Cancel</Button>
                <Button onClick={handleOrgPasswordSave} disabled={passwordSaving || !newOrgPassword} className="bg-blue-600 hover:bg-blue-700">
                  {passwordSaving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                  {showPasswordModal.superadmin_auth_id ? 'Update Password' : 'Create & Set Password'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
