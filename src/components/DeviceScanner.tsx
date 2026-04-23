import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface DiscoveredDevice {
  ip: string;
  brand: string;
  status: string;
}

export const DeviceScanner: React.FC = () => {
  const [baseIp, setBaseIp] = useState('192.168.1');
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);

  useEffect(() => {
    const unlistenStart = listen<string>('scanner-start', (event) => {
      setIsScanning(true);
      setDevices([]);
      console.log('Scanner started on base:', event.payload);
    });

    const unlistenDevice = listen<DiscoveredDevice>('device-found', (event) => {
      setDevices((prev) => [...prev, event.payload]);
    });

    const unlistenComplete = listen('scanner-complete', () => {
      setIsScanning(false);
      console.log('Scanner completed');
    });

    return () => {
      unlistenStart.then(fn => fn());
      unlistenDevice.then(fn => fn());
      unlistenComplete.then(fn => fn());
    };
  }, []);

  const handleScan = async () => {
    try {
      await invoke('scan_network', { baseIp });
    } catch (e) {
      alert("Failed to start scan: " + e);
    }
  };

  const handleSync = async (ip: string, brand: string) => {
    const port = brand === 'ZKTeco' ? 4370 : 8000;
    try {
      await invoke('sync_device_logs', { 
        ip, 
        port, 
        deviceId: 1, 
        brand,
        targetBranchId: 1,
        targetGateId: 1
      });
      window.dispatchEvent(new CustomEvent('data-synced', { detail: { table: 'employees' } }));
    } catch (e) {
      alert("Failed to sync: " + e);
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--surface-color)', padding: '24px', borderRadius: '8px', marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3>Smart Device Discovery</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            value={baseIp} 
            onChange={(e) => setBaseIp(e.target.value)} 
            placeholder="Subnet (e.g., 192.168.1)" 
            style={{ marginBottom: 0, width: '200px' }}
          />
          <button className="accent" onClick={handleScan} disabled={isScanning}>
            {isScanning ? 'Scanning...' : 'Search Devices'}
          </button>
        </div>
      </div>

      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
            <th style={{ padding: '12px' }}>IP Address</th>
            <th>Brand/Protocol</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {devices.length === 0 && !isScanning && (
            <tr>
              <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No devices found. Enter your subnet address and click Search Devices.
              </td>
            </tr>
          )}
          {devices.map((dev, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '12px', fontFamily: 'monospace' }}>{dev.ip}</td>
              <td style={{ fontWeight: '500' }}>{dev.brand}</td>
              <td>
                <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="pulse" style={{width: 8, height: 8, backgroundColor: 'var(--success)', borderRadius: '50%'}}></div> 
                  {dev.status}
                </span>
              </td>
              <td>
                <button style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleSync(dev.ip, dev.brand)}>
                  Sync Logs
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Manual Override Form */}
      <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
        <h4 style={{ marginBottom: '8px', color: 'var(--text-muted)' }}>Manual Override (Advanced)</h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input placeholder="IP Address" style={{ marginBottom: 0 }} />
          <select style={{ marginBottom: 0, width: '150px' }}>
            <option value="ZKTeco">ZKTeco (4370)</option>
            <option value="Hikvision">Hikvision (ISAPI)</option>
          </select>
          <button>Add Manually</button>
        </div>
      </div>
    </div>
  );
};
