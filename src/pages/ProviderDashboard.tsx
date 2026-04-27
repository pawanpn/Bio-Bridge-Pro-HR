import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Users, ShieldCheck, ShieldOff, UserCheck,
  UserX, Search, RefreshCw, Loader2, Lock, Unlock,
  ChevronDown, ChevronRight, ArrowUpRight, Activity,
  Clock, TrendingUp, Zap, AlertCircle, CheckCircle2,
  BarChart3, PieChart, Globe,
} from 'lucide-react';

interface OrgRecord { id: string; name: string; code?: string; email?: string; is_active: boolean; subscription_plan?: string; created_at: string; }
interface UserRecord { id: string; username: string; email: string; full_name: string; role: string; is_active: boolean; organization_id: string; last_login_at: string | null; created_at: string; }

export const ProviderDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [orgUsers, setOrgUsers] = useState<Record<string, UserRecord[]>>({});
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try { setLoading(true); setError('');
      const { data: o, error: oe } = await supabase.from('organizations').select('*').order('name');
      if (oe) throw oe;
      const orgList = (o || []) as OrgRecord[];
      setOrgs(orgList);

      if (orgList.length > 0) {
        const ids = orgList.map(x => x.id);
        const { data: u, error: ue } = await supabase.from('users').select('*').in('organization_id', ids).order('role').order('username');
        if (ue) throw ue;
        const userList = (u || []) as UserRecord[];
        setUsers(userList);
        const grouped: Record<string, UserRecord[]> = {};
        for (const org of orgList) grouped[org.id] = [];
        for (const u of userList) { if (grouped[u.organization_id]) grouped[u.organization_id].push(u); }
        setOrgUsers(grouped);
      } else { setUsers([]); setOrgUsers({}); }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const handleRefresh = () => { setRefreshing(true); loadData(); };

  const toggleLock = async (userId: string, current: boolean) => {
    try { setActionLoading(userId);
      const ns = !current;
      await supabase.from('users').update({ is_active: ns, locked_until: ns ? null : new Date(Date.now() + 100 * 365 * 86400000).toISOString() }).eq('id', userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: ns } : u));
      setOrgUsers(prev => { const n = { ...prev }; for (const k in n) n[k] = n[k].map(u => u.id === userId ? { ...u, is_active: ns } : u); return n; });
      setSuccess(`User ${ns ? 'unlocked' : 'locked'}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.message); }
    finally { setActionLoading(null); }
  };

  const toggleOrg = (id: string) => setExpandedOrgs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filteredOrgs = orgs.filter(o => o.name.toLowerCase().includes(searchTerm.toLowerCase()) || (o.code || '').toLowerCase().includes(searchTerm.toLowerCase()));

  // --- computed stats (all dynamic) ---
  const totalOrgs = orgs.length;
  const activeOrgs = orgs.filter(o => o.is_active).length;
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.is_active).length;
  const lockedUsers = users.filter(u => !u.is_active).length;
  const superAdmins = users.filter(u => u.role === 'SUPER_ADMIN').length;
  const providers = users.filter(u => u.role === 'PROVIDER').length;

  // role distribution
  const roleDist: Record<string, number> = {};
  users.forEach(u => { roleDist[u.role] = (roleDist[u.role] || 0) + 1; });

  // plan distribution
  const planDist: Record<string, number> = {};
  orgs.forEach(o => { const p = o.subscription_plan || 'free'; planDist[p] = (planDist[p] || 0) + 1; });

  // recent orgs (last 5 by created_at)
  const recentOrgs = [...orgs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  // recent users (last 5 by created_at)
  const recentUsers = [...users].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  // orgs with most users
  const topOrgs = [...orgs].map(o => ({ ...o, uc: (orgUsers[o.id] || []).length })).sort((a, b) => b.uc - a.uc).slice(0, 5);

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      SUPER_ADMIN: 'bg-red-500/10 text-red-400 border-red-500/30',
      ADMIN: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      MANAGER: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      SUPERVISOR: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      EMPLOYEE: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      OPERATOR: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      VIEWER: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      PROVIDER: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    };
    return <Badge variant="outline" className={`text-[10px] ${colors[role] || 'bg-slate-500/10 text-slate-400'}`}>{role.replace(/_/g, ' ')}</Badge>;
  };

  if (loading && orgs.length === 0) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-amber-400" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Provider Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time overview of all client organizations and users</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700" disabled={refreshing}>
          {refreshing ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
          Refresh
        </Button>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-sm"><AlertCircle size={16} />{error}<button onClick={() => setError('')} className="ml-auto">Dismiss</button></div>}
      {success && <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-md text-sm"><CheckCircle2 size={16} />{success}</div>}

      {/* ==================== STATS ROW ==================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatsCard icon={<Building2 size={18} />} label="Organizations" value={totalOrgs} sub={`${activeOrgs} active`} color="blue" />
        <StatsCard icon={<Users size={18} />} label="Total Users" value={totalUsers} sub={`across ${totalOrgs} orgs`} color="slate" />
        <StatsCard icon={<ShieldCheck size={18} />} label="Super Admins" value={superAdmins} sub="org owners" color="amber" />
        <StatsCard icon={<UserCheck size={18} />} label="Active" value={activeUsers} sub={`${users.length ? Math.round((activeUsers / users.length) * 100) : 0}% of all`} color="green" />
        <StatsCard icon={<UserX size={18} />} label="Locked" value={lockedUsers} sub="disabled accounts" color="red" />
        <StatsCard icon={<Activity size={18} />} label="Providers" value={providers} sub="system accounts" color="purple" />
        <StatsCard icon={<Globe size={18} />} label="Plans" value={Object.keys(planDist).length} sub="subscription tiers" color="teal" />
      </div>

      {/* ==================== CHARTS ROW ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Role Distribution */}
        <Card className="bg-slate-800 border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center gap-2">
            <PieChart size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Role Distribution</h3>
          </div>
          <div className="p-4 space-y-2">
            {Object.entries(roleDist).sort(([,a], [,b]) => b - a).map(([role, count]) => {
              const pct = users.length ? Math.round((count / users.length) * 100) : 0;
              return (
                <div key={role} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{role.replace(/_/g, ' ')}</span>
                    <span className="text-slate-500">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${pct > 30 ? 'bg-red-500' : pct > 15 ? 'bg-amber-500' : pct > 5 ? 'bg-blue-500' : 'bg-slate-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(roleDist).length === 0 && <p className="text-xs text-slate-500 py-4 text-center">No users yet</p>}
          </div>
        </Card>

        {/* Plan Distribution */}
        <Card className="bg-slate-800 border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Subscription Plans</h3>
          </div>
          <div className="p-4 space-y-2">
            {Object.entries(planDist).sort(([,a], [,b]) => b - a).map(([plan, count]) => {
              const pct = orgs.length ? Math.round((count / orgs.length) * 100) : 0;
              return (
                <div key={plan} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 capitalize">{plan}</span>
                    <span className="text-slate-500">{count} org{count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${plan === 'enterprise' ? 'bg-purple-500' : plan === 'professional' ? 'bg-blue-500' : plan === 'starter' ? 'bg-amber-500' : 'bg-slate-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(planDist).length === 0 && <p className="text-xs text-slate-500 py-4 text-center">No organizations yet</p>}
          </div>
        </Card>

        {/* Top Orgs by Users */}
        <Card className="bg-slate-800 border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-400" />
            <h3 className="text-sm font-semibold text-white">Top Organizations</h3>
          </div>
          <div className="p-4 space-y-2">
            {topOrgs.filter(o => o.uc > 0).map((org, i) => (
              <div key={org.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-600 w-4">{i + 1}.</span>
                  <span className="text-slate-300 truncate">{org.name}</span>
                </div>
                <span className="text-slate-400 flex-shrink-0">{org.uc} user{org.uc !== 1 ? 's' : ''}</span>
              </div>
            ))}
            {topOrgs.filter(o => o.uc > 0).length === 0 && <p className="text-xs text-slate-500 py-4 text-center">No users assigned</p>}
          </div>
        </Card>
      </div>

      {/* ==================== RECENT ACTIVITY ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Orgs */}
        <Card className="bg-slate-800 border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Recent Organizations</h3>
          </div>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {recentOrgs.map(org => (
              <div key={org.id} className="flex items-center justify-between py-1.5 border-b border-slate-700/50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-slate-200 truncate">{org.name}</p>
                  <p className="text-[11px] text-slate-500">{org.email || 'No email'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className={`text-[10px] ${org.is_active ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'}`}>
                    {org.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <span className="text-[10px] text-slate-600">{new Date(org.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {recentOrgs.length === 0 && <p className="text-xs text-slate-500 py-4 text-center">No organizations yet</p>}
          </div>
        </Card>

        {/* Recent Users */}
        <Card className="bg-slate-800 border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center gap-2">
            <Zap size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Recent Users</h3>
          </div>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {recentUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between py-1.5 border-b border-slate-700/50 last:border-0">
                <div className="min-w-0 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="text-sm text-slate-200 truncate">{user.full_name || user.username}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getRoleBadge(user.role)}
                  <span className="text-[10px] text-slate-600">{new Date(user.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {recentUsers.length === 0 && <p className="text-xs text-slate-500 py-4 text-center">No users yet</p>}
          </div>
        </Card>
      </div>

      {/* ==================== QUICK CONTROL PANEL ==================== */}
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-4 border-b border-slate-700 flex items-center gap-2">
          <Search size={16} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-white">Organization Control Panel</h3>
        </div>
        <div className="p-4">
          <div className="relative max-w-sm mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input placeholder="Search organizations..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredOrgs.length === 0 && <p className="text-sm text-slate-500 py-6 text-center"><Building2 size={24} className="mx-auto mb-1 opacity-30" />No organizations found</p>}
            {filteredOrgs.map(org => {
              const usrs = orgUsers[org.id] || [];
              const sas = usrs.filter(u => u.role === 'SUPER_ADMIN');
              const others = usrs.filter(u => u.role !== 'SUPER_ADMIN');
              const isExp = expandedOrgs.has(org.id);
              return (
                <div key={org.id} className="border border-slate-700 rounded-lg overflow-hidden">
                  <button onClick={() => toggleOrg(org.id)} className="w-full flex items-center justify-between p-3 hover:bg-slate-700/30 transition-colors text-left">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${org.is_active ? 'bg-blue-500/10' : 'bg-slate-700'}`}>
                        <Building2 size={18} className={org.is_active ? 'text-blue-400' : 'text-slate-500'} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{org.name}</p>
                        <p className="text-[11px] text-slate-500">{usrs.length} users · {sas.length} super admin{sas.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {sas.some(sa => !sa.is_active) && <Badge variant="outline" className="text-red-400 border-red-500/30 text-[10px]"><Lock size={10} className="mr-0.5" />Locked</Badge>}
                      {isExp ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                    </div>
                  </button>
                  {isExp && (
                    <div className="border-t border-slate-700">
                      {sas.length > 0 && (
                        <div className="p-2">
                          <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider px-2 py-1">Super Admins</p>
                          {sas.map(u => <UserRow key={u.id} user={u} loading={actionLoading === u.id} onToggle={() => toggleLock(u.id, u.is_active)} getRoleBadge={getRoleBadge} />)}
                        </div>
                      )}
                      {others.length > 0 && (
                        <div className="p-2 border-t border-slate-700/50">
                          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-2 py-1">Other Users ({others.length})</p>
                          {others.map(u => <UserRow key={u.id} user={u} loading={actionLoading === u.id} onToggle={() => toggleLock(u.id, u.is_active)} getRoleBadge={getRoleBadge} />)}
                        </div>
                      )}
                      {usrs.length === 0 && <p className="text-xs text-slate-600 p-3 text-center">No users in this organization</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
};

// ── Sub-components ──

const StatsCard: React.FC<{ icon: React.ReactNode; label: string; value: number; sub: string; color: string }> = ({ icon, label, value, sub, color }) => {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-400', amber: 'text-amber-400', green: 'text-green-400', red: 'text-red-400',
    purple: 'text-purple-400', teal: 'text-teal-400', slate: 'text-slate-400',
  };
  return (
    <Card className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className={colorMap[color] || 'text-slate-400'}>{icon}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-xl font-bold text-white">{value}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  );
};

const UserRow: React.FC<{
  user: UserRecord; loading: boolean; onToggle: () => void;
  getRoleBadge: (role: string) => React.ReactNode;
}> = ({ user, loading, onToggle, getRoleBadge }) => (
  <div className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${user.is_active ? 'hover:bg-slate-700/50' : 'bg-red-500/5 border border-red-500/10'}`}>
    <div className="flex items-center gap-2 min-w-0">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className={`truncate ${user.is_active ? 'text-slate-300' : 'text-slate-600'}`}>{user.full_name || user.username}</span>
      {getRoleBadge(user.role)}
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {user.last_login_at && <span className="text-[10px] text-slate-600">{new Date(user.last_login_at).toLocaleDateString()}</span>}
      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); onToggle(); }} disabled={loading}
        className={`h-6 px-1.5 text-[10px] ${user.is_active ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-green-400 hover:text-green-300 hover:bg-green-500/10'}`}>
        {loading ? <Loader2 size={10} className="animate-spin" /> : user.is_active ? <><Lock size={10} className="mr-0.5" />Lock</> : <><Unlock size={10} className="mr-0.5" />Unlock</>}
      </Button>
    </div>
  </div>
);
