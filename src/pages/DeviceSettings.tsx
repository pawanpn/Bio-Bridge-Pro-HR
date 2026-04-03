import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { StandardInput } from '../components/common/StandardInput';

interface Device {
  name: string;
  brand: string;
  ip: string;
  port: number;
  status: string;
}

export const DeviceSettings: React.FC = () => {
  const [device, setDevice] = useState<Device>({
    name: '',
    brand: 'ZKTeco',
    ip: '',
    port: 4370,
    status: 'offline'
  });
  const [testStatus, setTestStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [saveStatus, setSaveStatus] = useState<string>('');
  
  const [baseIp, setBaseIp] = useState<string>('192.168.1');
  const [discoveredDevices, setDiscoveredDevices] = useState<{ ip: string; brand: string }[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  useEffect(() => {
    loadDevice();
    
    // Subscribe to scanner events
    let unlistenFound: any;
    let unlistenStart: any;
    let unlistenComplete: any;

    const setupScanner = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      unlistenFound = await listen('device-found', (event: any) => {
        setDiscoveredDevices(prev => {
          if (prev.some(d => d.ip === event.payload.ip)) return prev;
          return [...prev, { ip: event.payload.ip, brand: event.payload.brand }];
        });
      });
      unlistenStart = await listen('scanner-start', () => {
        setDiscoveredDevices([]);
        setIsScanning(true);
      });
      unlistenComplete = await listen('scanner-complete', () => {
        setIsScanning(false);
      });
    };
    setupScanner();

    return () => {
      if (unlistenFound) unlistenFound();
      if (unlistenStart) unlistenStart();
      if (unlistenComplete) unlistenComplete();
    };
  }, []);

  const loadDevice = async () => {
    try {
      const data = await invoke<Device | null>('get_active_devices');
      if (data) {
        setDevice(data);
      }
    } catch (e) {
      console.error('Failed to load device:', e);
    }
  };

  const handleScan = async () => {
    try {
      await invoke('scan_network', { baseIp });
    } catch (e) {
      console.error('Scan failed:', e);
    }
  };

  const selectDiscovered = (d: { ip: string; brand: string }) => {
    setDevice({
      ...device,
      ip: d.ip,
      brand: d.brand,
      port: d.brand === 'ZKTeco' ? 4370 : 8000
    });
  };

  const handleTestConnection = async () => {
    setTestStatus({ type: 'loading', message: 'Testing connectivity...' });
    try {
      await invoke('test_device_connection', {
        ip: device.ip,
        port: Number(device.port),
        brand: device.brand
      });
      setTestStatus({ type: 'success', message: '✅ Device Reachable' });
    } catch (e) {
      setTestStatus({ type: 'error', message: `❌ Connection Failed: ${e}` });
    }
  };

  const handleSave = async () => {
    setSaveStatus('Saving...');
    try {
      await invoke('save_device_config', {
        name: device.name,
        brand: device.brand,
        ip: device.ip,
        port: Number(device.port)
      });
      setSaveStatus('✅ Device configuration saved!');
      loadDevice();
    } catch (e) {
      setSaveStatus(`❌ Save failed: ${e}`);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px' }}>
      <h1>Device Settings</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Configure your biometric hardware (ZKTeco or Hikvision) for synchronization.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', alignItems: 'start' }}>
        <div style={cardStyle}>
          <h3 style={{ marginBottom: '24px' }}>Hardware Configuration</h3>
          
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Device Name</label>
              <StandardInput 
                value={device.name} 
                onChange={e => setDevice({ ...device, name: e.target.value })} 
                placeholder="e.g. Main Entrance"
              />
            </div>
            <div style={{ width: '120px' }}>
              <label style={labelStyle}>Brand</label>
              <select 
                style={selectStyle}
                value={device.brand} 
                onChange={e => {
                  const brand = e.target.value;
                  setDevice({ ...device, brand, port: brand === 'ZKTeco' ? 4370 : 8000 });
                }}
              >
                <option value="ZKTeco">ZKTeco</option>
                <option value="Hikvision">Hikvision</option>
              </select>
            </div>
          </div>

          <div style={rowStyle}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>IP Address</label>
              <StandardInput 
                value={device.ip} 
                onChange={e => setDevice({ ...device, ip: e.target.value })} 
                placeholder="192.168.1.201"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Port</label>
              <StandardInput 
                type="number"
                value={device.port.toString()} 
                onChange={e => setDevice({ ...device, port: Number(e.target.value) })} 
                placeholder={device.brand === 'ZKTeco' ? '4370' : '8000'}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '32px', alignItems: 'center' }}>
            <PrimaryButton 
              label="Test Connection" 
              onClick={handleTestConnection} 
              disabled={testStatus.type === 'loading' || !device.ip}
            />
            <PrimaryButton 
              isAccent
              label="Save Configuration" 
              onClick={handleSave} 
              disabled={!device.name || !device.ip}
            />
            
            <div style={{ 
              marginLeft: 'auto',
              padding: '8px 16px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '600',
              backgroundColor: testStatus.type === 'success' ? 'rgba(16,185,129,0.1)' : testStatus.type === 'error' ? 'rgba(239,68,68,0.1)' : 'transparent',
              color: testStatus.type === 'success' ? 'var(--success)' : testStatus.type === 'error' ? 'var(--error)' : 'var(--text-muted)'
            }}>
              {testStatus.message}
            </div>
          </div>
          
          {saveStatus && (
            <div style={{ marginTop: '16px', fontSize: '14px', color: saveStatus.includes('❌') ? 'var(--error)' : 'var(--success)' }}>
              {saveStatus}
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, padding: '24px' }}>
          <h4 style={{ marginBottom: '16px' }}>Auto-Detect Device</h4>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Base IP Range</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                value={baseIp} 
                onChange={e => setBaseIp(e.target.value)} 
                style={{ ...selectStyle, padding: '8px' }}
                placeholder="192.168.1"
              />
              <button 
                onClick={handleScan}
                disabled={isScanning}
                style={{ 
                  padding: '8px 12px', borderRadius: '4px', border: 'none', 
                  backgroundColor: 'var(--primary-color)', color: 'white', cursor: 'pointer',
                  fontSize: '11px', fontWeight: 'bold'
                }}
              >
                {isScanning ? '...' : 'SCAN'}
              </button>
            </div>
          </div>

          <div style={{ 
            maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', 
            borderRadius: '4px', padding: '8px', backgroundColor: 'var(--bg-color)' 
          }}>
            {discoveredDevices.length === 0 && !isScanning && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>No devices found yet</div>
            )}
            {isScanning && (
              <div style={{ fontSize: '11px', color: 'var(--primary-color)', textAlign: 'center' }}>Scanning network...</div>
            )}
            {discoveredDevices.map(d => (
              <div 
                key={d.ip} 
                onClick={() => selectDiscovered(d)}
                style={{ 
                  fontSize: '12px', padding: '8px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <b>{d.ip}</b>
                <span style={{ fontSize: '10px', color: 'var(--success)' }}>{d.brand}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: '24px', borderLeft: '4px solid var(--accent-color)' }}>
        <h4 style={{ marginBottom: '12px' }}>Connection Tips</h4>
        <ul style={{ color: 'var(--text-muted)', fontSize: '14px', paddingLeft: '20px', lineHeight: '1.6' }}>
          <li>Ensure the device is connected to the same local network (LAN).</li>
          <li>For **ZKTeco**, default port is **4370**. For **Hikvision**, usually **8000** or **80**.</li>
          <li>If scanner fails, try entering the machine's IP manually.</li>
        </ul>
      </div>
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface-color)',
  padding: '32px',
  borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '24px',
  marginBottom: '24px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: 'var(--text-muted)',
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '4px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-color)',
  color: 'var(--text-color)',
  fontSize: '14px',
  outline: 'none',
};
