import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Lock,
  Unlock,
  Search,
  RefreshCw,
  Loader2,
  UserX,
  UserCheck,
  ShieldOff,
  AlertCircle,
  Filter,
  Key,
  LogIn,
  CheckCircle2,
  EyeOff,
  Eye,
} from 'lucide-react';

interface UserRecord {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  organization_id: string;
  organization_name?: string;
  created_at: string;
  auth_id?: string;
  last_sign_in_at?: string | null;
}

export const ProviderClientUsers: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState<UserRecord | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [confirmImpersonate, setConfirmImpersonate] = useState<UserRecord | null>(null);
  const [userPasswords, setUserPasswords] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('biobridge_user_passwords') || '{}'); }
    catch { return {}; }
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let filtered = [...users];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.username?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.full_name?.toLowerCase().includes(term) ||
        u.organization_name?.toLowerCase().includes(term)
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    if (statusFilter === 'active') {
      filtered = filtered.filter(u => u.is_active);
    } else if (statusFilter === 'locked') {
      filtered = filtered.filter(u => !u.is_active);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name');

      const orgMap: Record<string, string> = {};
      (orgs || []).forEach(o => { orgMap[o.id] = o.name; });

      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('*')
        .neq('role', 'PROVIDER')
        .order('organization_id', { ascending: true })
        .order('role', { ascending: true });

      if (usersError) throw usersError;

      const mapped = (allUsers || []).map(u => ({
        ...u,
        organization_name: orgMap[u.organization_id] || 'No Org',
      }));

      const serviceKey = localStorage.getItem('supabaseServiceKey') || '';
      const supabaseUrl = localStorage.getItem('supabaseUrl') || import.meta.env.VITE_SUPABASE_URL || '';
      if (serviceKey && supabaseUrl) {
        try {
          const adminClient = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
          });
          const { data: authData } = await adminClient.auth.admin.listUsers();
          const authLastSignIn: Record<string, string | null> = {};
          (authData?.users || []).forEach(au => {
            authLastSignIn[au.id] = au.last_sign_in_at || null;
          });
          mapped.forEach(u => {
            const lookupId = u.auth_id || u.id;
            u.last_sign_in_at = authLastSignIn[lookupId] || null;
          });
        } catch { /* silently ignore — password column will show '—' */ }
      }

      setUsers(mapped);
      setFilteredUsers(mapped);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const toggleLock = async (userId: string, currentActive: boolean, role: string) => {
    if (role === 'PROVIDER') { setError('Cannot lock provider portal accounts from here. Use Staff page.'); return; }
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

      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, is_active: newState } : u
      ));

      setSuccessMsg(`User ${newState ? 'unlocked' : 'locked'} successfully`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      SUPER_ADMIN: 'bg-red-500/10 text-red-400 border-red-500/30',
      ADMIN: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      MANAGER: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      SUPERVISOR: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      EMPLOYEE: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      OPERATOR: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      VIEWER: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    };
    return (
      <Badge variant="outline" className={`text-[10px] ${colors[role] || ''}`}>
        {role.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const handleSetPassword = async () => {
    if (!showPasswordModal || !newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setPasswordSaving(true); setError(''); setSuccessMsg('');
    try {
      const serviceKey = localStorage.getItem('supabaseServiceKey') || '';
      if (!serviceKey) {
        if (showPasswordModal.email) {
          const { error: resetErr } = await supabase.auth.resetPasswordForEmail(showPasswordModal.email, {
            redirectTo: window.location.origin + '/reset-password',
          });
          if (resetErr) throw resetErr;
          setSuccessMsg(`Password reset email sent to ${showPasswordModal.email}`);
        } else {
          setError('No email found for this user');
        }
        setShowPasswordModal(null);
        setNewPassword('');
        setTimeout(() => setSuccessMsg(''), 5000);
        return;
      }

      const targetAuthId = showPasswordModal.auth_id || showPasswordModal.id;
      const { error: updateErr } = await supabase.auth.admin.updateUserById(
        targetAuthId,
        { password: newPassword }
      );
      if (updateErr) throw updateErr;

      const passwords = { ...userPasswords, [showPasswordModal.id]: newPassword };
      setUserPasswords(passwords);
      localStorage.setItem('biobridge_user_passwords', JSON.stringify(passwords));

      setUsers(prev => prev.map(u =>
        u.id === showPasswordModal.id ? { ...u, last_sign_in_at: null } : u
      ));

      setSuccessMsg(`Password updated for ${showPasswordModal.full_name || showPasswordModal.username}`);
      setShowPasswordModal(null);
      setNewPassword('');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLoginAs = async (targetUser: UserRecord) => {
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', targetUser.organization_id)
        .single();

      localStorage.setItem('biobridge_impersonate_user', JSON.stringify({
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
        role: targetUser.role,
        full_name: targetUser.full_name,
        organization_id: targetUser.organization_id,
        organization_name: org?.name || 'Unknown'
      }));
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Failed to login as user');
    }
  };

  const roleOptions = ['all', 'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE', 'OPERATOR', 'VIEWER'];

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
          <h1 className="text-2xl font-bold text-white">Client Users</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage all client users across organizations · {filteredUsers.length} users
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
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-slate-700 bg-slate-800 text-white text-sm"
        >
          <option value="all">All Roles</option>
          {roleOptions.filter(r => r !== 'all').map(r => (
            <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-slate-700 bg-slate-800 text-white text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="locked">Locked</option>
        </select>
      </div>

      {/* Users Table */}
      <Card className="bg-slate-800 border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-xs text-slate-400 uppercase">
                <th className="p-3 pl-4">User</th>
                <th className="p-3 hidden md:table-cell">Organization</th>
                <th className="p-3">Role</th>
                <th className="p-3">Password</th>
                <th className="p-3 hidden sm:table-cell">Status</th>
                 <th className="p-3 hidden lg:table-cell">Created</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    No users found
                  </td>
                </tr>
              )}
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${
                    !user.is_active ? 'bg-red-500/5' : ''
                  }`}
                >
                  <td className="p-3 pl-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0">
                        {user.role === 'SUPER_ADMIN' ? (
                          <ShieldOff size={16} className={user.is_active ? 'text-amber-400' : 'text-slate-600'} />
                        ) : (
                          <Users size={16} className={user.is_active ? 'text-slate-400' : 'text-slate-600'} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className={`font-medium truncate ${user.is_active ? 'text-white' : 'text-slate-500'}`}>
                          {user.full_name || user.username}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <span className="text-slate-400 text-xs">{user.organization_name}</span>
                  </td>
                  <td className="p-3">{getRoleBadge(user.role)}</td>
                  <td className="p-3">
                    {user.last_sign_in_at
                      ? <span className="text-xs text-slate-500 tracking-widest">••••••</span>
                      : (userPasswords[user.id]
                        ? <span className="text-xs text-amber-400 font-mono">{userPasswords[user.id]}</span>
                        : <span className="text-xs text-slate-600">—</span>
                      )
                    }
                  </td>
                  <td className="p-3 hidden sm:table-cell">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className={`text-xs ${user.is_active ? 'text-green-400' : 'text-red-400'}`}>
                        {user.is_active ? 'Active' : 'Locked'}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    <span className="text-xs text-slate-500">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                    </span>
                  </td>
                  <td className="p-3 pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowPasswordModal(user); setNewPassword(''); }}
                        className="h-7 px-1.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        title="Set Password"
                      >
                        <Key size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmImpersonate(user)}
                        className="h-7 px-1.5 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10"
                        title="Login As"
                      >
                        <LogIn size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleLock(user.id, user.is_active, user.role)}
                        disabled={actionLoading === user.id}
                        className={`h-7 px-1.5 text-xs ${
                          user.is_active
                            ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                            : 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
                        }`}
                      >
                        {actionLoading === user.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : user.is_active ? (
                          <Lock size={12} />
                        ) : (
                          <Unlock size={12} />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Password Set Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowPasswordModal(null)}>
          <Card className="w-full max-w-sm bg-slate-800 border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Key size={20} className="text-blue-400" />
                <div>
                  <h3 className="text-lg font-semibold text-white">Set Password</h3>
                  <p className="text-sm text-slate-400">{showPasswordModal.full_name || showPasswordModal.username}</p>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">New Password (min 6 chars)</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="Enter new password"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShowPasswordModal(null)} className="text-slate-400">Cancel</Button>
                <Button onClick={handleSetPassword} disabled={passwordSaving || !newPassword} className="bg-blue-600 hover:bg-blue-700">
                  {passwordSaving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                  Set Password
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Confirm Impersonation Modal */}
      {confirmImpersonate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setConfirmImpersonate(null)}>
          <Card className="w-full max-w-sm bg-slate-800 border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="p-5 text-center space-y-4">
              <EyeOff size={40} className="mx-auto text-green-400" />
              <div>
                <h3 className="text-lg font-semibold text-white">Login As User?</h3>
                <p className="text-sm text-slate-400 mt-1">
                  You will be logged in as <strong className="text-white">{confirmImpersonate.full_name || confirmImpersonate.username}</strong> ({confirmImpersonate.role}) in <strong className="text-white">{confirmImpersonate.organization_name}</strong>.
                </p>
                <p className="text-xs text-amber-400 mt-2">You'll be redirected to the client portal. Logout to return here.</p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="ghost" onClick={() => setConfirmImpersonate(null)} className="text-slate-400">Cancel</Button>
                <Button onClick={() => { handleLoginAs(confirmImpersonate); setConfirmImpersonate(null); }} className="bg-green-600 hover:bg-green-700">Login As</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
