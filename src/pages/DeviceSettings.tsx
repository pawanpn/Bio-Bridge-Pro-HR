import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';

interface Device {
  id: number;
  name: string;
  ip_address: string;
  ip?: string;
  port: number;
  comm_key: number;
  machine_number: number;
  brand: string;
  location?: string;
  branch_id?: number;
  gate_id?: number;
  status?: string;
  is_default?: boolean;
  https_enabled?: boolean;
  server_address?: string;
  organization_id?: number;
}

interface Branch {
  id: number;
  name: string;
}

const emptyForm = (): Omit<Device, 'id' | 'status' | 'is_default'> => ({
  name: '',
  ip_address: '',
  port: 4370,
  comm_key: 0,
  machine_number: 1,
  brand: 'ZKTeco',
  location: '',
  branch_id: undefined,
  gate_id: undefined,
  https_enabled: false,
  server_address: '0.0.0.0',
  organization_id: 2,
});

export const DeviceSettings: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [testStatus, setTestStatus] = useState<{ type: string; message: string }>({ type: '', message: '' });
  const [syncStatus, setSyncStatus] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [manualAttForm, setManualAttForm] = useState({ employeeId: '', timestamp: new Date().toISOString().slice(0, 16), method: 'fingerprint' });
  const [manualAttStatus, setManualAttStatus] = useState('');

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const { data: devData } = await supabase.from('devices').select('*').order('id');
      const { data: bsData } = await supabase.from('branches').select('*');
      setDevices((devData || []).map((d: any) => ({ ...d, ip: d.ip_address })));
      setBranches(bsData || []);
    } catch (e) {
      console.error('Failed to load devices:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const openAddModal = () => {
    setEditingDevice(null);
    setForm(emptyForm());
    setTestStatus({ type: '', message: '' });
    setShowModal(true);
  };

  const openEditModal = (dev: Device) => {
    setEditingDevice(dev);
    setForm({
      name: dev.name,
      ip_address: dev.ip_address || dev.ip || '',
      port: dev.port,
      comm_key: dev.comm_key || 0,
      machine_number: dev.machine_number || 1,
      brand: dev.brand || 'ZKTeco',
      location: dev.location || '',
      branch_id: dev.branch_id,
      gate_id: dev.gate_id,
      https_enabled: dev.https_enabled || false,
      server_address: dev.server_address || '0.0.0.0',
      organization_id: dev.organization_id || 2,
    });
    setTestStatus({ type: '', message: '' });
    setShowModal(true);
  };

  const handleTestConnection = async () => {
    setTestStatus({ type: 'loading', message: 'Testing connection...' });
    // In browser mode, we can only do a basic ping via fetch
    try {
      const res = await fetch(`http://${form.ip_address}:${form.port}`, { mode: 'no-cors', signal: AbortSignal.timeout(3000) });
      setTestStatus({ type: 'success', message: 'Device appears reachable (desktop app required for full test)' });
    } catch {
      setTestStatus({ type: 'error', message: 'Cannot reach device from browser. Use desktop app for device connection.' });
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.ip_address) {
      setTestStatus({ type: 'error', message: 'Device name and IP address are required.' });
      return;
    }
    setSaving(true);
    try {
      if (editingDevice) {
        await supabase.from('devices').update({
          name: form.name,
          ip_address: form.ip_address,
          port: form.port,
          comm_key: form.comm_key,
          machine_number: form.machine_number,
          brand: form.brand,
          location: form.location,
          branch_id: form.branch_id,
          https_enabled: form.https_enabled,
          server_address: form.server_address,
        }).eq('id', editingDevice.id);
      } else {
        await supabase.from('devices').insert({
          name: form.name,
          ip_address: form.ip_address,
          port: form.port,
          comm_key: form.comm_key,
          machine_number: form.machine_number,
          brand: form.brand,
          location: form.location,
          branch_id: form.branch_id,
          https_enabled: form.https_enabled,
          server_address: form.server_address,
          status: 'offline',
          is_default: devices.length === 0,
          organization_id: 2,
        });
      }
      setShowModal(false);
      await loadDevices();
    } catch (err) {
      setTestStatus({ type: 'error', message: 'Failed to save: ' + JSON.stringify(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: number) => {
    await supabase.from('devices').update({ is_default: false }).neq('id', id);
    await supabase.from('devices').update({ is_default: true }).eq('id', id);
    await loadDevices();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await supabase.from('devices').delete().eq('id', deleteConfirm);
    setDeleteConfirm(null);
    await loadDevices();
  };

  const handleSyncLogs = async (dev: Device) => {
    setSyncStatus(prev => ({ ...prev, [dev.id]: 'Syncing... (requires desktop app for actual device sync)' }));
    // In browser mode, show pending logs from DB
    const { data } = await supabase.from('attendance_logs')
      .select('*').eq('device_id', dev.id).eq('sync_status', 'pending').limit(50);
    setSyncStatus(prev => ({ ...prev, [dev.id]: `Found ${data?.length || 0} pending logs in database` }));
  };

  const handleAddManualAttendance = async () => {
    if (!manualAttForm.employeeId || !manualAttForm.timestamp) {
      setManualAttStatus('Please fill employee ID and timestamp.');
      return;
    }
    try {
      const { error } = await supabase.from('attendance_logs').insert({
        employee_id: parseInt(manualAttForm.employeeId),
        timestamp: new Date(manualAttForm.timestamp).toISOString(),
        device_id: null,
        sync_status: 'synced',
        organization_id: 2,
      });
      if (error) throw error;
      setManualAttStatus('Manual attendance recorded successfully!');
      setManualAttForm({ employeeId: '', timestamp: new Date().toISOString().slice(0, 16), method: 'fingerprint' });
      setTimeout(() => setManualAttStatus(''), 3000);
    } catch (err) {
      setManualAttStatus('Failed: ' + JSON.stringify(err));
    }
  };

  const getBranchName = (id?: number) => branches.find(b => b.id === id)?.name || '-';

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Device Management</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Manage biometric hardware (ZKTeco / Hikvision) for attendance synchronization.
          </p>
        </div>
        <button onClick={openAddModal} style={addBtnStyle}>+ Add Device</button>
      </div>

      {/* Device Table */}
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Loading devices...</p>
      ) : devices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 8 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>No devices configured yet</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Click "+ Add Device" to register your first biometric device.</div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-color)' }}>
                {['Device Name', 'Branch', 'IP Address', 'Status', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map(dev => (
                <React.Fragment key={dev.id}>
                  <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>
                        {dev.name}
                        {dev.is_default && (
                          <span style={{ fontSize: 9, backgroundColor: 'var(--primary-color)', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 6 }}>DEFAULT</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dev.brand} : {dev.port}</div>
                    </td>
                    <td style={tdStyle}>{getBranchName(dev.branch_id)}</td>
                    <td style={tdStyle}>{dev.ip_address}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dev.status === 'online' ? '#22c55e' : '#94a3b8', display: 'inline-block' }} />
                        {dev.status === 'online' ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {!dev.is_default && (
                          <button onClick={() => handleSetDefault(dev.id)} style={smallBtnStyle('var(--primary-color)')}>Set Default</button>
                        )}
                        <button onClick={() => openEditModal(dev)} style={smallBtnStyle('#6366f1')}>Edit</button>
                        <button onClick={() => handleSyncLogs(dev)} style={smallBtnStyle('#0891b2')}>Sync Logs</button>
                        <button onClick={() => setDeleteConfirm(dev.id)} style={smallBtnStyle('#ef4444')}>Delete</button>
                      </div>
                    </td>
                  </tr>
                  {syncStatus[dev.id] && (
                    <tr>
                      <td colSpan={5} style={{ padding: '6px 16px', fontSize: 12, color: '#0891b2', backgroundColor: 'var(--bg-color)' }}>
                        {syncStatus[dev.id]}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Attendance */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 15 }}>Manual Attendance Entry</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Employee ID</label>
            <input style={{ ...inputStyle, width: 120 }} value={manualAttForm.employeeId}
              onChange={e => setManualAttForm(f => ({ ...f, employeeId: e.target.value }))}
              placeholder="e.g. 2" />
          </div>
          <div>
            <label style={labelStyle}>Timestamp</label>
            <input type="datetime-local" style={{ ...inputStyle, width: 200 }} value={manualAttForm.timestamp}
              onChange={e => setManualAttForm(f => ({ ...f, timestamp: e.target.value }))} />
          </div>
          <button onClick={handleAddManualAttendance} style={addBtnStyle}>Add Entry</button>
        </div>
        {manualAttStatus && (
          <p style={{ marginTop: 8, fontSize: 13, color: manualAttStatus.includes('success') ? '#22c55e' : '#ef4444' }}>{manualAttStatus}</p>
        )}
      </div>

      {/* Connection Tips */}
      <div style={cardStyle}>
        <h4 style={{ marginBottom: 12, marginTop: 0 }}>Connection Tips</h4>
        <ul style={{ color: 'var(--text-muted)', fontSize: 14, paddingLeft: 20, lineHeight: 1.7, margin: 0 }}>
          <li>Ensure the biometric device and computer are on the same network.</li>
          <li>Default ZKTeco port is <strong>4370</strong>. Hikvision uses <strong>80</strong> (HTTP).</li>
          <li>Comm Key is usually <strong>0</strong> unless changed in device settings.</li>
          <li>Device sync requires the <strong>desktop app</strong> (Tauri) — browser mode shows DB records only.</li>
          <li>For ZKTeco: Settings → Comm → IP Address → set static IP.</li>
        </ul>
      </div>

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxWidth: 360, textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px' }}>Delete Device?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
              This will permanently remove the device configuration.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={handleDelete} style={{ ...addBtnStyle, backgroundColor: '#ef4444' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, width: '100%', maxWidth: 600, position: 'relative', maxHeight: '90vh', overflowY: 'auto', padding: '32px' }}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            <h3 style={{ marginTop: 0, marginBottom: 24 }}>{editingDevice ? 'Edit Device' : 'Add New Device'}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Device Name */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Device Name *</label>
                <input style={inputStyle} value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Head Office ZKTeco" />
              </div>

              {/* IP Address */}
              <div>
                <label style={labelStyle}>IP Address *</label>
                <input style={inputStyle} value={form.ip_address}
                  onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))}
                  placeholder="192.168.1.201" />
              </div>

              {/* Port */}
              <div>
                <label style={labelStyle}>Port</label>
                <input type="number" style={inputStyle} value={form.port}
                  onChange={e => setForm(f => ({ ...f, port: Number(e.target.value) }))} />
              </div>

              {/* Brand */}
              <div>
                <label style={labelStyle}>Brand</label>
                <select style={inputStyle} value={form.brand}
                  onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}>
                  <option value="ZKTeco">ZKTeco</option>
                  <option value="Hikvision">Hikvision</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Comm Key */}
              <div>
                <label style={labelStyle}>Comm Key</label>
                <input type="number" style={inputStyle} value={form.comm_key}
                  onChange={e => setForm(f => ({ ...f, comm_key: Number(e.target.value) }))} />
              </div>

              {/* Machine Number */}
              <div>
                <label style={labelStyle}>Machine Number</label>
                <input type="number" style={inputStyle} value={form.machine_number}
                  onChange={e => setForm(f => ({ ...f, machine_number: Number(e.target.value) }))} />
              </div>

              {/* Branch */}
              <div>
                <label style={labelStyle}>Branch</label>
                <select style={inputStyle} value={form.branch_id || ''}
                  onChange={e => setForm(f => ({ ...f, branch_id: e.target.value ? Number(e.target.value) : undefined }))}>
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              {/* Location */}
              <div>
                <label style={labelStyle}>Location</label>
                <input style={inputStyle} value={form.location || ''}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Main Entrance" />
              </div>

              {/* Server Address */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Server Address</label>
                <input style={inputStyle} value={form.server_address || ''}
                  onChange={e => setForm(f => ({ ...f, server_address: e.target.value }))}
                  placeholder="0.0.0.0" />
              </div>
            </div>

            {/* Test Status */}
            {testStatus.message && (
              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: 13,
                backgroundColor: testStatus.type === 'success' ? '#f0fdf4' : testStatus.type === 'error' ? '#fef2f2' : '#f8fafc',
                color: testStatus.type === 'success' ? '#16a34a' : testStatus.type === 'error' ? '#dc2626' : '#64748b',
                border: `1px solid ${testStatus.type === 'success' ? '#bbf7d0' : testStatus.type === 'error' ? '#fecaca' : '#e2e8f0'}` }}>
                {testStatus.message}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={handleTestConnection} style={secondaryBtnStyle} disabled={!form.ip_address}>
                {testStatus.type === 'loading' ? 'Testing...' : 'Test Connection'}
              </button>
              <button onClick={handleSave} style={addBtnStyle} disabled={saving}>
                {saving ? 'Saving...' : editingDevice ? 'Update Device' : 'Save Device'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Styles ──────────────────────────────────────────────────
const smallBtnStyle = (color: string): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 5, border: `1px solid ${color}`, background: 'transparent',
  color, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
});
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24
};
const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface-color)', borderRadius: 8,
  border: '1px solid var(--border-color)', padding: 20
};
const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)',
  backgroundColor: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)'
};
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 14 };
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block', color: 'var(--text-muted)' };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontSize: 14, outline: 'none', boxSizing: 'border-box'
};
const addBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, backgroundColor: 'var(--primary-color)',
  color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer'
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 6, backgroundColor: 'transparent',
  color: 'var(--primary-color)', border: '1px solid var(--primary-color)', fontWeight: 600, fontSize: 13, cursor: 'pointer'
};
const cancelBtnStyle: React.CSSProperties = {
  padding: '9px 20px', borderRadius: 6, backgroundColor: 'transparent',
  color: 'var(--text-color)', border: '1px solid var(--border-color)', fontWeight: 600, fontSize: 14, cursor: 'pointer'
};
