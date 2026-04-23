import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Edit2,
  Trash2,
  Download,
  Wifi,
  WifiOff,
  Info,
  Eye,
  Star,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface Device {
  id: number;
  name: string;
  brand: string;
  ip: string;
  port: number;
  comm_key: number;
  machine_number: number;
  branch_id: number;
  branch_name: string;
  gate_id: number;
  gate_name: string;
  status: string;
  is_default: boolean;
}

interface Branch {
  id: number;
  name: string;
}

interface Gate {
  id: number;
  branch_id: number;
  name: string;
}

export const DeviceManagement: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingDevices, setSyncingDevices] = useState<Set<number>>(new Set());
  const [syncMessages, setSyncMessages] = useState<Record<number, string>>({});
  const [deviceDialog, setDeviceDialog] = useState({ open: false, editing: null as Device | null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: number; name: string }>({
    open: false, id: 0, name: ''
  });

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [deviceData, branchData] = await Promise.all([
        invoke<any[]>('list_all_devices'),
        invoke<any[]>('list_branches'),
      ]);
      setDevices(deviceData);
      setBranches(branchData);
      
      // Load gates for all branches
      const allGates: Gate[] = [];
      for (const branch of branchData) {
        const branchGates = await invoke<any[]>('list_gates', { branchId: branch.id });
        allGates.push(...branchGates);
      }
      setGates(allGates);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync logs from device
  const handleSyncDeviceLogs = async (device: Device) => {
    setSyncingDevices(prev => new Set(prev).add(device.id));
    setSyncMessages(prev => ({ ...prev, [device.id]: '🔄 Syncing logs...' }));
    
    try {
      const result = await invoke('sync_device_logs', {
        ip: device.ip,
        port: device.port,
        deviceId: device.id,
        brand: device.brand,
      });
      const logs = result as any[];
      setSyncMessages(prev => ({ ...prev, [device.id]: `✅ Successfully synced ${logs.length} logs!` }));
      setTimeout(() => {
        setSyncMessages(prev => {
          const updated = { ...prev };
          delete updated[device.id];
          return updated;
        });
      }, 5000);
    } catch (error) {
      setSyncMessages(prev => ({ ...prev, [device.id]: `❌ Sync failed: ${error}` }));
      setTimeout(() => {
        setSyncMessages(prev => {
          const updated = { ...prev };
          delete updated[device.id];
          return updated;
        });
      }, 5000);
    } finally {
      setSyncingDevices(prev => {
        const updated = new Set(prev);
        updated.delete(device.id);
        return updated;
      });
    }
  };

  // Set default device
  const handleSetDefaultDevice = async (deviceId: number) => {
    try {
      await invoke('set_default_device', { id: deviceId });
      loadData();
    } catch (error) {
      console.error('Failed to set default device:', error);
    }
  };

  // Delete device
  const handleDeleteDevice = async () => {
    try {
      await invoke('delete_device', { id: deleteDialog.id });
      setDeleteDialog({ open: false, id: 0, name: '' });
      loadData();
    } catch (error) {
      console.error('Failed to delete device:', error);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Device Management</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage biometric hardware (ZKTeco / Hikvision) for attendance synchronization.
          </p>
        </div>
        <Button onClick={() => setDeviceDialog({ open: true, editing: null })} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Device
        </Button>
      </div>

      {/* Sync Messages */}
      {Object.entries(syncMessages).map(([deviceId, message]) => (
        <div
          key={deviceId}
          className={`mb-4 p-3 rounded-md border flex items-start gap-2 ${
            message.includes('✅') ? 'bg-green-50 border-green-200 text-green-700' :
            message.includes('❌') ? 'bg-red-50 border-red-200 text-red-700' :
            'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          {message.includes('❌') && <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <span className="flex-1">{message}</span>
        </div>
      ))}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : devices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No devices found. Add your first device to start collecting attendance.
                  </TableCell>
                </TableRow>
              ) : (
                devices.map(device => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {device.name}
                          {device.is_default && (
                            <Badge variant="default" className="text-xs">DEFAULT</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{device.brand} : {device.port}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{device.branch_name}</div>
                        <div className="text-xs text-muted-foreground">Gate: {device.gate_name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {device.ip}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {device.status === 'online' ? (
                          <>
                            <Wifi className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-600 font-medium">Online</span>
                          </>
                        ) : (
                          <>
                            <WifiOff className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-500 font-medium">Offline</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {!device.is_default && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetDefaultDevice(device.id)}
                            className="gap-1 h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            <Star className="w-3 h-3" />
                            Set Default
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeviceDialog({ open: true, editing: device })}
                          className="gap-1 h-8"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSyncDeviceLogs(device)}
                          disabled={syncingDevices.has(device.id)}
                          className="gap-1 h-8"
                        >
                          {syncingDevices.has(device.id) ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Syncing...
                            </>
                          ) : (
                            <>
                              <Download className="w-3 h-3" />
                              Sync Logs
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteDialog({ open: true, id: device.id, name: device.name })}
                          className="gap-1 h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Connection Tips */}
      <Card className="mt-6 border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            Connection Tips
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Ensure the device is connected to the same local network (LAN).</li>
            <li>• For <strong>ZKTeco</strong>, the default port is <strong>4370</strong>. For <strong>Hikvision</strong>, use <strong>8000</strong> or <strong>80</strong>.</li>
            <li>• If the scanner fails, enter the device IP manually and click Test Connection first.</li>
            <li>• Use <strong>Sync Logs</strong> to pull attendance data from a specific device on demand.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Device Dialog */}
      <DeviceDialog
        open={deviceDialog.open}
        editing={deviceDialog.editing}
        branches={branches}
        gates={gates}
        onClose={() => setDeviceDialog({ open: false, editing: null })}
        onSave={async (data) => {
          try {
            if (deviceDialog.editing) {
              await invoke('update_device', { id: deviceDialog.editing.id, device: data });
            } else {
              await invoke('add_device', { device: data });
            }
            setDeviceDialog({ open: false, editing: null });
            loadData();
          } catch (error) {
            console.error('Failed to save device:', error);
          }
        }}
      />

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, id: 0, name: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Confirm Delete
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteDialog.name}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, id: 0, name: '' })}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteDevice}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Device Dialog Component ───────────────────────────────────────────────────

interface DeviceDialogProps {
  open: boolean;
  editing: Device | null;
  branches: Branch[];
  gates: Gate[];
  onClose: () => void;
  onSave: (data: any) => void;
}

const DeviceDialog: React.FC<DeviceDialogProps> = ({ open, editing, branches, gates, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: '',
    brand: 'ZKTeco',
    ip: '',
    port: 4370,
    comm_key: 0,
    machine_number: 1,
    branch_id: 0,
    gate_id: 0,
  });

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        brand: editing.brand,
        ip: editing.ip,
        port: editing.port,
        comm_key: editing.comm_key,
        machine_number: editing.machine_number,
        branch_id: editing.branch_id,
        gate_id: editing.gate_id || 0,
      });
    } else {
      setForm({
        name: '',
        brand: 'ZKTeco',
        ip: '',
        port: 4370,
        comm_key: 0,
        machine_number: 1,
        branch_id: branches[0]?.id || 0,
        gate_id: 0,
      });
    }
  }, [editing, branches]);

  const selectedBranchGates = gates.filter(g => g.branch_id === form.branch_id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.ip.trim() || !form.branch_id) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Device' : 'Add New Device'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Update device configuration' : 'Register a new attendance device'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Device Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Main Entrance"
                required
              />
            </div>
            <div>
              <Label>Brand</Label>
              <select
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="ZKTeco">ZKTeco</option>
                <option value="Hikvision">Hikvision</option>
              </select>
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Branch</Label>
              <select
                value={form.branch_id}
                onChange={(e) => setForm({ ...form, branch_id: Number(e.target.value), gate_id: 0 })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {branches.length === 0 ? (
                  <option value="">No branches available</option>
                ) : (
                  branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <Label>Gate <span className="text-muted-foreground font-normal">(Optional)</span></Label>
              <select
                value={form.gate_id || ''}
                onChange={(e) => setForm({ ...form, gate_id: e.target.value ? Number(e.target.value) : 0 })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">No Gate (Direct Device)</option>
                {selectedBranchGates.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Connection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>IP Address</Label>
              <Input
                value={form.ip}
                onChange={(e) => setForm({ ...form, ip: e.target.value })}
                placeholder="192.168.1.201"
                required
              />
            </div>
            <div>
              <Label>Port</Label>
              <Input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Test Connection Button */}
          {form.ip && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await invoke('test_device_connection', {
                      ip: form.ip,
                      port: form.port,
                      commKey: form.comm_key,
                      machineNumber: form.machine_number,
                      brand: form.brand
                    });
                    alert('✅ Device is online and reachable!');
                  } catch (error) {
                    alert(`❌ Connection failed: ${error}`);
                  }
                }}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                Test Connection
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Verify the device is reachable before saving
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Communication Key</Label>
              <Input
                type="number"
                value={form.comm_key}
                onChange={(e) => setForm({ ...form, comm_key: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Machine Number</Label>
              <Input
                type="number"
                value={form.machine_number}
                onChange={(e) => setForm({ ...form, machine_number: Number(e.target.value) })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">
              {editing ? 'Update' : 'Register Device'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
