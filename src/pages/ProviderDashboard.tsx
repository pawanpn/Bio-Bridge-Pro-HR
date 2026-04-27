import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Users,
  ShieldOff,
  ShieldCheck,
  Lock,
  Unlock,
  Search,
  RefreshCw,
  Loader2,
  UserCheck,
  UserX,
  ChevronDown,
  ChevronRight,
  Globe,
  AlertCircle,
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  code?: string;
  is_active: boolean;
  created_at: string;
}

interface UserRecord {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  organization_id: string;
  last_login_at: string | null;
  created_at: string;
}

export const ProviderDashboard: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgUsers, setOrgUsers] = useState<Record<string, UserRecord[]>>({});
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [stats, setStats] = useState({ orgs: 0, users: 0, active: 0, locked: 0, superadmins: 0 });

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
      setOrganizations(orgs || []);

      if (orgs && orgs.length > 0) {
        const orgIds = orgs.map(o => o.id);

        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('*')
          .in('organization_id', orgIds)
          .order('role', { ascending: true })
          .order('username', { ascending: true });

        if (usersError) throw usersError;

        const grouped: Record<string, UserRecord[]> = {};
        for (const org of orgs) {
          grouped[org.id] = [];
        }
        for (const user of (users || [])) {
          if (user.organization_id && grouped[user.organization_id]) {
            grouped[user.organization_id].push(user);
          }
        }
        setOrgUsers(grouped);

        const allUsers = users || [];
        const supAdminCount = allUsers.filter(u => u.role === 'SUPER_ADMIN').length;
        setStats({
          orgs: orgs.length,
          users: allUsers.length,
          active: allUsers.filter(u => u.is_active).length,
          locked: allUsers.filter(u => !u.is_active).length,
          superadmins: supAdminCount,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleLockUser = async (userId: string, currentActive: boolean) => {
    try {
      setActionLoading(userId);
      setSuccessMsg('');

      const newState = !currentActive;
      const { error: updateError } = await supabase
        .from('users')
        .update({
          is_active: newState,
          locked_until: newState ? null : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      setOrgUsers(prev => {
        const updated = { ...prev };
        for (const orgId in updated) {
          updated[orgId] = updated[orgId].map(u =>
            u.id === userId ? { ...u, is_active: newState } : u
          );
        }
        return updated;
      });

      setStats(prev => ({
        ...prev,
        active: prev.active + (newState ? 1 : -1),
        locked: prev.locked + (newState ? -1 : 1),
      }));

      setSuccessMsg(`User ${newState ? 'unlocked' : 'locked'} successfully`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleOrg = (orgId: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  };

  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (org.code && org.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
    return (
      <Badge variant="outline" className={`text-[10px] ${colors[role] || 'bg-slate-500/10 text-slate-400'}`}>
        {role.replace(/_/g, ' ')}
      </Badge>
    );
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Provider Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Manage client organizations and superadmin access</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Building2 size={14} />
              Organizations
            </div>
            <div className="text-2xl font-bold text-white">{stats.orgs}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Users size={14} />
              Total Users
            </div>
            <div className="text-2xl font-bold text-white">{stats.users}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <ShieldCheck size={14} />
              Super Admins
            </div>
            <div className="text-2xl font-bold text-amber-400">{stats.superadmins}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-400 text-xs mb-1">
              <UserCheck size={14} />
              Active
            </div>
            <div className="text-2xl font-bold text-green-400">{stats.active}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-400 text-xs mb-1">
              <UserX size={14} />
              Locked
            </div>
            <div className="text-2xl font-bold text-red-400">{stats.locked}</div>
          </CardContent>
        </Card>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-sm">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="Search organizations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Organizations List */}
      <div className="space-y-3">
        {filteredOrgs.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            <Building2 size={48} className="mx-auto mb-3 opacity-30" />
            <p>No organizations found</p>
          </div>
        )}

        {filteredOrgs.map((org) => {
          const users = orgUsers[org.id] || [];
          const superAdmins = users.filter(u => u.role === 'SUPER_ADMIN');
          const isExpanded = expandedOrgs.has(org.id);

          return (
            <Card key={org.id} className="bg-slate-800 border-slate-700 overflow-hidden">
              {/* Org Header */}
              <button
                onClick={() => toggleOrg(org.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    org.is_active ? 'bg-blue-500/10' : 'bg-slate-700'
                  }`}>
                    <Building2 size={20} className={org.is_active ? 'text-blue-400' : 'text-slate-500'} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{org.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {org.code && <span>{org.code}</span>}
                      <Badge variant="outline" className={org.is_active ? 'text-green-400 border-green-500/30' : 'text-slate-500'}>
                        {org.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <span>· {users.length} users</span>
                      <span>· {superAdmins.length} super admins</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {superAdmins.some(sa => !sa.is_active) && (
                    <Badge variant="outline" className="text-red-400 border-red-500/30 text-[10px]">
                      <Lock size={10} className="mr-1" />
                      Locked
                    </Badge>
                  )}
                  {isExpanded ? (
                    <ChevronDown size={18} className="text-slate-500" />
                  ) : (
                    <ChevronRight size={18} className="text-slate-500" />
                  )}
                </div>
              </button>

              {/* Expanded Users List */}
              {isExpanded && (
                <div className="border-t border-slate-700">
                  {/* Super Admins First */}
                  {superAdmins.length > 0 && (
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2 text-xs text-amber-400 font-semibold uppercase tracking-wider">
                        <ShieldOff size={12} />
                        Super Admins
                      </div>
                      <div className="space-y-1">
                        {superAdmins.map((user) => (
                          <UserRow
                            key={user.id}
                            user={user}
                            loading={actionLoading === user.id}
                            onToggleLock={() => toggleLockUser(user.id, user.is_active)}
                            getRoleBadge={getRoleBadge}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Other Users */}
                  {users.filter(u => u.role !== 'SUPER_ADMIN').length > 0 && (
                    <div className="p-3 border-t border-slate-700/50">
                      <div className="flex items-center gap-2 mb-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                        <Users size={12} />
                        Other Users
                      </div>
                      <div className="space-y-1">
                        {users.filter(u => u.role !== 'SUPER_ADMIN').map((user) => (
                          <UserRow
                            key={user.id}
                            user={user}
                            loading={actionLoading === user.id}
                            onToggleLock={() => toggleLockUser(user.id, user.is_active)}
                            getRoleBadge={getRoleBadge}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const UserRow: React.FC<{
  user: UserRecord;
  loading: boolean;
  onToggleLock: () => void;
  getRoleBadge: (role: string) => React.ReactNode;
}> = ({ user, loading, onToggleLock, getRoleBadge }) => (
  <div className={`flex items-center justify-between px-3 py-2 rounded-md ${
    user.is_active ? 'bg-slate-800/50' : 'bg-red-500/5 border border-red-500/10'
  }`}>
    <div className="flex items-center gap-3 min-w-0">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        user.is_active ? 'bg-green-500' : 'bg-red-500'
      }`} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${user.is_active ? 'text-slate-200' : 'text-slate-500'}`}>
            {user.full_name || user.username}
          </span>
          {getRoleBadge(user.role)}
        </div>
        <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
      </div>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {user.last_login_at && (
        <span className="text-[10px] text-slate-600 hidden md:inline">
          Last: {new Date(user.last_login_at).toLocaleDateString()}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
        disabled={loading}
        className={`h-7 px-2 text-xs ${
          user.is_active
            ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
            : 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
        }`}
        title={user.is_active ? 'Lock this user' : 'Unlock this user'}
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : user.is_active ? (
          <Lock size={12} className="mr-1" />
        ) : (
          <Unlock size={12} className="mr-1" />
        )}
        {user.is_active ? 'Lock' : 'Unlock'}
      </Button>
    </div>
  </div>
);
