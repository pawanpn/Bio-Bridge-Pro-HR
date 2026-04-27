import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2, RefreshCw, Loader2, Users, Globe, AlertCircle,
  Plus, Pencil, Power, PowerOff, Trash2, X, CheckCircle2,
  Mail, Phone, MapPin, Hash, Save
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
  created_at?: string;
  user_count?: number;
}

const emptyOrg: Organization = {
  id: '', name: '', legal_name: '', registration_number: '', tax_number: '',
  email: '', phone: '', website: '', address: '', city: '', state: '',
  country: 'Nepal', postal_code: '', is_active: true, subscription_plan: 'free'
};

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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true); setError('');
      const { data: orgs, error: orgError } = await supabase
        .from('organizations').select('*').order('name');
      if (orgError) throw orgError;
      const withCounts = await Promise.all((orgs || []).map(async (org) => {
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('organization_id', org.id);
        return { ...org, user_count: count || 0 };
      }));
      setOrganizations(withCounts);
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
        is_active: form.is_active, subscription_plan: form.subscription_plan || 'free'
      };

      if (editingOrg) {
        const { error: updErr } = await supabase.from('organizations').update(payload).eq('id', editingOrg.id);
        if (updErr) throw updErr;
        setSuccess('Organization updated');
      } else {
        const { error: insErr } = await supabase.from('organizations').insert(payload);
        if (insErr) throw insErr;
        setSuccess('Organization created');
      }

      setShowForm(false);
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
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
                <div className="col-span-2 space-y-1">
                  <Label className="text-slate-300">Subscription Plan</Label>
                  <select value={form.subscription_plan || 'free'} onChange={e => setForm({ ...form, subscription_plan: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-600 bg-slate-700 text-white text-sm">
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
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

      {/* Organization Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {organizations.length === 0 && (
          <div className="col-span-full text-center text-slate-500 py-12">
            <Building2 size={48} className="mx-auto mb-3 opacity-30" />
            <p>No organizations found</p>
            <Button onClick={openCreate} size="sm" className="mt-3 bg-amber-600 hover:bg-amber-700"><Plus size={14} className="mr-1" />Create First Organization</Button>
          </div>
        )}
        {organizations.map((org) => (
          <Card key={org.id} className={`bg-slate-800 border-slate-700 hover:border-slate-600 transition-all ${!org.is_active ? 'opacity-60' : ''}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${org.is_active ? 'bg-blue-500/10' : 'bg-slate-700'}`}>
                  <Building2 size={20} className={org.is_active ? 'text-blue-400' : 'text-slate-500'} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white truncate">{org.name}</h3>
                  {org.legal_name && <p className="text-xs text-slate-500">{org.legal_name}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(org)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400" title="Edit"><Pencil size={14} /></button>
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
                <div className="flex items-center gap-1 text-xs text-slate-400"><Users size={12} />{org.user_count} users</div>
                <Badge variant="outline" className="ml-auto text-[10px] bg-slate-700 text-slate-400 border-slate-600 uppercase">
                  {org.subscription_plan || 'free'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
