import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Wifi, WifiOff, FileText, Plus } from 'lucide-react';

interface Device {
  id: number;
  name: string;
  brand: string;
  ip: string;
  port: number;
  comm_key: number;
  machine_number: number;
  status: string;
  is_default: boolean;
  branch_id?: number;
  gate_id?: number;
  branch_name?: string;
  gate_name?: string;
  // Extended fields from photos
  subnet_mask?: string;
  gateway?: string;
  dns?: string;
  dhcp?: boolean;
  server_mode?: string;
  server_address?: string;
  https_enabled?: boolean;
}

interface Branch { id: number; name: string; }
interface Gate { id: number; name: string; }

const emptyForm = (): Omit<Device, 'id' | 'status' | 'is_default'> => ({
  name: '',
  brand: 'ZKTeco',
  ip: '',
  port: 4370,
  comm_key: 0,
  machine_number: 1,
  branch_id: 1,
  gate_id: 1,
  subnet_mask: '255.255.255.0',
  gateway: '192.168.1.1',
  dns: '8.8.8.8',
  dhcp: false,
  server_mode: 'Standalone',
  server_address: '0.0.0.0',
  https_enabled: false,
});

export const DeviceSettings: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [testStatus, setTestStatus] = useState<{ type: string; message: string }>({ type: 'idle', message: '' });
  const [saveStatus, setSaveStatus] = useState('');
  const [syncStatus, setSyncStatus] = useState<Record<number, string>>({});
  const [baseIp, setBaseIp] = useState('192.168.1');
  const [discoveredDevices, setDiscoveredDevices] = useState<{ ip: string; brand: string }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [previewLogs, setPreviewLogs] = useState<any[]>([]);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Offline Mode States
  const [showOfflineMode, setShowOfflineMode] = useState(false);
  const [offlineEmployees, setOfflineEmployees] = useState<{id: number; name: string; department: string}[]>([]);
  const [manualForm, setManualForm] = useState({ employeeId: '', date: new Date().toISOString().split('T')[0], time: '09:00', method: 'Manual' });
  const [manualStatus, setManualStatus] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [csvStatus, setCsvStatus] = useState('');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);

  const loadDevices = useCallback(async () => {
    try {
      const data = await invoke<Device[]>('list_all_devices');
      setDevices(data || []);
      const bs = await invoke<Branch[]>('list_branches');
      setBranches(bs || []);

      // DYNAMIC STATUS CHECK
      if (data && data.length > 0) {
        verifyDeviceStatuses(data);
      }
    } catch (e) {
      console.error('Failed to load devices/branches:', e);
    }
  }, []);

  const verifyDeviceStatuses = async (devList: Device[]) => {
    for (const dev of devList) {
      try {
        await invoke('test_device_connection', { 
            ip: dev.ip, 
            port: Number(dev.port), 
            commKey: Number(dev.comm_key),
            machineNumber: Number(dev.machine_number || 1),
            brand: dev.brand 
        });
        setDevices(prev => prev.map(d => d.id === dev.id ? { ...d, status: 'online' } : d));
      } catch {
        setDevices(prev => prev.map(d => d.id === dev.id ? { ...d, status: 'offline' } : d));
      }
    }
  };

  const loadGates = async (branch_id: number) => {
    if(!branch_id) return;
    try {
      const gs = await invoke<Gate[]>('list_gates', { branchId: branch_id });
      setGates(gs || []);
    } catch(e) { console.error('Failed to load gates', e); }
  };

  useEffect(() => {
    if(form.branch_id) loadGates(form.branch_id);
  }, [form.branch_id]);


  useEffect(() => {
    loadDevices();

    // AUTO-SYNC DEFAULT ON LOAD
    const triggerAutoSync = async () => {
      const allDevs = await invoke<Device[]>('list_all_devices');
      const defaultDev = allDevs?.find(d => d.is_default);
      if (defaultDev) {
        console.log("Auto-syncing default device:", defaultDev.name);
        handleSyncLogs(defaultDev);
      }
    };
    triggerAutoSync();

    let unlistenFound: any, unlistenStart: any, unlistenComplete: any;
    const setupScanner = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      unlistenFound = await listen('device-found', (event: any) => {
        setDiscoveredDevices(prev => {
          if (prev.some(d => d.ip === event.payload.ip)) return prev;
          return [...prev, { ip: event.payload.ip, brand: event.payload.brand }];
        });
      });
      unlistenStart = await listen('scanner-start', () => { setDiscoveredDevices([]); setIsScanning(true); });
      unlistenComplete = await listen('scanner-complete', () => setIsScanning(false));
    };
    setupScanner();
    return () => {
      if (unlistenFound) unlistenFound();
      if (unlistenStart) unlistenStart();
      if (unlistenComplete) unlistenComplete();
    };
  }, [loadDevices]);

  const openAddModal = () => {
    setEditingDevice(null);
    setForm(emptyForm());
    setTestStatus({ type: 'idle', message: '' });
    setSaveStatus('');
    setModalOpen(true);
  };

  const openEditModal = (dev: Device) => {
    setEditingDevice(dev);
    setForm({ 
        name: dev.name, brand: dev.brand, ip: dev.ip, port: dev.port, 
        comm_key: dev.comm_key || 0,
        machine_number: dev.machine_number || 1,
        branch_id: dev.branch_id || 1, gate_id: dev.gate_id || 1,
        subnet_mask: dev.subnet_mask || '255.255.255.0',
        gateway: dev.gateway || '',
        dns: dev.dns || '0.0.0.0',
        dhcp: dev.dhcp || false,
        server_mode: dev.server_mode || 'Standalone',
        server_address: dev.server_address || '0.0.0.0',
        https_enabled: dev.https_enabled || false,
    });
    setTestStatus({ type: 'idle', message: '' });
    setSaveStatus('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDevice(null);
    setSaveStatus('');
    setTestStatus({ type: 'idle', message: '' });
  };

  const handleBrandChange = (brand: string) => {
    setForm(f => ({ ...f, brand, port: brand === 'ZKTeco' ? 4370 : 8000 }));
  };

  const handleTest = async () => {
    setTestStatus({ type: 'loading', message: 'Testing...' });
    try {
      await invoke('test_device_connection', { 
        ip: form.ip, 
        port: Number(form.port), 
        commKey: Number(form.comm_key),
        machineNumber: Number(form.machine_number),
        brand: form.brand 
      });
      setTestStatus({ type: 'success', message: '✅ Device Reachable' });
    } catch (e) {
      setTestStatus({ type: 'error', message: `❌ Failed: ${e}` });
    }
  };

  const handleSave = async () => {
    setSaveStatus('Saving...');
    try {
      if (editingDevice) {
        await invoke('save_device_config', {
          id: editingDevice.id,
          name: form.name,
          brand: form.brand,
          ip: form.ip,
          port: Number(form.port),
          commKey: Number(form.comm_key),
          branchId: form.branch_id || 1,
          gateId: form.gate_id || 1,
          subnetMask: form.subnet_mask,
          gateway: form.gateway,
          dns: form.dns,
          dhcp: form.dhcp ? 1 : 0,
          serverMode: form.server_mode,
          serverAddress: form.server_address,
          httpsEnabled: form.https_enabled ? 1 : 0,
        });
      } else {
        await invoke('register_new_device', {
          device: {
            name: form.name, brand: form.brand, ip: form.ip, port: Number(form.port),
            commKey: Number(form.comm_key), machineNumber: Number(form.machine_number),
            branchId: form.branch_id, gateId: form.gate_id,
            subnetMask: form.subnet_mask, gateway: form.gateway, dns: form.dns,
            dhcp: form.dhcp ? 1 : 0, serverMode: form.server_mode,
            serverAddress: form.server_address, httpsEnabled: form.https_enabled ? 1 : 0,
          }
        });
      }
      setSaveStatus('✅ Saved!');
      await loadDevices();
      setTimeout(closeModal, 800);
    } catch (e) {
      setSaveStatus(`❌ ${e}`);
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
        await invoke('set_default_device', { id });
        await loadDevices();
    } catch (e) { console.error("Set default failed", e); }
  };

  const handleDelete = async (id: number) => {
    try {
      await invoke('delete_device', { id });
      setDeleteConfirm(null);
      await loadDevices();
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  const handleSyncLogs = async (dev: Device) => {
    setSyncStatus(prev => ({ ...prev, [dev.id]: 'Syncing...' }));
    try {
      const logs = await invoke<any[]>('sync_device_logs', {
        ip: dev.ip,
        port: Number(dev.port),
        deviceId: dev.id,
        brand: dev.brand,
      });
      setPreviewLogs(logs);
      setPreviewModalOpen(true);
      setSyncStatus(prev => ({ ...prev, [dev.id]: `✅ Pulled ${logs.length} logs` }));
    } catch (e) {
      setSyncStatus(prev => ({ ...prev, [dev.id]: `❌ ${e}` }));
    }
    setTimeout(() => setSyncStatus(prev => ({ ...prev, [dev.id]: '' })), 6000);
  };

  const handlePullAllLogs = async (dev: Device) => {
    if (!confirm(`Pull ALL attendance logs from "${dev.name}"?\n\nThis will fetch every log from day one to now.\nDuplicate logs will be auto-skipped.`)) return;
    setSyncStatus(prev => ({ ...prev, [dev.id]: '🔄 Pulling ALL logs...' }));
    try {
      const logs = await invoke<any[]>('pull_all_logs', {
        ip: dev.ip,
        port: Number(dev.port),
        deviceId: dev.id,
        brand: dev.brand,
      });
      setPreviewLogs(logs);
      setPreviewModalOpen(true);
      setSyncStatus(prev => ({ ...prev, [dev.id]: `✅ Pulled ${logs.length} logs` }));
    } catch (e) {
      setSyncStatus(prev => ({ ...prev, [dev.id]: `❌ ${e}` }));
    }
    setTimeout(() => setSyncStatus(prev => ({ ...prev, [dev.id]: '' })), 10000);
  };

  const handleScan = async () => {
    try { await invoke('scan_network', { baseIp }); } catch {}
  };

  const selectDiscovered = (d: { ip: string; brand: string }) => {
    setForm(f => ({ ...f, ip: d.ip, brand: d.brand, port: d.brand === 'ZKTeco' ? 4370 : 8000 }));
  };

  // ── Offline Mode Functions ────────────────────────────────────────────

  const loadOfflineEmployees = async () => {
    try {
      const emps = await invoke<any[]>('list_employees_for_select');
      setOfflineEmployees(emps || []);
    } catch (e) { console.error(e); }
  };

  const handleManualEntry = async () => {
    if (!manualForm.employeeId) { alert('Please select an employee'); return; }
    setManualStatus('Saving...');
    try {
      const timestamp = `${manualForm.date}T${manualForm.time}:00`;
      await invoke('add_manual_attendance', {
        employeeId: parseInt(manualForm.employeeId),
        timestamp,
        punchMethod: manualForm.method,
      });
      setManualStatus('✅ Saved!');
      setManualForm({ ...manualForm, employeeId: '' });
    } catch (e) {
      setManualStatus(`❌ ${e}`);
    }
    setTimeout(() => setManualStatus(''), 3000);
  };

  const handleCSVImport = async () => {
    if (!csvContent.trim()) { setCsvStatus('❌ Paste CSV data first'); return; }
    setCsvStatus('Importing...');
    try {
      const result = await invoke<any>('import_csv_attendance', { csvContent });
      setCsvStatus(`✅ Imported: ${result.imported}, Skipped: ${result.skipped}${result.errors.length ? `, Errors: ${result.errors.length}` : ''}`);
      setCsvContent('');
    } catch (e) {
      setCsvStatus(`❌ ${e}`);
    }
    setTimeout(() => setCsvStatus(''), 5000);
  };

  const statusColor = (s: string) => s === 'online' ? '#10b981' : '#6b7280';

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0 }}>Device Management</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
            Manage biometric hardware (ZKTeco / Hikvision) for attendance synchronization.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => { setShowOfflineMode(!showOfflineMode); loadOfflineEmployees(); }} style={{
            ...addBtnStyle,
            backgroundColor: showOfflineMode ? 'var(--warning)' : 'var(--bg-color)',
            color: showOfflineMode ? 'white' : 'var(--text-color)',
            border: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            {showOfflineMode ? <WifiOff size={16} /> : <Wifi size={16} />}
            {showOfflineMode ? 'Close Offline Mode' : 'Offline Mode'}
          </button>
          <button onClick={openAddModal} style={addBtnStyle}>
            + Add Device
          </button>
        </div>
      </div>

      {/* Offline Mode Panel */}
      {showOfflineMode && (
        <div style={{
          ...cardStyle, marginBottom: 24, borderColor: 'var(--warning)',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.03), rgba(245,158,11,0.08))'
        }}>
          <h3 style={{ margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WifiOff size={20} color="var(--warning)" /> Offline Mode — Manual Entry & CSV Import
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Manual Entry */}
            <div style={{ padding: '20px', backgroundColor: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Manual Attendance Entry
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <select
                  value={manualForm.employeeId}
                  onChange={(e) => setManualForm({...manualForm, employeeId: e.target.value})}
                  style={{ marginBottom: 0 }}
                >
                  <option value="">Select Employee</option>
                  {offlineEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="date"
                    value={manualForm.date}
                    onChange={(e) => setManualForm({...manualForm, date: e.target.value})}
                    style={{ marginBottom: 0, flex: 1 }}
                  />
                  <input
                    type="time"
                    value={manualForm.time}
                    onChange={(e) => setManualForm({...manualForm, time: e.target.value})}
                    style={{ marginBottom: 0, flex: 1 }}
                  />
                </div>
                <select
                  value={manualForm.method}
                  onChange={(e) => setManualForm({...manualForm, method: e.target.value})}
                  style={{ marginBottom: 0 }}
                >
                  <option value="Manual">Manual</option>
                  <option value="Face">Face</option>
                  <option value="Finger">Finger</option>
                  <option value="Card">RFID Card</option>
                </select>
                <button onClick={handleManualEntry} style={{ width: '100%' }}>Save Entry</button>
                {manualStatus && (
                  <div style={{ fontSize: '12px', textAlign: 'center', color: manualStatus.startsWith('✅') ? 'var(--success)' : 'var(--error)' }}>
                    {manualStatus}
                  </div>
                )}
              </div>
            </div>

            {/* CSV Import */}
            <div style={{ padding: '20px', backgroundColor: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} /> CSV Import
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                Format: <code style={{ backgroundColor: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px' }}>employee_id,YYYY-MM-DD HH:MM:SS,method</code>
              </p>
              <textarea
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder={"1,2025-04-07 09:00:00,Finger\n2,2025-04-07 09:15:00,Face\n3,2025-04-07 08:55:00,Card"}
                rows={6}
                style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical', marginBottom: '12px' }}
              />
              <button onClick={handleCSVImport} style={{ width: '100%' }}>Import Data</button>
              {csvStatus && (
                <div style={{ fontSize: '12px', textAlign: 'center', color: csvStatus.startsWith('✅') ? 'var(--success)' : csvStatus.startsWith('❌') ? 'var(--error)' : 'var(--text-muted)', marginTop: '8px' }}>
                  {csvStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Device Table */}
      <div style={cardStyle}>
        {devices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No devices configured yet</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Click "Add Device" to register your first biometric device.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Device Name', 'Location', 'IP Address', 'Status', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map(dev => (
                <React.Fragment key={dev.id}>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: dev.is_default ? 'rgba(124, 58, 237, 0.03)' : 'transparent' }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                         <div style={{ fontWeight: 600 }}>{dev.name}</div>
                         {dev.is_default && <span style={{ fontSize: 9, backgroundColor: 'var(--primary-color)', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>DEFAULT</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                         {dev.brand} : {dev.port}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{dev.branch_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gate: {dev.gate_name}</div>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 13 }}>{dev.ip}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor(dev.status), display: 'inline-block' }} />
                        <span style={{ textTransform: 'capitalize', color: statusColor(dev.status), fontWeight: 600 }}>{dev.status}</span>
                      </span>
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {!dev.is_default && (
                            <ActionBtn label="⭐ Set Default" onClick={() => handleSetDefault(dev.id)} color="var(--accent-color)" />
                        )}
                        <ActionBtn label="✏️ Edit" onClick={() => openEditModal(dev)} color="var(--primary-color)" />
                        <ActionBtn
                          label="⬇️ Sync Logs"
                          onClick={() => handleSyncLogs(dev)}
                          color="#7c3aed"
                          disabled={!!syncStatus[dev.id]}
                        />
                        <ActionBtn
                          label="📥 Pull ALL Logs"
                          onClick={() => handlePullAllLogs(dev)}
                          color="#059669"
                          disabled={!!syncStatus[dev.id]}
                        />
                        <ActionBtn
                          label="🗑️ Delete"
                          onClick={() => setDeleteConfirm(dev.id)}
                          color="#ef4444"
                        />
                      </div>
                    </td>
                  </tr>
                  {syncStatus[dev.id] && (
                    <tr>
                      <td colSpan={5} style={{ padding: '6px 16px', fontSize: 12, color: syncStatus[dev.id].startsWith('✅') ? 'var(--success)' : '#ef4444', backgroundColor: 'var(--bg-color)' }}>
                        {syncStatus[dev.id]}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete Confirm */}
      {deleteConfirm !== null && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxWidth: 360, textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px' }}>Delete Device?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
              This will permanently remove the device configuration.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ ...cancelBtnStyle, backgroundColor: '#ef4444', color: '#fff', borderColor: '#ef4444' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, width: '100%', maxWidth: 780, position: 'relative', maxHeight: '90vh', overflowY: 'auto', padding: '32px' }}>
            <button onClick={closeModal} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            <h3 style={{ marginTop: 0, marginBottom: 24 }}>{editingDevice ? 'Edit Device' : 'Add New Device'}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1.2fr) 280px', gap: 32, alignItems: 'start' }}>
              {/* Form */}
              <div>
                <div style={{ ...sectionHeaderStyle, marginTop: 24 }}>Essential Connection (*)</div>
                <div style={rowStyle}>
                  <div style={{ flex: 2 }}>
                    <label style={labelStyle}>Device Name *</label>
                    <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Main Office Unit" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Brand *</label>
                    <select style={inputStyle} value={form.brand} onChange={e => handleBrandChange(e.target.value)}>
                      <option value="ZKTeco">ZKTeco</option>
                      <option value="Hikvision">Hikvision</option>
                    </select>
                  </div>
                </div>

                <div style={rowStyle}>
                  <div style={{ flex: 2 }}>
                    <label style={labelStyle}>IP Address *</label>
                    <input style={inputStyle} value={form.ip} onChange={e => setForm(f => ({ ...f, ip: e.target.value }))} placeholder="192.168.192.200" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Port *</label>
                    <input style={inputStyle} type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: Number(e.target.value) }))} />
                  </div>
                </div>

                <div style={rowStyle}>
                   <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Machine ID / Device No. *</label>
                    <input style={inputStyle} type="number" value={form.machine_number} onChange={e => setForm(f => ({ ...f, machine_number: Number(e.target.value) }))} />
                    <p style={helpTextStyle}>Photo shows: 11</p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Comm Key (Password)</label>
                    <input style={inputStyle} type="number" value={form.comm_key} onChange={e => setForm(f => ({ ...f, comm_key: Number(e.target.value) }))} />
                    <p style={helpTextStyle}>Default is 0</p>
                  </div>
                </div>

                <div style={sectionHeaderStyle}>Ethernet Settings (Network)</div>
                <div style={rowStyle}>
                   <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Subnet Mask</label>
                    <input style={inputStyle} value={form.subnet_mask} onChange={e => setForm(f => ({ ...f, subnet_mask: e.target.value }))} placeholder="255.255.255.0" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Gateway</label>
                    <input style={inputStyle} value={form.gateway} onChange={e => setForm(f => ({ ...f, gateway: e.target.value }))} placeholder="192.168.1.1" />
                  </div>
                </div>
                <div style={rowStyle}>
                   <div style={{ flex: 1 }}>
                    <label style={labelStyle}>DNS</label>
                    <input style={inputStyle} value={form.dns} onChange={e => setForm(f => ({ ...f, dns: e.target.value }))} placeholder="0.0.0.0" />
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingTop: 20 }}>
                     <input type="checkbox" checked={form.dhcp} onChange={e => setForm(f => ({ ...f, dhcp: e.target.checked }))} style={{ marginRight: 8 }} />
                     <label style={labelStyle}>Enable DHCP</label>
                  </div>
                </div>

                <div style={sectionHeaderStyle}>Cloud Server Setting (ADMS)</div>
                <div style={rowStyle}>
                   <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Server Mode</label>
                    <select style={inputStyle} value={form.server_mode} onChange={e => setForm(f => ({ ...f, server_mode: e.target.value }))}>
                       <option value="Standalone">Standalone</option>
                       <option value="ADMS">ADMS (Cloud)</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Server Address</label>
                    <input style={inputStyle} value={form.server_address} onChange={e => setForm(f => ({ ...f, server_address: e.target.value }))} placeholder="0.0.0.0" />
                  </div>
                </div>
                <div style={rowStyle}>
                   <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                     <input type="checkbox" checked={form.https_enabled} onChange={e => setForm(f => ({ ...f, https_enabled: e.target.checked }))} style={{ marginRight: 8 }} />
                     <label style={labelStyle}>Enable HTTPS</label>
                  </div>
                </div>

                <div style={sectionHeaderStyle}>Site Allocation</div>
                <div style={rowStyle}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Branch</label>
                    <select style={inputStyle} value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: Number(e.target.value) }))}>
                       {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Gate / Location</label>
                    <select style={inputStyle} value={form.gate_id} onChange={e => setForm(f => ({ ...f, gate_id: Number(e.target.value) }))}>
                      {gates.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button onClick={handleTest} disabled={!form.ip || testStatus.type === 'loading'} style={secondaryBtnStyle}>
                    {testStatus.type === 'loading' ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button onClick={handleSave} disabled={!form.name || !form.ip} style={primaryBtnStyle}>
                    {editingDevice ? 'Update Device' : 'Save Device'}
                  </button>
                </div>

                {testStatus.message && (
                  <div style={{ marginTop: 12, fontSize: 13, color: testStatus.type === 'success' ? 'var(--success)' : testStatus.type === 'error' ? '#ef4444' : 'var(--text-muted)' }}>
                    {testStatus.message}
                  </div>
                )}
                {saveStatus && (
                  <div style={{ marginTop: 8, fontSize: 13, color: saveStatus.startsWith('✅') ? 'var(--success)' : '#ef4444' }}>
                    {saveStatus}
                  </div>
                )}
              </div>

              {/* Auto-Detect Panel */}
              <div style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>Auto-Detect Device</div>
                <label style={labelStyle}>Base IP Range</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input style={{ ...inputStyle, flex: 1 }} value={baseIp} onChange={e => setBaseIp(e.target.value)} placeholder="192.168.1" />
                  <button onClick={handleScan} disabled={isScanning} style={{ ...primaryBtnStyle, fontSize: 12, padding: '8px 14px', whiteSpace: 'nowrap' }}>
                    {isScanning ? '...' : 'SCAN'}
                  </button>
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                  {discoveredDevices.length === 0 && !isScanning && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No devices found yet</div>
                  )}
                  {isScanning && (
                    <div style={{ fontSize: 12, color: 'var(--primary-color)', textAlign: 'center', padding: 16 }}>Scanning network...</div>
                  )}
                  {discoveredDevices.map(d => (
                    <div key={d.ip} onClick={() => selectDiscovered(d)} style={{ fontSize: 12, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b>{d.ip}</b>
                      <span style={{ fontSize: 10, color: 'var(--success)' }}>{d.brand}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connection Tips */}
      <div style={{ ...cardStyle, marginTop: 24, borderLeft: '4px solid var(--accent-color)' }}>
        <h4 style={{ marginBottom: 12 }}>Connection Tips</h4>
        <ul style={{ color: 'var(--text-muted)', fontSize: 14, paddingLeft: 20, lineHeight: 1.7, margin: 0 }}>
        </ul>
      </div>

      {/* Preview Modal */}
      {previewModalOpen && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, width: '100%', maxWidth: 600, padding: 32, position: 'relative' }}>
            <button onClick={() => setPreviewModalOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            <h3 style={{ marginTop: 0, marginBottom: 20 }}>Data Pull Preview</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              The following logs were successfully pulled and saved to the database.
            </p>
            
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-color)', zIndex: 10 }}>
                  <tr>
                    <th style={{ ...thStyle, padding: '10px 16px' }}>Emp ID</th>
                    <th style={{ ...thStyle, padding: '10px 16px' }}>Timestamp</th>
                    <th style={{ ...thStyle, padding: '10px 16px' }}>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {previewLogs.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: 24, fontSize: 14, color: 'var(--text-muted)' }}>No new logs found.</td>
                    </tr>
                  ) : (
                    previewLogs.map((log, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ ...tdStyle, padding: '10px 16px', fontWeight: 600 }}>{log.employee_id}</td>
                        <td style={{ ...tdStyle, padding: '10px 16px', fontSize: 13 }}>{new Date(log.timestamp).toLocaleString()}</td>
                        <td style={{ ...tdStyle, padding: '10px 16px' }}>
                          <span style={{ fontSize: 11, backgroundColor: 'var(--bg-color)', padding: '2px 8px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                            {log.punch_method}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <button onClick={() => setPreviewModalOpen(false)} style={primaryBtnStyle}>Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ActionBtn: React.FC<{ label: string; onClick: () => void; color: string; disabled?: boolean }> = ({ label, onClick, color, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '5px 12px', borderRadius: 5, border: `1px solid ${color}`, background: 'transparent',
      color: color, fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      transition: 'all 0.15s',
    }}
  >
    {label}
  </button>
);

// Styles
const cardStyle: React.CSSProperties = { backgroundColor: 'var(--surface-color)', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.1)', overflow: 'hidden' };
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' };
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 14 };
const rowStyle: React.CSSProperties = { display: 'flex', gap: 16, marginBottom: 20 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const addBtnStyle: React.CSSProperties = { padding: '10px 20px', borderRadius: 8, backgroundColor: 'var(--primary-color)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const primaryBtnStyle: React.CSSProperties = { padding: '9px 18px', borderRadius: 6, backgroundColor: 'var(--primary-color)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const secondaryBtnStyle: React.CSSProperties = { padding: '9px 18px', borderRadius: 6, backgroundColor: 'transparent', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const cancelBtnStyle: React.CSSProperties = { padding: '9px 20px', borderRadius: 6, backgroundColor: 'transparent', color: 'var(--text-color)', border: '1px solid var(--border-color)', fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const sectionHeaderStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, margin: '24px 0 16px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: 6 };
const helpTextStyle: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 };
