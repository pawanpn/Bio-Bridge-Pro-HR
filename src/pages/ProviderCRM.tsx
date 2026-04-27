import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare, Plus, RefreshCw, Loader2, X, Save, Search,
  AlertCircle, CheckCircle2, Clock, Building2, User, Mail,
  ChevronDown, ChevronRight, AlertTriangle, Flag, ShieldAlert,
  MessageCircle, ArrowUpCircle, Filter, Eye,
} from 'lucide-react';

interface OrgRecord { id: number | string; name: string; }
interface Ticket {
  id: number; organization_id: number | string; title: string;
  description: string; priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  category: string; assigned_to: string; created_by_name: string;
  created_by_email: string; resolution: string; resolved_at: string | null;
  created_at: string; updated_at: string; organization_name?: string;
}

const emptyTicket = {
  organization_id: '' as any, title: '', description: '', priority: 'medium' as const,
  status: 'open' as const, category: 'general', assigned_to: '', created_by_name: '',
  created_by_email: '', resolution: '',
};

export const ProviderCRM: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [form, setForm] = useState({ ...emptyTicket });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState('all');
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try { setLoading(true); setError('');
      const [orgsRes, tixRes] = await Promise.all([
        supabase.from('organizations').select('*').order('name'),
        supabase.from('support_tickets').select('*').order('created_at', { ascending: false }),
      ]);
      if (orgsRes.error) throw orgsRes.error;
      if (tixRes.error) throw tixRes.error;
      const orgMap: Record<string, string> = {};
      (orgsRes.data || []).forEach((o: any) => { orgMap[o.id] = o.name; });
      setOrgs(orgsRes.data || []);
      setTickets((tixRes.data || []).map((t: any) => ({ ...t, organization_name: orgMap[t.organization_id] || 'Unknown' })));
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditingTicket(null); setForm({ ...emptyTicket }); setShowForm(true); };
  const openEdit = (t: Ticket) => { setEditingTicket(t); setForm({ organization_id: t.organization_id, title: t.title, description: t.description || '', priority: t.priority, status: t.status, category: t.category || 'general', assigned_to: t.assigned_to || '', created_by_name: t.created_by_name || '', created_by_email: t.created_by_email || '', resolution: t.resolution || '' }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.organization_id || !form.title) { setError('Organization and title required'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = {
        organization_id: form.organization_id, title: form.title, description: form.description || null,
        priority: form.priority, status: form.status, category: form.category || 'general',
        assigned_to: form.assigned_to || null, created_by_name: form.created_by_name || null,
        created_by_email: form.created_by_email || null, resolution: form.resolution || null,
      };
      if (editingTicket) {
        const { error: e } = await supabase.from('support_tickets').update(payload).eq('id', editingTicket.id);
        if (e) throw e;
        setSuccess('Ticket updated');
      } else {
        const { error: e } = await supabase.from('support_tickets').insert(payload);
        if (e) throw e;
        setSuccess('Ticket created');
      }
      setShowForm(false); await loadData(); setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id: number, status: string, resolution?: string) => {
    try {
      const upd: any = { status };
      if (status === 'resolved') { upd.resolution = resolution || ''; upd.resolved_at = new Date().toISOString(); }
      if (status === 'closed') { upd.resolved_at = new Date().toISOString(); }
      const { error: e } = await supabase.from('support_tickets').update(upd).eq('id', id);
      if (e) throw e;
      setTickets(prev => prev.map(t => t.id === id ? { ...t, ...upd } : t));
      if (detailTicket?.id === id) setDetailTicket(prev => prev ? { ...prev, ...upd } : null);
      setSuccess(`Ticket → ${status.replace('_', ' ')}`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) { setError(err.message); }
  };

  // filters
  let filtered = tickets;
  if (search) { const s = search.toLowerCase(); filtered = filtered.filter(t => t.title.toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s) || (t.organization_name || '').toLowerCase().includes(s) || (t.created_by_name || '').toLowerCase().includes(s)); }
  if (statusFilter !== 'all') filtered = filtered.filter(t => t.status === statusFilter);
  if (priorityFilter !== 'all') filtered = filtered.filter(t => t.priority === priorityFilter);
  if (orgFilter !== 'all') filtered = filtered.filter(t => String(t.organization_id) === orgFilter);

  const getPriorityBadge = (p: string) => {
    const m: Record<string, { color: string; icon: React.ReactNode }> = {
      low: { color: 'bg-slate-500/10 text-slate-400 border-slate-500/30', icon: <Flag size={10} /> },
      medium: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/30', icon: <Flag size={10} /> },
      high: { color: 'bg-orange-500/10 text-orange-400 border-orange-500/30', icon: <AlertTriangle size={10} /> },
      urgent: { color: 'bg-red-500/10 text-red-400 border-red-500/30', icon: <ShieldAlert size={10} /> },
    };
    const t = m[p] || { color: '', icon: null };
    return <Badge variant="outline" className={`text-[10px] flex items-center gap-1 ${t.color}`}>{t.icon}{p.charAt(0).toUpperCase() + p.slice(1)}</Badge>;
  };

  const getStatusBadge = (s: string) => {
    const m: Record<string, string> = {
      open: 'bg-red-500/10 text-red-400 border-red-500/30',
      in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      resolved: 'bg-green-500/10 text-green-400 border-green-500/30',
      closed: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    };
    return <Badge variant="outline" className={`text-[10px] ${m[s] || ''}`}>{s.replace('_', ' ')}</Badge>;
  };

  const openCount = tickets.filter(t => t.status === 'open').length;
  const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed' && t.status !== 'resolved').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-amber-400" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Support & CRM</h1>
          <p className="text-sm text-slate-400 mt-1">Complaints & support tickets · {tickets.length} total</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700"><RefreshCw size={14} className="mr-1" />Refresh</Button>
          <Button onClick={openCreate} size="sm" className="bg-amber-600 hover:bg-amber-700"><Plus size={14} className="mr-1" />New Ticket</Button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-sm"><AlertCircle size={16} />{error}<button onClick={() => setError('')} className="ml-auto">Dismiss</button></div>}
      {success && <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-md text-sm"><CheckCircle2 size={16} />{success}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsBox icon={<MessageSquare size={16} />} label="Total Tickets" value={tickets.length} color="text-slate-400" />
        <StatsBox icon={<AlertCircle size={16} />} label="Open" value={openCount} color="text-red-400" />
        <StatsBox icon={<ShieldAlert size={16} />} label="Urgent" value={urgentCount} color="text-orange-400" />
        <StatsBox icon={<CheckCircle2 size={16} />} label="Resolved" value={resolvedCount} color="text-green-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><Input placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm h-9" /></div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-md border border-slate-700 bg-slate-800 text-white text-xs"><option value="all">All Status</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="h-9 px-3 rounded-md border border-slate-700 bg-slate-800 text-white text-xs"><option value="all">All Priority</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select>
        <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)} className="h-9 px-3 rounded-md border border-slate-700 bg-slate-800 text-white text-xs max-w-[200px]"><option value="all">All Orgs</option>{orgs.map(o => <option key={String(o.id)} value={String(o.id)}>{o.name}</option>)}</select>
      </div>

      {/* Ticket List */}
      <div className="space-y-2">
        {filtered.length === 0 && <Card className="bg-slate-800 border-slate-700"><CardContent className="p-6 text-center"><MessageSquare size={40} className="mx-auto mb-2 text-slate-600" /><p className="text-slate-500">No tickets found</p></CardContent></Card>}
        {filtered.map(ticket => (
          <Card key={ticket.id} className={`bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors ${ticket.priority === 'urgent' && ticket.status === 'open' ? 'border-l-2 border-l-red-500' : ticket.priority === 'high' && ticket.status === 'open' ? 'border-l-2 border-l-orange-500' : ''}`}>
            <div className="p-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {getPriorityBadge(ticket.priority)}
                  {getStatusBadge(ticket.status)}
                  <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-600">{ticket.category}</Badge>
                  <span className="text-[10px] text-slate-600 ml-auto">{new Date(ticket.created_at).toLocaleDateString()}</span>
                </div>
                <p className={`text-sm font-medium ${ticket.status === 'closed' ? 'text-slate-500 line-through' : 'text-white'}`}>
                  #{ticket.id} {ticket.title}
                </p>
                {ticket.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{ticket.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><Building2 size={10} />{ticket.organization_name}</span>
                  {ticket.created_by_name && <span className="flex items-center gap-1"><User size={10} />{ticket.created_by_name}</span>}
                  {ticket.assigned_to && <span className="flex items-center gap-1"><MessageCircle size={10} />{ticket.assigned_to}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {ticket.status === 'open' && <Button variant="ghost" size="sm" onClick={() => updateStatus(ticket.id, 'in_progress')} className="h-6 px-2 text-[10px] text-blue-400 hover:bg-blue-500/10">Start</Button>}
                {ticket.status === 'in_progress' && <Button variant="ghost" size="sm" onClick={() => { setDetailTicket(ticket); setResolutionText(''); }} className="h-6 px-2 text-[10px] text-green-400 hover:bg-green-500/10">Resolve</Button>}
                {ticket.status === 'resolved' && <Button variant="ghost" size="sm" onClick={() => updateStatus(ticket.id, 'closed')} className="h-6 px-2 text-[10px] text-slate-400 hover:bg-slate-700">Close</Button>}
                {ticket.status === 'closed' && <Button variant="ghost" size="sm" onClick={() => updateStatus(ticket.id, 'open')} className="h-6 px-2 text-[10px] text-yellow-400 hover:bg-yellow-500/10">Reopen</Button>}
                <Button variant="ghost" size="sm" onClick={() => openEdit(ticket)} className="h-6 px-1.5 text-[10px] text-slate-400 hover:bg-slate-700">Edit</Button>
              </div>
            </div>
            {/* Resolution preview */}
            {ticket.resolution && ticket.status === 'resolved' && (
              <div className="px-3 pb-3 border-t border-slate-700/50 pt-2">
                <p className="text-[11px] text-green-400/80"><CheckCircle2 size={10} className="inline mr-1" />{ticket.resolution}</p>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Resolve Modal */}
      {detailTicket && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDetailTicket(null)}>
          <Card className="w-full max-w-md bg-slate-800 border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700 flex items-center justify-between"><h3 className="text-base font-semibold text-white">Resolve Ticket #{detailTicket.id}</h3><button onClick={() => setDetailTicket(null)} className="p-1 rounded hover:bg-slate-700"><X size={16} className="text-slate-400" /></button></div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-300">{detailTicket.title}</p>
              <div className="space-y-1"><label className="text-xs text-slate-400">Resolution Notes</label><textarea value={resolutionText} onChange={e => setResolutionText(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-md border border-slate-600 bg-slate-700 text-white text-sm resize-none" placeholder="Describe how this was resolved..." /></div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setDetailTicket(null)} className="text-slate-400">Cancel</Button>
                <Button onClick={() => { updateStatus(detailTicket.id, 'resolved', resolutionText); setDetailTicket(null); }} className="bg-green-600 hover:bg-green-700">Resolve Ticket</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <Card className="w-full max-w-lg bg-slate-800 border-slate-700 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700 flex items-center justify-between"><h2 className="text-base font-semibold text-white">{editingTicket ? 'Edit Ticket' : 'New Support Ticket'}</h2><button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-slate-700"><X size={16} className="text-slate-400" /></button></div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-xs text-slate-400">Organization *</label><select value={form.organization_id} onChange={e => setForm({ ...form, organization_id: e.target.value })} className="w-full h-9 px-2 rounded-md border border-slate-600 bg-slate-700 text-white text-sm"><option value="">Select...</option>{orgs.map(o => <option key={String(o.id)} value={o.id}>{o.name}</option>)}</select></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Category</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full h-9 px-2 rounded-md border border-slate-600 bg-slate-700 text-white text-sm"><option value="general">General</option><option value="technical">Technical</option><option value="billing">Billing</option><option value="account">Account</option><option value="bug">Bug Report</option><option value="feature">Feature Request</option><option value="other">Other</option></select></div>
              </div>
              <div className="space-y-1"><label className="text-xs text-slate-400">Title *</label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-slate-700 border-slate-600 text-white h-9" placeholder="Brief summary of the issue" /></div>
              <div className="space-y-1"><label className="text-xs text-slate-400">Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-md border border-slate-600 bg-slate-700 text-white text-sm resize-none" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><label className="text-xs text-slate-400">Priority</label><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as any })} className="w-full h-9 px-2 rounded-md border border-slate-600 bg-slate-700 text-white text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })} className="w-full h-9 px-2 rounded-md border border-slate-600 bg-slate-700 text-white text-sm"><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Assigned To</label><Input value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} className="bg-slate-700 border-slate-600 text-white h-9" placeholder="Staff name" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-xs text-slate-400">Reported By</label><Input value={form.created_by_name} onChange={e => setForm({ ...form, created_by_name: e.target.value })} className="bg-slate-700 border-slate-600 text-white h-9" placeholder="Contact name" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Email</label><Input value={form.created_by_email} onChange={e => setForm({ ...form, created_by_email: e.target.value })} className="bg-slate-700 border-slate-600 text-white h-9" placeholder="contact@email.com" /></div>
              </div>
              <div className="flex gap-2 pt-2 justify-end">
                <Button variant="ghost" onClick={() => setShowForm(false)} className="text-slate-400 text-sm">Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-sm">{saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}{editingTicket ? 'Update' : 'Create'}</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

const StatsBox: React.FC<{ icon: React.ReactNode; label: string; value: number; color: string }> = ({ icon, label, value, color }) => (
  <Card className="bg-slate-800 border-slate-700"><CardContent className="p-3"><div className={`flex items-center gap-2 text-xs mb-1 ${color}`}>{icon}{label}</div><div className="text-xl font-bold text-white">{value}</div></CardContent></Card>
);
