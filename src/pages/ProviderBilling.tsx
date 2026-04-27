import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, Plus, RefreshCw, Loader2, X, Save, Search,
  AlertCircle, CheckCircle2, Clock, TrendingUp, TrendingDown,
  CreditCard, Banknote, Calendar, FileText, Building2,
  ChevronDown, ChevronRight, Receipt, Download, Filter,
} from 'lucide-react';

interface OrgRecord { id: number | string; name: string; is_active: boolean; }
interface Payment {
  id: number; organization_id: number | string; invoice_number: string;
  description: string; amount: number; status: string;
  payment_method: string; payment_date: string | null; due_date: string | null;
  notes: string; created_at: string; organization_name?: string;
}

const emptyPayment = {
  organization_id: '' as any, invoice_number: '', description: '', amount: 0,
  status: 'pending', payment_method: 'bank_transfer', payment_date: '',
  due_date: '', notes: '',
};

export const ProviderBilling: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [form, setForm] = useState({ ...emptyPayment });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState('all');
  const [expandedOrg, setExpandedOrg] = useState<Record<string, boolean>>({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try { setLoading(true); setError('');
      const [orgsRes, payRes] = await Promise.all([
        supabase.from('organizations').select('*').order('name'),
        supabase.from('payments').select('*').order('created_at', { ascending: false }),
      ]);
      if (orgsRes.error) throw orgsRes.error;
      if (payRes.error) throw payRes.error;
      const orgMap: Record<string, string> = {};
      (orgsRes.data || []).forEach((o: any) => { orgMap[o.id] = o.name; });
      setOrgs(orgsRes.data || []);
      setPayments((payRes.data || []).map((p: any) => ({ ...p, organization_name: orgMap[p.organization_id] || 'Unknown' })));
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditingPayment(null); setForm({ ...emptyPayment }); setShowForm(true); };
  const openEdit = (p: Payment) => { setEditingPayment(p); setForm({ organization_id: p.organization_id, invoice_number: p.invoice_number || '', description: p.description || '', amount: p.amount, status: p.status, payment_method: p.payment_method || 'bank_transfer', payment_date: p.payment_date || '', due_date: p.due_date || '', notes: p.notes || '' }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.organization_id || !form.amount) { setError('Organization and amount required'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = {
        organization_id: form.organization_id,
        invoice_number: form.invoice_number || null,
        description: form.description || null,
        amount: Number(form.amount),
        status: form.status,
        payment_method: form.payment_method || null,
        payment_date: form.payment_date || null,
        due_date: form.due_date || null,
        notes: form.notes || null,
      };
      if (editingPayment) {
        const { error: e } = await supabase.from('payments').update(payload).eq('id', editingPayment.id);
        if (e) throw e;
        setSuccess('Payment updated');
      } else {
        const { error: e } = await supabase.from('payments').insert(payload);
        if (e) throw e;
        setSuccess('Payment recorded');
      }
      setShowForm(false); await loadData(); setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id: number, status: string) => {
    try { await supabase.from('payments').update({ status }).eq('id', id);
      setPayments(prev => prev.map(p => p.id === id ? { ...p, status: status as any } : p));
      setSuccess(`Status → ${status}`); setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) { setError(err.message); }
  };

  // filters
  let filtered = payments;
  if (search) { const s = search.toLowerCase(); filtered = filtered.filter(p => (p.invoice_number || '').toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s) || (p.organization_name || '').toLowerCase().includes(s)); }
  if (statusFilter !== 'all') filtered = filtered.filter(p => p.status === statusFilter);
  if (orgFilter !== 'all') filtered = filtered.filter(p => String(p.organization_id) === orgFilter);

  // stats
  const totalClaimed = payments.filter(p => p.status !== 'pending').reduce((s, p) => s + Number(p.amount), 0);
  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0);
  const totalReceived = payments.filter(p => p.status === 'received').reduce((s, p) => s + Number(p.amount), 0);
  const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0);

  const getStatusBadge = (s: string) => {
    const m: Record<string, { color: string; icon: React.ReactNode }> = {
      pending: { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', icon: <Clock size={10} /> },
      claimed: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/30', icon: <FileText size={10} /> },
      received: { color: 'bg-green-500/10 text-green-400 border-green-500/30', icon: <CheckCircle2 size={10} /> },
    };
    const t = m[s] || { color: '', icon: null };
    return <Badge variant="outline" className={`text-[10px] flex items-center gap-1 ${t.color}`}>{t.icon}{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>;
  };

  // group by org
  const orgPayments: Record<string, Payment[]> = {};
  filtered.forEach(p => { const k = String(p.organization_id); if (!orgPayments[k]) orgPayments[k] = []; orgPayments[k].push(p); });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-amber-400" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing & Payments</h1>
          <p className="text-sm text-slate-400 mt-1">Organization payment ledger · {payments.length} entries</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700"><RefreshCw size={14} className="mr-1" />Refresh</Button>
          <Button onClick={openCreate} size="sm" className="bg-amber-600 hover:bg-amber-700"><Plus size={14} className="mr-1" />Record Payment</Button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-sm"><AlertCircle size={16} />{error}<button onClick={() => setError('')} className="ml-auto">Dismiss</button></div>}
      {success && <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-md text-sm"><CheckCircle2 size={16} />{success}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-slate-800 border-slate-700"><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-slate-400 mb-1"><Receipt size={14} />Total Invoiced</div><div className="text-xl font-bold text-white">NPR {totalAmount.toLocaleString()}</div><p className="text-[10px] text-slate-500 mt-0.5">{payments.length} entries</p></CardContent></Card>
        <Card className="bg-slate-800 border-slate-700"><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-yellow-400 mb-1"><Clock size={14} />Pending</div><div className="text-xl font-bold text-yellow-400">NPR {totalPending.toLocaleString()}</div><p className="text-[10px] text-slate-500 mt-0.5">Awaiting claim</p></CardContent></Card>
        <Card className="bg-slate-800 border-slate-700"><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-blue-400 mb-1"><FileText size={14} />Claimed</div><div className="text-xl font-bold text-blue-400">NPR {(totalClaimed - totalReceived).toLocaleString()}</div><p className="text-[10px] text-slate-500 mt-0.5">In process</p></CardContent></Card>
        <Card className="bg-slate-800 border-slate-700"><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-green-400 mb-1"><CheckCircle2 size={14} />Received</div><div className="text-xl font-bold text-green-400">NPR {totalReceived.toLocaleString()}</div><p className="text-[10px] text-slate-500 mt-0.5">Settled</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm h-9" /></div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-md border border-slate-700 bg-slate-800 text-white text-xs"><option value="all">All Status</option><option value="pending">Pending</option><option value="claimed">Claimed</option><option value="received">Received</option></select>
        <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)} className="h-9 px-3 rounded-md border border-slate-700 bg-slate-800 text-white text-xs max-w-[200px]"><option value="all">All Organizations</option>{orgs.map(o => <option key={String(o.id)} value={String(o.id)}>{o.name}</option>)}</select>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <Card className="w-full max-w-md bg-slate-800 border-slate-700 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700 flex items-center justify-between"><h2 className="text-base font-semibold text-white">{editingPayment ? 'Edit Payment' : 'Record Payment'}</h2><button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-slate-700"><X size={16} className="text-slate-400" /></button></div>
            <div className="p-4 space-y-3">
              <div className="space-y-1"><label className="text-xs text-slate-400">Organization *</label><select value={form.organization_id} onChange={e => setForm({ ...form, organization_id: e.target.value })} className="w-full h-9 px-2 rounded-md border border-slate-600 bg-slate-700 text-white text-sm"><option value="">Select...</option>{orgs.map(o => <option key={String(o.id)} value={o.id}>{o.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-xs text-slate-400">Amount (NPR) *</label><Input type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} className="bg-slate-700 border-slate-600 text-white h-9" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Invoice #</label><Input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} className="bg-slate-700 border-slate-600 text-white h-9" /></div>
              </div>
              <div className="space-y-1"><label className="text-xs text-slate-400">Description</label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-slate-700 border-slate-600 text-white h-9" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-xs text-slate-400">Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })} className="w-full h-9 px-2 rounded-md border border-slate-600 bg-slate-700 text-white text-sm"><option value="pending">Pending</option><option value="claimed">Claimed</option><option value="received">Received</option></select></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Method</label><select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} className="w-full h-9 px-2 rounded-md border border-slate-600 bg-slate-700 text-white text-sm"><option value="bank_transfer">Bank Transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="online">Online/IPS</option><option value="credit_card">Credit Card</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-xs text-slate-400">Payment Date</label><Input type="date" value={form.payment_date as string} onChange={e => setForm({ ...form, payment_date: e.target.value })} className="bg-slate-700 border-slate-600 text-white h-9" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Due Date</label><Input type="date" value={form.due_date as string} onChange={e => setForm({ ...form, due_date: e.target.value })} className="bg-slate-700 border-slate-600 text-white h-9" /></div>
              </div>
              <div className="space-y-1"><label className="text-xs text-slate-400">Notes</label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-slate-700 border-slate-600 text-white h-9" /></div>
              <div className="flex gap-2 pt-2 justify-end">
                <Button variant="ghost" onClick={() => setShowForm(false)} className="text-slate-400 text-sm">Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-sm">{saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}{editingPayment ? 'Update' : 'Record'}</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Ledger - Grouped by Organization */}
      <div className="space-y-3">
        {Object.keys(orgPayments).length === 0 && (
          <Card className="bg-slate-800 border-slate-700"><CardContent className="p-6 text-center"><DollarSign size={40} className="mx-auto mb-2 text-slate-600" /><p className="text-slate-500">No payments found</p></CardContent></Card>
        )}
        {Object.entries(orgPayments).map(([orgId, pays]) => {
          const org = orgs.find(o => String(o.id) === orgId);
          const total = pays.reduce((s, p) => s + Number(p.amount), 0);
          const received = pays.filter(p => p.status === 'received').reduce((s, p) => s + Number(p.amount), 0);
          const pending = pays.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0);
          const isExpanded = expandedOrg[orgId] !== false;
          return (
            <Card key={orgId} className="bg-slate-800 border-slate-700 overflow-hidden">
              <button onClick={() => setExpandedOrg(prev => ({ ...prev, [orgId]: !isExpanded }))} className="w-full flex items-center justify-between p-3 hover:bg-slate-700/30 transition-colors text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <Building2 size={18} className="text-blue-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{org?.name || 'Unknown Org'}</p>
                    <p className="text-[11px] text-slate-500">{pays.length} invoice{pays.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">NPR {total.toLocaleString()}</p>
                    {pending > 0 && <p className="text-[10px] text-yellow-400">NPR {pending.toLocaleString()} pending</p>}
                  </div>
                  {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-slate-700">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-700/50 text-left text-[10px] text-slate-500 uppercase"><th className="p-2 pl-4">Invoice</th><th className="p-2">Description</th><th className="p-2 text-right">Amount</th><th className="p-2">Status</th><th className="p-2">Date</th><th className="p-2 pr-4 text-right">Actions</th></tr></thead>
                    <tbody>
                      {pays.map(p => (
                        <tr key={p.id} className="border-b border-slate-700/30 hover:bg-slate-700/30">
                          <td className="p-2 pl-4 text-slate-300 font-mono">{p.invoice_number || `#${p.id}`}</td>
                          <td className="p-2 text-slate-400 max-w-[150px] truncate">{p.description || '—'}</td>
                          <td className="p-2 text-right font-mono text-slate-200">NPR {Number(p.amount).toLocaleString()}</td>
                          <td className="p-2">{getStatusBadge(p.status)}</td>
                          <td className="p-2 text-slate-500">{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—'}</td>
                          <td className="p-2 pr-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {p.status === 'pending' && <Button variant="ghost" size="sm" onClick={() => updateStatus(p.id, 'claimed')} className="h-6 px-1.5 text-[10px] text-blue-400 hover:bg-blue-500/10">Claim</Button>}
                              {p.status === 'claimed' && <Button variant="ghost" size="sm" onClick={() => updateStatus(p.id, 'received')} className="h-6 px-1.5 text-[10px] text-green-400 hover:bg-green-500/10">Receive</Button>}
                              {p.status === 'received' && <Button variant="ghost" size="sm" onClick={() => updateStatus(p.id, 'pending')} className="h-6 px-1.5 text-[10px] text-yellow-400 hover:bg-yellow-500/10">Reopen</Button>}
                              <Button variant="ghost" size="sm" onClick={() => openEdit(p)} className="h-6 px-1.5 text-[10px] text-slate-400 hover:bg-slate-700">Edit</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
