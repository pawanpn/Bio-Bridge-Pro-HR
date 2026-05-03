import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProviderAuth, ProviderRole, ProviderModule, PROVIDER_MODULES } from '@/context/ProviderAuthContext';
import {
  Shield, ShieldCheck, RefreshCw, Loader2, X, Save,
  AlertCircle, CheckCircle2, ShieldAlert, ShieldOff,
  Eye, EyeOff, Edit3, Lock, Unlock,
} from 'lucide-react';

interface RoleRecord {
  id: number; role_name: ProviderRole; label: string;
  description: string; permissions: ProviderModule[]; is_system: boolean;
}

const MODULE_LABELS: Record<ProviderModule, { label: string; icon: string }> = {
  dashboard: { label: 'Dashboard', icon: '📊' },
  organizations: { label: 'Organizations', icon: '🏢' },
  users: { label: 'Client Users', icon: '👥' },
  billing: { label: 'Billing', icon: '💰' },
  crm: { label: 'Support CRM', icon: '🎫' },
  monitoring: { label: 'Monitoring', icon: '📈' },
  staff: { label: 'Staff Mgmt', icon: '🛡️' },
  roles: { label: 'Roles & Perms', icon: '🔐' },
  setup: { label: 'System Setup', icon: '⚙️' },
};

const ROLE_COLORS: Record<ProviderRole, string> = {
  PROVIDER_OWNER: 'border-amber-500/30 bg-amber-500/5',
  PROVIDER_ADMIN: 'border-blue-500/30 bg-blue-500/5',
  PROVIDER_BILLING: 'border-emerald-500/30 bg-emerald-500/5',
  PROVIDER_SUPPORT: 'border-purple-500/30 bg-purple-500/5',
  PROVIDER_MONITOR: 'border-slate-500/30 bg-slate-500/5',
};

export const ProviderRoles: React.FC = () => {
  const { permissions: myPerms, refreshPermissions } = useProviderAuth();
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [editPerms, setEditPerms] = useState<ProviderModule[]>([]);

  useEffect(() => { loadRoles(); }, []);

  const loadRoles = async () => {
    try { setLoading(true); setError('');
      const { data, error: e } = await supabase.from('provider_roles').select('*').order('role_name');
      if (e) throw e;
      setRoles((data || []).map((r: any) => ({ ...r, permissions: Array.isArray(r.permissions) ? r.permissions : [] })));
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const openEdit = (role: RoleRecord) => {
    setEditingRole(role);
    setEditPerms([...role.permissions]);
  };

  const togglePerm = (mod: ProviderModule) => {
    setEditPerms(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]);
  };

  const handleSave = async () => {
    if (!editingRole) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const { error: e } = await supabase.from('provider_roles').update({ permissions: editPerms }).eq('id', editingRole.id);
      if (e) throw e;
      setRoles(prev => prev.map(r => r.id === editingRole.id ? { ...r, permissions: editPerms } : r));
      setSuccess(`${editingRole.label} permissions updated`);
      setEditingRole(null);
      await refreshPermissions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-amber-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Roles & Permissions</h1>
          <p className="text-sm text-slate-400 mt-1">Define what each provider role can access · {roles.length} roles defined</p>
        </div>
        <Button onClick={loadRoles} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700"><RefreshCw size={14} className="mr-1" />Refresh</Button>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-sm"><AlertCircle size={16} />{error}<button onClick={() => setError('')} className="ml-auto">Dismiss</button></div>}
      {success && <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-md text-sm"><CheckCircle2 size={16} />{success}</div>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map(role => (
          <Card key={role.id} className={`bg-slate-800 border ${ROLE_COLORS[role.role_name] || 'border-slate-700'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield size={18} className={role.role_name === 'PROVIDER_OWNER' ? 'text-amber-400' : role.role_name === 'PROVIDER_ADMIN' ? 'text-blue-400' : 'text-slate-400'} />
                  <h3 className="text-sm font-semibold text-white">{role.label}</h3>
                  {role.is_system && <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-600">system</Badge>}
                </div>
                <button onClick={() => openEdit(role)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400"><Edit3 size={13} /></button>
              </div>
              {role.description && <p className="text-xs text-slate-500 mb-2">{role.description}</p>}
              <div className="flex flex-wrap gap-1">
                {PROVIDER_MODULES.map(mod => (
                  <Badge key={mod} variant="outline" className={`text-[10px] ${role.permissions.includes(mod) ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-slate-700/50 text-slate-600 border-slate-700'}`}>
                    {role.permissions.includes(mod) ? <Eye size={10} className="mr-0.5" /> : <EyeOff size={10} className="mr-0.5" />}
                    {MODULE_LABELS[mod]?.label || mod}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Permissions Modal */}
      {editingRole && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEditingRole(null)}>
          <Card className="w-full max-w-md bg-slate-800 border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Edit: {editingRole.label}</h3>
                <p className="text-xs text-slate-500">Toggle module access for this role</p>
              </div>
              <button onClick={() => setEditingRole(null)} className="p-1 rounded hover:bg-slate-700"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {PROVIDER_MODULES.map(mod => {
                const has = editPerms.includes(mod);
                return (
                  <button key={mod} onClick={() => togglePerm(mod)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      has ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'
                    }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{MODULE_LABELS[mod]?.icon}</span>
                      <div>
                        <p className={`text-sm font-medium ${has ? 'text-green-400' : 'text-slate-400'}`}>{MODULE_LABELS[mod]?.label}</p>
                        <p className="text-[10px] text-slate-600">Module: {mod}</p>
                      </div>
                    </div>
                    {has ? <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t border-slate-700 flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEditingRole(null)} className="text-slate-400">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
                {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
                Save Changes
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
