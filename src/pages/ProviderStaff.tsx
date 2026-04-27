import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useProviderAuth, ProviderRole } from '@/context/ProviderAuthContext';
import {
  Users, Plus, RefreshCw, Loader2, X, Save, Shield,
  AlertCircle, CheckCircle2, User as UserIcon, ShieldOff,
  Pencil, Power, PowerOff, UserX, UserCheck,
} from 'lucide-react';

interface ProviderStaff {
  id: number; username: string; pin: string; full_name: string;
  email: string; role: ProviderRole; is_active: boolean;
  created_at: string;
}

const emptyStaff = {
  username: '', pin: '', full_name: '', email: '',
  role: 'PROVIDER_MONITOR' as ProviderRole, is_active: true,
};

const ROLE_OPTIONS: { value: ProviderRole; label: string; color: string }[] = [
  { value: 'PROVIDER_OWNER', label: 'Owner', color: 'text-amber-400' },
  { value: 'PROVIDER_ADMIN', label: 'Admin', color: 'text-blue-400' },
  { value: 'PROVIDER_BILLING', label: 'Billing', color: 'text-emerald-400' },
  { value: 'PROVIDER_SUPPORT', label: 'Support', color: 'text-purple-400' },
  { value: 'PROVIDER_MONITOR', label: 'Monitor', color: 'text-slate-400' },
];

export const ProviderStaff: React.FC = () => {
  const { providerUser } = useProviderAuth();
  const [staff, setStaff] = useState<ProviderStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProviderStaff | null>(null);
  const [form, setForm] = useState({ ...emptyStaff });

  useEffect(() => { loadStaff(); }, []);

  const loadStaff = async () => {
    try { setLoading(true); setError('');
      const { data, error: e } = await supabase.from('provider_users').select('*').order('role').order('username');
      if (e) throw e;
      setStaff(data || []);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm({ ...emptyStaff }); setShowForm(true); };
  const openEdit = (s: ProviderStaff) => {
    setEditing(s);
    setForm({ username: s.username, pin: s.pin, full_name: s.full_name || '', email: s.email || '', role: s.role, is_active: s.is_active });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.username || !form.pin) { setError('Username and PIN required'); return; }
    if (form.pin.length < 6) { setError('PIN must be at least 6 characters'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = {
        username: form.username, pin: form.pin,
        full_name: form.full_name || null, email: form.email || null,
        role: form.role, is_active: form.is_active,
      };
      if (editing) {
        const { error: e } = await supabase.from('provider_users').update(payload).eq('id', editing.id);
        if (e) throw e;
        setSuccess(`${form.username} updated`);
      } else {
        const { error: e } = await supabase.from('provider_users').insert(payload);
        if (e) throw e;
        setSuccess(`${form.username} created`);
      }
      setShowForm(false); loadStaff(); setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (s: ProviderStaff) => {
    try {
      const ns = !s.is_active;
      await supabase.from('provider_users').update({ is_active: ns }).eq('id', s.id);
      setStaff(prev => prev.map(st => st.id === s.id ? { ...st, is_active: ns } : st));
      setSuccess(`${s.username} ${ns ? 'enabled' : 'disabled'}`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) { setError(err.message); }
  };

  const getRoleBadge = (role: ProviderRole) => {
    const opt = ROLE_OPTIONS.find(r => r.value === role);
    return <Badge variant="outline" className={`text-[10px] bg-slate-700 border-slate-600 ${opt?.color || ''}`}>{opt?.label || role}</Badge>;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-amber-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Provider Staff</h1>
          <p className="text-sm text-slate-400 mt-1">{staff.length} staff accounts · Manage who accesses the provider portal</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadStaff} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700"><RefreshCw size={14} className="mr-1" />Refresh</Button>
          <Button onClick={openCreate} size="sm" className="bg-amber-600 hover:bg-amber-700"><Plus size={14} className="mr-1" />Add Staff</Button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-sm"><AlertCircle size={16} />{error}<button onClick={() => setError('')} className="ml-auto">Dismiss</button></div>}
      {success && <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-md text-sm"><CheckCircle2 size={16} />{success}</div>}

      {/* Staff Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {staff.length === 0 && <div className="col-span-full text-center text-slate-500 py-12"><Shield size={48} className="mx-auto mb-3 opacity-30" /><p>No staff accounts</p></div>}
        {staff.map(s => (
          <Card key={s.id} className={`bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${s.is_active ? 'bg-amber-500/10' : 'bg-slate-700'}`}>
                    <Shield size={20} className={s.is_active ? 'text-amber-400' : 'text-slate-500'} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{s.full_name || s.username}</p>
                    <p className="text-[11px] text-slate-500">@{s.username}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400"><Pencil size={13} /></button>
                  <button onClick={() => toggleActive(s)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400">
                    {s.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                  </button>
                </div>
              </div>
              {s.email && <p className="text-xs text-slate-500 mb-2 truncate">{s.email}</p>}
              <div className="flex items-center gap-2">
                {getRoleBadge(s.role)}
                <Badge variant="outline" className={`text-[10px] ${s.is_active ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                  {s.is_active ? <span className="flex items-center gap-1"><UserCheck size={10} />Active</span> : <span className="flex items-center gap-1"><UserX size={10} />Disabled</span>}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <Card className="w-full max-w-md bg-slate-800 border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">{editing ? 'Edit Staff' : 'Add Staff'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-slate-700"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-xs text-slate-400">Username *</label><Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="bg-slate-700 border-slate-600 text-white h-9" placeholder="e.g. ramesh" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">PIN * (6+ chars)</label><Input value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} className="bg-slate-700 border-slate-600 text-white h-9" placeholder="PIN" /></div>
              </div>
              <div className="space-y-1"><label className="text-xs text-slate-400">Full Name</label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="bg-slate-700 border-slate-600 text-white h-9" /></div>
              <div className="space-y-1"><label className="text-xs text-slate-400">Email</label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-slate-700 border-slate-600 text-white h-9" /></div>
              <div className="space-y-1"><label className="text-xs text-slate-400">Role</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as ProviderRole })} className="w-full h-9 px-2 rounded-md border border-slate-600 bg-slate-700 text-white text-sm">
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                <span className="text-sm text-slate-300">Active account</span>
              </label>
              <div className="flex gap-2 pt-2 justify-end">
                <Button variant="ghost" onClick={() => setShowForm(false)} className="text-slate-400">Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700">{saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}{editing ? 'Update' : 'Create'}</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
