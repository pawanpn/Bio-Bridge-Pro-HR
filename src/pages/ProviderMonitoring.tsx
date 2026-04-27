import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity, RefreshCw, Loader2, AlertCircle, CheckCircle2, Database,
  Server, Clock, Users, Building2, ShieldCheck, Wifi, WifiOff,
  HardDrive, Cpu, TrendingUp, BarChart3, Zap, Eye, EyeOff,
} from 'lucide-react';

interface Stats {
  orphanUsers: number;
  inactiveOrgs: number;
  totalOrgs: number;
  totalUsers: number;
  superAdmins: number;
  providers: number;
  dbStatus: boolean;
  lastRefresh: string;
}

export const ProviderMonitoring: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Stats>({
    orphanUsers: 0, inactiveOrgs: 0, totalOrgs: 0, totalUsers: 0,
    superAdmins: 0, providers: 0, dbStatus: false, lastRefresh: '',
  });
  const [activityLog, setActivityLog] = useState<Array<{ time: string; type: string; detail: string }>>([]);
  const [showAllLogs, setShowAllLogs] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setError('');
      const start = performance.now();

      // Parallel fetches
      const [orgsR, usersR, providersR] = await Promise.all([
        supabase.from('organizations').select('id,name,is_active,created_at').order('created_at', { ascending: false }),
        supabase.from('users').select('id,role,organization_id,is_active,last_login_at,created_at').order('created_at', { ascending: false }),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'PROVIDER'),
      ]);

      if (orgsR.error) throw orgsR.error;
      if (usersR.error) throw usersR.error;

      const orgs = orgsR.data || [];
      const users = usersR.data || [];
      const orgIds = new Set(orgs.map((o: any) => o.id));

      const orphanUsers = users.filter((u: any) => u.organization_id && !orgIds.has(u.organization_id)).length;
      const inactiveOrgs = orgs.filter((o: any) => !o.is_active).length;
      const superAdmins = users.filter((u: any) => u.role === 'SUPER_ADMIN').length;

      // build activity log from data
      const logs: Array<{ time: string; type: string; detail: string }> = [];

      // recent users
      users.slice(0, 20).forEach((u: any) => {
        logs.push({
          time: u.created_at,
          type: 'user_created',
          detail: `${u.role === 'SUPER_ADMIN' ? '🔑' : '👤'} ${u.role?.replace('_', ' ')} created`,
        });
      });

      // recent orgs
      orgs.slice(0, 10).forEach((o: any) => {
        logs.push({
          time: o.created_at,
          type: 'org_created',
          detail: `🏢 "${o.name}" registered`,
        });
      });

      // recently logged in users
      users.filter((u: any) => u.last_login_at).slice(0, 15).forEach((u: any) => {
        logs.push({
          time: u.last_login_at,
          type: 'login',
          detail: `👤 Login: ${u.role?.replace('_', ' ')}`,
        });
      });

      // locked users
      users.filter((u: any) => !u.is_active).forEach((u: any) => {
        logs.push({
          time: u.created_at,
          type: 'locked',
          detail: `🔒 Locked: ${u.role?.replace('_', ' ')}`,
        });
      });

      logs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      const elapsed = Math.round(performance.now() - start);

      setStats({
        orphanUsers, inactiveOrgs,
        totalOrgs: orgs.length, totalUsers: users.length,
        superAdmins, providers: providersR.count || 0,
        dbStatus: true,
        lastRefresh: new Date().toLocaleTimeString(),
      });

      setActivityLog(logs.slice(0, 100));
    } catch (err: any) {
      setError(err.message);
      setStats(prev => ({ ...prev, dbStatus: false }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'user_created': return <Users size={12} className="text-blue-400" />;
      case 'org_created': return <Building2 size={12} className="text-green-400" />;
      case 'login': return <Zap size={12} className="text-amber-400" />;
      case 'locked': return <AlertCircle size={12} className="text-red-400" />;
      default: return <Activity size={12} className="text-slate-400" />;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-amber-400" /></div>;
  }

  const visibleLogs = showAllLogs ? activityLog : activityLog.slice(0, 30);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">System Monitoring</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time health checks · Auto-refreshes every 30s · Last: {stats.lastRefresh}
          </p>
        </div>
        <Button onClick={fetchStats} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700">
          <RefreshCw size={14} className="mr-1" />Refresh
        </Button>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-sm"><AlertCircle size={16} />{error}<button onClick={() => setError('')} className="ml-auto">Dismiss</button></div>}

      {/* ==================== SYSTEM HEALTH ==================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HealthCard
          icon={<Database size={18} />}
          label="Database"
          ok={stats.dbStatus}
          detail={stats.dbStatus ? 'Connected' : 'Disconnected'}
        />
        <HealthCard
          icon={<Server size={18} />}
          label="Supabase API"
          ok={stats.dbStatus}
          detail={stats.dbStatus ? 'Responding' : 'Unreachable'}
        />
        <HealthCard
          icon={<ShieldCheck size={18} />}
          label="RLS Policies"
          ok={stats.totalOrgs > 0 || stats.totalUsers > 0}
          detail={stats.totalOrgs > 0 || stats.totalUsers > 0 ? 'Data visible' : 'Check policies'}
        />
        <HealthCard
          icon={<Activity size={18} />}
          label="Auto-refresh"
          ok={true}
          detail="30s interval"
        />
      </div>

      {/* ==================== DATA INTEGRITY ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1"><Building2 size={14} />Organizations</div>
            <div className="text-2xl font-bold text-white">{stats.totalOrgs}</div>
            {stats.inactiveOrgs > 0 && <p className="text-[11px] text-red-400 mt-1">{stats.inactiveOrgs} inactive</p>}
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1"><Users size={14} />Total Users</div>
            <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
            <p className="text-[11px] text-slate-500 mt-1">{stats.superAdmins} super admins · {stats.providers} providers</p>
          </CardContent>
        </Card>
        <Card className={`bg-slate-800 border ${stats.orphanUsers > 0 ? 'border-red-500/30' : 'border-slate-700'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs mb-1">
              {stats.orphanUsers > 0 ? <AlertCircle size={14} className="text-red-400" /> : <CheckCircle2 size={14} className="text-green-400" />}
              <span className={stats.orphanUsers > 0 ? 'text-red-400' : 'text-slate-400'}>Orphan Users</span>
            </div>
            <div className={`text-2xl font-bold ${stats.orphanUsers > 0 ? 'text-red-400' : 'text-green-400'}`}>{stats.orphanUsers}</div>
            <p className="text-[11px] text-slate-500 mt-1">{stats.orphanUsers > 0 ? 'Users without valid org' : 'No orphaned users'}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1"><TrendingUp size={14} />Avg Users/Org</div>
            <div className="text-2xl font-bold text-white">{stats.totalOrgs > 0 ? (stats.totalUsers / stats.totalOrgs).toFixed(1) : '0'}</div>
            <p className="text-[11px] text-slate-500 mt-1">per organization</p>
          </CardContent>
        </Card>
      </div>

      {/* ==================== ACTIVITY LOG ==================== */}
      <Card className="bg-slate-800 border-slate-700">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Activity Log</h3>
            <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-600">{activityLog.length} events</Badge>
          </div>
          <button onClick={() => setShowAllLogs(!showAllLogs)} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
            {showAllLogs ? <><EyeOff size={12} />Show less</> : <><Eye size={12} />Show all</>}
          </button>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          {visibleLogs.length === 0 && <p className="text-sm text-slate-500 p-6 text-center"><Activity size={24} className="mx-auto mb-1 opacity-30" />No activity recorded yet</p>}
          <table className="w-full text-xs">
            <tbody>
              {visibleLogs.map((log, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="p-2 pl-4 w-8">{getLogIcon(log.type)}</td>
                  <td className="p-2 text-slate-300">{log.detail}</td>
                  <td className="p-2 pr-4 text-right text-slate-500 whitespace-nowrap">
                    {new Date(log.time).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const HealthCard: React.FC<{ icon: React.ReactNode; label: string; ok: boolean; detail: string }> = ({ icon, label, ok, detail }) => (
  <Card className={`bg-slate-800 border ${ok ? 'border-green-500/20' : 'border-red-500/30'} hover:border-slate-600 transition-colors`}>
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={ok ? 'text-green-400' : 'text-red-400'}>{icon}</span>
          <span className="text-xs text-slate-300 font-medium">{label}</span>
        </div>
        {ok ? <CheckCircle2 size={16} className="text-green-400" /> : <AlertCircle size={16} className="text-red-400" />}
      </div>
      <p className={`text-[11px] mt-2 ${ok ? 'text-slate-500' : 'text-red-400'}`}>{detail}</p>
    </CardContent>
  </Card>
);
