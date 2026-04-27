import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '../context/AuthContext';
import { getAccessibleBranchIds, isSuperAdmin } from '@/config/accessPolicy';
import { Building2, DoorOpen, Monitor, Plus, Edit2, Trash2, Eye, Shield, AlertCircle, Download, Upload, Wifi, WifiOff, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { BranchMigrationWizard } from '../components/BranchMigrationWizard';

interface Organization {
  id: number;
  name: string;
  address?: string | null;
  contact_info?: string | null;
  auth_key?: string | null;
  license_expiry?: string | null;
  provider_name?: string | null;
  provider_contact?: string | null;
  payment_term_days?: number | null;
  payment_status?: string | null;
  provider_approved?: boolean;
  notes?: string | null;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface Branch {
  id: number;
  name: string;
  location?: string;
  org_id?: number | null;
  organization_id?: number | null;
  gate_count?: number;
  device_count?: number;
  employee_count?: number;
}

interface Gate {
  id: number;
  branch_id: number;
  name: string;
  device_count?: number;
}

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
  subnet_mask?: string;
  gateway?: string;
  dns?: string;
  dhcp?: boolean;
  server_mode?: string;
  server_address?: string;
  https_enabled?: boolean;
}

type TabType = 'organizations' | 'branches' | 'gates' | 'devices';

// ── Main Component ──────────────────────────────────────────────────────────

export const BranchGateDeviceManagement: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const superAdmin = isSuperAdmin(user?.role);
  const accessibleBranchIds = getAccessibleBranchIds(user);
  const accessibleBranchIdsKey = accessibleBranchIds.join(',');
  const hasBranchScope = superAdmin || accessibleBranchIds.length === 0;
  
  const [activeTab, setActiveTab] = useState<TabType>(superAdmin ? 'organizations' : 'branches');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [selectedGateId, setSelectedGateId] = useState<number | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Dialogs
  const [branchDialog, setBranchDialog] = useState({ open: false, editing: null as Branch | null, preselectOrganizationId: null as number | null });
  const [organizationDialog, setOrganizationDialog] = useState({ open: false, editing: null as Organization | null });
  const [gateDialog, setGateDialog] = useState({ open: false, editing: null as Gate | null, preselectBranch: null as number | null });
  const [deviceDialog, setDeviceDialog] = useState({ 
    open: false, 
    editing: null as Device | null, 
    preselectBranch: null as number | null,
    preselectGate: null as number | null 
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: string; id: number; name: string }>({
    open: false, type: '', id: 0, name: ''
  });
  const [migrationWizard, setMigrationWizard] = useState<{ open: boolean; branch: { id: number; name: string } | null }>({
    open: false, branch: null
  });
  const [organizationPreview, setOrganizationPreview] = useState<{ open: boolean; organization: Organization | null }>({
    open: false,
    organization: null,
  });

  // Sync state
  const [syncingDevices, setSyncingDevices] = useState<Set<number>>(new Set());
  const [syncMessages, setSyncMessages] = useState<Record<number, string>>({});
  const scopedBranches = hasBranchScope
    ? branches
    : branches.filter(branch => accessibleBranchIds.includes(String(branch.id)));
  const scopedOrganizations = superAdmin ? organizations : [];
  const scopedGates = hasBranchScope
    ? gates
    : gates.filter(gate => accessibleBranchIds.includes(String(gate.branch_id)));
  const scopedDevices = hasBranchScope
    ? devices
    : devices.filter(device => accessibleBranchIds.includes(String(device.branch_id)));
  const scopedBranchesByOrganization = selectedOrganizationId
    ? scopedBranches.filter(branch => Number(branch.org_id || branch.organization_id || 0) === selectedOrganizationId)
    : scopedBranches;
  const selectedOrganizationRecord = selectedOrganizationId
    ? scopedOrganizations.find(org => org.id === selectedOrganizationId) || null
    : null;
  const organizationControlLocked = Boolean(selectedOrganizationRecord && (!selectedOrganizationRecord.provider_approved || selectedOrganizationRecord.payment_status !== 'Paid'));
  const organizationControlReason = selectedOrganizationRecord
    ? `${selectedOrganizationRecord.provider_approved ? 'Payment pending' : 'Provider approval pending'}${selectedOrganizationRecord.payment_status === 'Paid' ? '' : ` (${selectedOrganizationRecord.payment_status || 'Pending'})`}`
    : '';

  // Load data
  const loadData = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setLoading(true);
    }
    try {
      const organizationData = await invoke<Organization[]>('list_organizations');
      setOrganizations(superAdmin ? (Array.isArray(organizationData) ? organizationData : []) : []);

      // Load branches with counts
      const branchData = await invoke<any[]>('list_branches');
      const enhancedBranches = await Promise.all(
        branchData.map(async (b: any) => {
          const gates = await invoke<any[]>('list_gates', { branch_id: b.id });
          const allDevices = await invoke<any[]>('list_all_devices');
          const branchDevices = allDevices.filter((d: any) => d.branch_id === b.id);
          const summary = await invoke<any>('get_branch_summary', { id: b.id });
          return {
            ...b,
            gate_count: gates.length,
            device_count: branchDevices.length,
            employee_count: summary?.employee_count ?? 0,
          };
        })
      );
      const visibleBranches = superAdmin
        ? enhancedBranches
        : enhancedBranches.filter((branch: any) => accessibleBranchIds.includes(String(branch.id)));
      setBranches(visibleBranches);

      // Load ALL gates for dropdowns and enhanced views
      const gateData = await invoke<any[]>('list_gates', { branch_id: null });
      const allDevicesForGates = await invoke<any[]>('list_all_devices');
      const enhancedGates = await Promise.all(
        gateData.map(async (g: any) => {
          const gateDevices = allDevicesForGates.filter((d: any) => d.gate_id === g.id);
          return {
            ...g,
            device_count: gateDevices.length,
          };
        })
      );
      setGates(superAdmin ? enhancedGates : enhancedGates.filter((gate: any) => accessibleBranchIds.includes(String(gate.branch_id))));

      // Load all devices
      const deviceData = await invoke<any[]>('list_all_devices');
      setDevices(superAdmin ? deviceData : deviceData.filter((device: any) => accessibleBranchIds.includes(String(device.branch_id))));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }, [superAdmin, accessibleBranchIdsKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const branchParam = new URLSearchParams(location.search).get('branch');
    const branchId = branchParam ? Number(branchParam) : null;
    if (branchId && !Number.isNaN(branchId)) {
      setSelectedBranchId(branchId);
      setActiveTab('branches');
    }
  }, [location.search]);

  useEffect(() => {
    if (!superAdmin && !selectedBranchId && scopedBranches.length > 0) {
      setSelectedBranchId(scopedBranches[0].id);
    }
    if (!superAdmin && activeTab === 'organizations') {
      setActiveTab('branches');
    }
  }, [superAdmin, selectedBranchId, scopedBranches, activeTab]);

  useEffect(() => {
    if (selectedBranchId && !scopedBranches.some((b) => b.id === selectedBranchId)) {
      setSelectedBranchId(null);
    }
  }, [selectedBranchId, scopedBranches]);

  // Branch handlers
  const handleAddOrganization = () => {
    setOrganizationDialog({ open: true, editing: null });
  };

  const handleEditOrganization = (organization: Organization) => {
    setOrganizationDialog({ open: true, editing: organization });
  };

  const handlePreviewOrganization = (organization: Organization) => {
    setOrganizationPreview({ open: true, organization });
  };

  const handleControlOrganization = async (
    organization: Organization,
    patch: Partial<Organization> & { license_expiry?: string | null }
  ) => {
    try {
      await invoke('update_organization', {
        id: organization.id,
        name: organization.name,
        address: organization.address || null,
        contact_info: organization.contact_info || null,
        auth_key: organization.auth_key || null,
        license_expiry: patch.license_expiry ?? organization.license_expiry ?? null,
        provider_name: patch.provider_name ?? organization.provider_name ?? null,
        provider_contact: patch.provider_contact ?? organization.provider_contact ?? null,
        payment_term_days: patch.payment_term_days ?? organization.payment_term_days ?? null,
        payment_status: patch.payment_status ?? organization.payment_status ?? null,
        provider_approved: patch.provider_approved ?? organization.provider_approved ?? false,
        notes: patch.notes ?? organization.notes ?? null,
      });
      await loadData({ silent: true });
      window.dispatchEvent(new CustomEvent('data-synced', { detail: { table: 'organizations' } }));
      setOrganizationPreview(prev => prev.organization?.id === organization.id
        ? { open: true, organization: null }
        : prev
      );
      setOrganizationPreview({ open: false, organization: null });
      setTimeout(() => setOrganizationPreview({ open: true, organization }), 0);
    } catch (error) {
      console.error('Failed to update organization control:', error);
      alert('Failed to update organization: ' + error);
    }
  };

  const handleViewOrganizationBranches = (organization: Organization) => {
    setSelectedOrganizationId(organization.id);
    setSelectedBranchId(null);
    setSelectedGateId(null);
    setActiveTab('branches');
    setOrganizationPreview({ open: false, organization: null });
  };

  const handleClearOrganizationFilter = () => {
    setSelectedOrganizationId(null);
  };

  const handleDeleteOrganization = async (id: number) => {
    if (!confirm('Delete this organization? This should only be used when the organization is empty.')) return;
    try {
      await invoke('delete_organization', { id });
      await loadData({ silent: true });
      window.dispatchEvent(new CustomEvent('data-synced', { detail: { table: 'organizations' } }));
    } catch (error) {
      console.error('Failed to delete organization:', error);
      alert('Delete failed: ' + error);
    }
  };

  const handleAddBranch = () => {
    setBranchDialog({ open: true, editing: null, preselectOrganizationId: null });
  };

  const handleAddBranchForOrganization = (organizationId: number) => {
    setSelectedOrganizationId(organizationId);
    setBranchDialog({ open: true, editing: null, preselectOrganizationId: organizationId });
  };

  const handleEditBranch = (branch: Branch) => {
    setBranchDialog({
      open: true,
      editing: branch,
      preselectOrganizationId: Number(branch.org_id || branch.organization_id || selectedOrganizationId || 1),
    });
  };

  const handleDeleteBranch = async () => {
    const branchId = deleteDialog.id;
    setDeleteDialog({ open: false, type: '', id: 0, name: '' });
    try {
      await invoke('delete_branch', { id: branchId });
      await loadData({ silent: true });
      window.dispatchEvent(new CustomEvent('data-synced', { detail: { table: 'branches' } }));
    } catch (error) {
      console.error('Failed to delete branch:', error);
      alert('Delete failed: ' + error);
    }
  };

  // Gate handlers
  const handleAddGate = (branchId?: number | any) => {
    // Safety: ignore if it's a React/DOM event
    const validId = (typeof branchId === 'number' && branchId > 0) ? branchId : null;
    setGateDialog({ open: true, editing: null, preselectBranch: validId || selectedBranchId });
  };

  const handleEditGate = (gate: Gate) => {
    setGateDialog({ open: true, editing: gate, preselectBranch: null });
  };

  const handleDeleteGate = async () => {
    const gateId = deleteDialog.id;
    setDeleteDialog({ open: false, type: '', id: 0, name: '' });
    try {
      await invoke('delete_gate', { id: gateId });
      await loadData({ silent: true });
    } catch (error) {
      console.error('Failed to delete gate:', error);
      alert('Delete failed: ' + error);
    }
  };

  // Device handlers
  const handleAddDevice = (branchId?: number | any, gateId?: number | any) => {
    // Safety: ignore if it's a React/DOM event
    const bId = (typeof branchId === 'number' && branchId > 0) ? branchId : null;
    const gId = (typeof gateId === 'number' && gateId > 0) ? gateId : null;
    
    setDeviceDialog({ 
      open: true, 
      editing: null, 
      preselectBranch: bId || selectedBranchId,
      preselectGate: gId || selectedGateId
    });
  };

  const handleEditDevice = (device: Device) => {
    setDeviceDialog({ 
      open: true, 
      editing: device, 
      preselectBranch: null, 
      preselectGate: null 
    });
  };

  const handleDeleteDevice = async () => {
    const deviceId = deleteDialog.id;
    setDeleteDialog({ open: false, type: '', id: 0, name: '' });
    try {
      await invoke('delete_device', { id: deviceId });
      await loadData({ silent: true });
    } catch (error) {
      console.error('Failed to delete device:', error);
      alert('Delete failed: ' + error);
    }
  };

  const handleSetDefaultDevice = async (deviceId: number) => {
    try {
      await invoke('set_default_device', { id: deviceId });
      loadData({ silent: true });
    } catch (error) {
      console.error('Failed to set default device:', error);
    }
  };

  const handleSyncDeviceLogs = async (device: Device) => {
    setSyncingDevices(prev => new Set(prev).add(device.id));
    setSyncMessages(prev => ({ ...prev, [device.id]: '🔄 Syncing logs...' }));

    try {
      const result = await invoke('sync_device_logs', {
        ip: device.ip,
        port: device.port,
        deviceId: device.id,
        brand: device.brand,
        target_branch_id: Number(device.branch_id) || 1,
        target_gate_id: Number(device.gate_id) || 1,
      });
      setSyncMessages(prev => ({ ...prev, [device.id]: `✅ ${result}` }));
      
      // Notify other components (like EmployeeManagement) that new data is available
      window.dispatchEvent(new CustomEvent('data-synced', { detail: { table: 'employees' } }));
      
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

  const handleSyncToDevice = async (device: Device) => {
    setSyncingDevices(prev => new Set(prev).add(device.id));
    setSyncMessages(prev => ({ ...prev, [device.id]: '🔄 Syncing employees to device...' }));

    try {
      const result = await invoke<any>('sync_employees_to_device', {
        deviceId: device.id,
      });
      
      if (result.success) {
        setSyncMessages(prev => ({ 
          ...prev, 
          [device.id]: `✅ Synced to device: ${result.synced} employees ready, ${result.failed} failed` 
        }));
      } else {
        setSyncMessages(prev => ({ ...prev, [device.id]: `❌ Sync failed: ${result.error}` }));
      }
      
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

  const testDeviceConnection = async (device: Device) => {
    try {
      await invoke('test_device_connection', {
        ip: device.ip,
        port: device.port,
        commKey: device.comm_key,
        machineNumber: device.machine_number,
        brand: device.brand
      });
      
      // Update device status to online in database
      await invoke('update_device_status', {
        ip: device.ip,
        status: 'online'
      });
      
      // Update device status to online in UI
      setDevices(prev => prev.map(d =>
        d.id === device.id ? { ...d, status: 'online' } : d
      ));
    } catch (error) {
      // Update device status to offline in database
      await invoke('update_device_status', {
        ip: device.ip,
        status: 'offline'
      }).catch(() => {}); // Ignore errors on status update
      
      // Update device status to offline in UI
      setDevices(prev => prev.map(d =>
        d.id === device.id ? { ...d, status: 'offline' } : d
      ));
      throw error;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Organization Structure</h1>
        <p className="text-muted-foreground">
          Manage branches, gates, and devices hierarchically
          {superAdmin && (
            <span className="ml-2 inline-flex items-center gap-1 text-primary">
              <Shield className="w-4 h-4" />
              Super Admin View
            </span>
          )}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-border">
        <TabButton
          icon={<Shield className="w-4 h-4" />}
          label="Organizations"
          active={activeTab === 'organizations'}
          onClick={() => setActiveTab('organizations')}
        />
        <TabButton
          icon={<Building2 className="w-4 h-4" />}
          label="Branches"
          active={activeTab === 'branches'}
          onClick={() => setActiveTab('branches')}
        />
        <TabButton
          icon={<DoorOpen className="w-4 h-4" />}
          label="Gates"
          active={activeTab === 'gates'}
          disabled={!selectedBranchId}
          onClick={() => setActiveTab('gates')}
        />
        <TabButton
          icon={<Monitor className="w-4 h-4" />}
          label="Devices"
          active={activeTab === 'devices'}
          disabled={!selectedBranchId}
          onClick={() => setActiveTab('devices')}
        />
      </div>

      {/* Branch Filter */}
      {activeTab !== 'organizations' && (
        <div className="mb-6 p-4 bg-card border border-border rounded-lg">
          <div className="grid gap-4 md:grid-cols-2">
            {superAdmin && scopedOrganizations.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Select Organization</Label>
                <select
                  value={selectedOrganizationId || ''}
                  onChange={(e) => {
                    const nextOrgId = e.target.value ? Number(e.target.value) : null;
                    setSelectedOrganizationId(nextOrgId);
                    setSelectedBranchId(null);
                    setSelectedGateId(null);
                  }}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">All Organizations</option>
                  {scopedOrganizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className={superAdmin && scopedOrganizations.length > 0 ? '' : 'md:col-span-2'}>
              <Label className="text-sm font-medium mb-2 block">Select Branch</Label>
              <select
                value={selectedBranchId || ''}
                onChange={(e) => {
                  const nextBranchId = e.target.value ? Number(e.target.value) : null;
                  setSelectedBranchId(nextBranchId);
                  setSelectedGateId(null);
                  if (nextBranchId) {
                    const matchedBranch = scopedBranches.find(b => b.id === nextBranchId);
                    const matchedOrgId = Number(matchedBranch?.org_id || matchedBranch?.organization_id || 0) || null;
                    setSelectedOrganizationId(matchedOrgId);
                  }
                }}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">All Branches</option>
                {(selectedOrganizationId
                  ? scopedBranches.filter(b => Number(b.org_id || b.organization_id || 0) === selectedOrganizationId)
                  : scopedBranches
                ).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'organizations' && superAdmin && (
        <OrganizationsTab
          organizations={scopedOrganizations}
          branches={scopedBranches}
          onAdd={handleAddOrganization}
          onPreview={handlePreviewOrganization}
          onEdit={handleEditOrganization}
          onDelete={handleDeleteOrganization}
          loading={loading}
        />
      )}

      {activeTab === 'branches' && (
        <>
          {organizationControlLocked && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-semibold">Organization control pending</div>
              <div>{organizationControlReason}. Branch/device creation is locked until this organization is approved and marked Paid.</div>
            </div>
          )}
          <BranchesTab
            branches={scopedBranchesByOrganization}
            gates={scopedGates}
            devices={scopedDevices}
            onAdd={handleAddBranch}
            onEdit={handleEditBranch}
            onDelete={(id, name) => setMigrationWizard({ open: true, branch: { id, name } })}
            onSelect={(id) => {
              setSelectedBranchId(id);
              setActiveTab('gates');
            }}
            onAddDevice={(branchId) => handleAddDevice(branchId)}
            organizationFilterLabel={selectedOrganizationId ? (selectedOrganizationRecord?.name || '') : ''}
            onClearOrganizationFilter={handleClearOrganizationFilter}
            loading={loading}
            addDisabled={organizationControlLocked}
          />
        </>
      )}

      {activeTab === 'gates' && (
        <GatesTab
          gates={selectedBranchId ? scopedGates.filter(g => g.branch_id === selectedBranchId) : scopedGates}
          branches={scopedBranches}
          branchName={selectedBranchId ? (scopedBranches.find(b => b.id === selectedBranchId)?.name || '') : 'All Branches'}
          onAdd={() => handleAddGate()}
          onEdit={handleEditGate}
          onDelete={(id, name) => setDeleteDialog({ open: true, type: 'gate', id, name })}
          onSelect={(id) => {
            setSelectedGateId(id);
            setActiveTab('devices');
          }}
          loading={loading}
        />
      )}

      {activeTab === 'devices' && (
        <DevicesTab
          devices={scopedDevices.filter(d => {
            if (selectedBranchId && d.branch_id !== selectedBranchId) return false;
            if (selectedGateId && d.gate_id !== selectedGateId) return false;
            return true;
          })}
          branches={scopedBranches}
          gates={scopedGates}
          onAdd={() => handleAddDevice()}
          onEdit={handleEditDevice}
          onDelete={(id, name) => setDeleteDialog({ open: true, type: 'device', id, name })}
          onSetDefault={handleSetDefaultDevice}
          onSync={handleSyncDeviceLogs}
          onSyncToDevice={handleSyncToDevice}
          onTest={testDeviceConnection}
          loading={loading}
          syncingDevices={syncingDevices}
          syncMessages={syncMessages}
        />
      )}

      {/* Dialogs */}
      <OrganizationDialog
        open={organizationDialog.open}
        editing={organizationDialog.editing}
        onClose={() => setOrganizationDialog({ open: false, editing: null })}
        onSave={async (data) => {
          try {
            if (organizationDialog.editing) {
              await invoke('update_organization', {
                id: organizationDialog.editing.id,
                name: data.name,
                address: data.address || null,
                contact_info: data.contact_info || null,
                auth_key: data.auth_key || null,
                license_expiry: data.license_expiry || null,
                provider_name: data.provider_name || null,
                provider_contact: data.provider_contact || null,
                payment_term_days: data.payment_term_days ? Number(data.payment_term_days) : null,
                payment_status: data.payment_status || null,
                provider_approved: data.provider_approved,
                notes: data.notes || null,
              });
            } else {
              await invoke('add_organization', {
                name: data.name,
                address: data.address || null,
                contact_info: data.contact_info || null,
                auth_key: data.auth_key || null,
                license_expiry: data.license_expiry || null,
                provider_name: data.provider_name || null,
                provider_contact: data.provider_contact || null,
                payment_term_days: data.payment_term_days ? Number(data.payment_term_days) : null,
                payment_status: data.payment_status || null,
                provider_approved: data.provider_approved,
                notes: data.notes || null,
              });
            }
            setOrganizationDialog({ open: false, editing: null });
            loadData({ silent: true });
            window.dispatchEvent(new CustomEvent('data-synced', { detail: { table: 'organizations' } }));
          } catch (error) {
            console.error('Failed to save organization:', error);
            alert('Failed to save organization: ' + error);
          }
        }}
      />

      <OrganizationPreviewDialog
        open={organizationPreview.open}
        organization={organizationPreview.organization}
        branches={scopedBranches.filter(branch => Number(branch.org_id || branch.organization_id || 0) === organizationPreview.organization?.id)}
        onClose={() => setOrganizationPreview({ open: false, organization: null })}
        onEdit={(organization) => {
          setOrganizationPreview({ open: false, organization: null });
          handleEditOrganization(organization);
        }}
        onAddBranch={handleAddBranchForOrganization}
        onViewBranches={handleViewOrganizationBranches}
        onEditBranch={handleEditBranch}
        onControlSave={handleControlOrganization}
      />

      <BranchDialog
        open={branchDialog.open}
        editing={branchDialog.editing}
        organizations={scopedOrganizations}
        preselectOrganizationId={branchDialog.preselectOrganizationId}
        gates={scopedGates}
        devices={scopedDevices}
        onClose={() => setBranchDialog({ open: false, editing: null, preselectOrganizationId: null })}
        onSave={async (data) => {
          try {
            if (branchDialog.editing) {
              await invoke('update_branch', { 
                id: branchDialog.editing.id, 
                name: data.name, 
                location: data.location,
                organization_id: data.organizationId
              });
              setBranches(prev => prev.map(branch => branch.id === branchDialog.editing?.id
                ? {
                    ...branch,
                    name: data.name,
                    location: data.location,
                    org_id: data.organizationId,
                    organization_id: data.organizationId,
                  }
                : branch
              ));
            } else {
              const result = await invoke<{ success: boolean; id: number }>('add_branch', { 
                name: data.name, 
                location: data.location,
                organization_id: data.organizationId
              });
              const newBranch = {
                id: result?.id || Date.now(),
                name: data.name,
                location: data.location,
                org_id: data.organizationId,
                organization_id: data.organizationId,
                gate_count: 0,
                device_count: 0,
                employee_count: 0,
              };
              setBranches(prev => [...prev, newBranch].sort((a, b) => String(a.name).localeCompare(String(b.name))));
            }
            setBranchDialog({ open: false, editing: null, preselectOrganizationId: null });
            loadData({ silent: true });
            window.dispatchEvent(new CustomEvent('data-synced', { detail: { table: 'branches' } }));
          } catch (error) {
            console.error('Failed to save branch:', error);
          }
        }}
        onAddGate={handleAddGate}
        onEditGate={handleEditGate}
        onDeleteGate={(id, name) => setDeleteDialog({ open: true, type: 'gate', id, name })}
        onAddDevice={handleAddDevice}
        onEditDevice={handleEditDevice}
        onDeleteDevice={(id, name) => setDeleteDialog({ open: true, type: 'device', id, name })}
      />

      <GateDialog
        open={gateDialog.open}
        editing={gateDialog.editing}
        preselectBranch={gateDialog.preselectBranch}
        branchId={selectedBranchId || 0}
        branches={scopedBranches}
        onClose={() => setGateDialog({ open: false, editing: null, preselectBranch: null })}
        onSave={async (data) => {
          try {
            if (gateDialog.editing) {
              await invoke('update_gate', { 
                id: gateDialog.editing.id, 
                branch_id: data.branchId, 
                name: data.name 
              });
            } else {
              await invoke('add_gate', { 
                branch_id: data.branchId, 
                name: data.name 
              });
            }
            setGateDialog({ open: false, editing: null, preselectBranch: null });
            loadData({ silent: true });
          } catch (error) {
            console.error('Failed to save gate:', error);
            alert('Failed to save gate: ' + error);
          }
        }}
      />

      <DeviceDialog
        open={deviceDialog.open}
        editing={deviceDialog.editing}
        preselectBranch={deviceDialog.preselectBranch}
        preselectGate={deviceDialog.preselectGate}
        branches={scopedBranches}
        gates={scopedGates}
        onClose={() => setDeviceDialog({ open: false, editing: null, preselectBranch: null, preselectGate: null })}
        onSave={async (data) => {
          try {
            if (deviceDialog.editing) {
              await invoke('update_device', { id: deviceDialog.editing.id, device: data });
            } else {
              await invoke('register_new_device', { device: data });
            }
            setDeviceDialog({ open: false, editing: null, preselectBranch: null, preselectGate: null });
            loadData({ silent: true });
          } catch (error) {
            console.error('Failed to save device:', error);
          }
        }}
      />

      <DeleteConfirmDialog
        open={deleteDialog.open}
        type={deleteDialog.type}
        name={deleteDialog.name}
        onCancel={() => setDeleteDialog({ open: false, type: '', id: 0, name: '' })}
        onConfirm={
          deleteDialog.type === 'gate' ? handleDeleteGate :
          handleDeleteDevice
        }
      />

      <BranchMigrationWizard
        open={migrationWizard.open}
        branch={migrationWizard.branch}
        branches={branches}
        onClose={() => setMigrationWizard({ open: false, branch: null })}
        onDeleted={() => { setMigrationWizard({ open: false, branch: null }); loadData({ silent: true }); }}
      />
    </div>
  );
};

// ── Tab Button Component ────────────────────────────────────────────────────

const TabButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}> = ({ icon, label, active, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? 'border-primary text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    {icon}
    {label}
  </button>
);

// ── Branches Tab ────────────────────────────────────────────────────────────

const OrganizationsTab: React.FC<{
  organizations: Organization[];
  branches: Branch[];
  onAdd: () => void;
  onPreview: (organization: Organization) => void;
  onEdit: (organization: Organization) => void;
  onDelete: (id: number) => void;
  loading: boolean;
}> = ({ organizations, branches, onAdd, onPreview, onEdit, onDelete, loading }) => (
  <div>
    <div className="flex justify-between items-center mb-4">
      <div>
        <h2 className="text-xl font-semibold">Organization</h2>
        <p className="text-sm text-muted-foreground">Define the company container before arranging branches and gates.</p>
      </div>
      <Button onClick={onAdd}>
        <Plus className="w-4 h-4 mr-2" />
        Add Organization
      </Button>
    </div>

    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
              </TableRow>
            ) : organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No organization found. Create one to start structuring the company.
                </TableCell>
              </TableRow>
            ) : (
              organizations.map(org => {
                const branchCount = branches.filter(b => Number(b.org_id || b.organization_id || 1) === org.id).length;
                return (
                  <TableRow key={org.id} className="cursor-pointer" onClick={() => onPreview(org)}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="text-muted-foreground">{org.address || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{branchCount}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{org.contact_info || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => onPreview(org)} title="Preview Organization">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(org)} title="Edit Organization">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(org.id)} title="Delete Organization">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
);

const BranchesTab: React.FC<{
  branches: Branch[];
  gates: Gate[];
  devices: Device[];
  onAdd: () => void;
  onEdit: (branch: Branch) => void;
  onDelete: (id: number, name: string) => void;
  onSelect: (id: number) => void;
  onAddDevice: (branchId: number) => void;
  organizationFilterLabel?: string;
  onClearOrganizationFilter?: () => void;
  addDisabled?: boolean;
  loading: boolean;
}> = ({ branches, gates: _gates, devices: _devices, onAdd, onEdit, onDelete, onSelect, onAddDevice, organizationFilterLabel, onClearOrganizationFilter, addDisabled, loading }) => (
  <div>
    <div className="flex justify-between items-center mb-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Branches</h2>
        {organizationFilterLabel ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Filtered by: {organizationFilterLabel}
            </Badge>
            {onClearOrganizationFilter && (
              <Button variant="ghost" size="sm" onClick={onClearOrganizationFilter}>
                Clear Filter
              </Button>
            )}
          </div>
        ) : null}
      </div>
      <Button onClick={() => onAdd()} disabled={addDisabled}>
        <Plus className="w-4 h-4 mr-2" />
        Add Branch
      </Button>
    </div>

    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Gates</TableHead>
              <TableHead>Devices</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
              </TableRow>
            ) : branches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No branches found. Add your first branch to get started.
                </TableCell>
              </TableRow>
            ) : (
              branches.map(branch => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell className="text-muted-foreground">{branch.location || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{branch.gate_count || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{branch.device_count || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(branch)} title="Edit Branch">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(branch.id, branch.name)} title="Delete Branch">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onAddDevice(branch.id)} title="Add Device" disabled={addDisabled}>
                        <Plus className="w-4 h-4 mr-2" />
                        Device
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onSelect(branch.id)} title="Manage Gates & Devices">
                        <Eye className="w-4 h-4 mr-2" />
                        Manage
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
  </div>
);

// ── Gates Tab ───────────────────────────────────────────────────────────────

const GatesTab: React.FC<{
  gates: Gate[];
  branches: any[];
  branchName: string;
  onAdd: () => void;
  onEdit: (gate: Gate) => void;
  onDelete: (id: number, name: string) => void;
  onSelect: (id: number) => void;
  loading: boolean;
}> = ({ gates, branches, branchName, onAdd, onEdit, onDelete, onSelect, loading }) => (
  <div>
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-semibold">
        Gates — {branchName}
      </h2>
      <Button onClick={onAdd}>
        <Plus className="w-4 h-4 mr-2" />
        Add Gate
      </Button>
    </div>

    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gate Name</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Devices</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">Loading...</TableCell>
              </TableRow>
            ) : gates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No gates found for this branch.
                </TableCell>
              </TableRow>
            ) : (
              gates.map(gate => {
                const gateBranchName = branches.find((b: any) => b.id === gate.branch_id)?.name || branchName;
                return (
                  <TableRow key={gate.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(gate.id)}>
                    <TableCell className="font-medium">{gate.name}</TableCell>
                    <TableCell className="text-muted-foreground">{gateBranchName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{gate.device_count || 0}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit(gate); }}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(gate.id, gate.name); }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
);

// ── Devices Tab - Clean Table Design with Inline Sync ──────────────────────

const DevicesTab: React.FC<{
  devices: Device[];
  branches: Branch[];
  gates: Gate[];
  onAdd: () => void;
  onEdit: (device: Device) => void;
  onDelete: (id: number, name: string) => void;
  onSetDefault: (id: number) => void;
  onSync: (device: Device) => void;
  onSyncToDevice: (device: Device) => void;
  onTest: (device: Device) => void;
  loading: boolean;
  syncingDevices: Set<number>;
  syncMessages: Record<number, string>;
}> = ({ devices, onAdd, onEdit, onDelete, onSync, onSyncToDevice, loading, syncingDevices, syncMessages }) => (
  <div>
    <div className="flex justify-between items-center mb-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Device Management</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage biometric hardware (ZKTeco / Hikvision) for attendance synchronization.
        </p>
      </div>
      <Button onClick={onAdd} className="gap-2">
        <Plus className="w-4 h-4" />
        Add Device
      </Button>
    </div>

    {/* Sync Messages */}
    {Object.entries(syncMessages).map(([deviceId, message]) => (
      <div
        key={deviceId}
        className={`mb-4 p-3 rounded-md border ${
          message.includes('✅') ? 'bg-green-50 border-green-200 text-green-700' :
          message.includes('❌') ? 'bg-red-50 border-red-200 text-red-700' :
          'bg-blue-50 border-blue-200 text-blue-700'
        }`}
      >
        {message}
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
                <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
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
                      <div className="font-semibold">{device.name}</div>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(device)}
                        className="gap-1 h-8"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSyncToDevice(device)}
                        disabled={syncingDevices.has(device.id)}
                        className="gap-1 h-8 bg-blue-50 hover:bg-blue-100 border-blue-200"
                      >
                        <Upload className="w-3 h-3" />
                        Sync to Device
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSync(device)}
                        disabled={syncingDevices.has(device.id)}
                        className="gap-1 h-8"
                      >
                        {syncingDevices.has(device.id) ? (
                          <>
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
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
                        onClick={() => onDelete(device.id, device.name)}
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
  </div>
);

// ── Enhanced Branch Dialog with Gates & Devices ────────────────────────────

const BranchDialog: React.FC<{
  open: boolean;
  editing: Branch | null;
  organizations: Organization[];
  preselectOrganizationId?: number | null;
  gates: Gate[];
  devices: Device[];
  onClose: () => void;
  onSave: (data: { name: string; location: string; organizationId: number }) => void;
  onAddGate: (branchId?: number) => void;
  onEditGate: (gate: Gate) => void;
  onDeleteGate: (id: number, name: string) => void;
  onAddDevice: (branchId?: number) => void;
  onEditDevice: (device: Device) => void;
  onDeleteDevice: (id: number, name: string) => void;
}> = ({ open, editing, organizations, preselectOrganizationId, gates, devices, onClose, onSave, onAddGate, onEditGate, onDeleteGate, onAddDevice, onEditDevice, onDeleteDevice }) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [organizationId, setOrganizationId] = useState<number>(organizations[0]?.id || 1);
  const [dialogTab, setDialogTab] = useState<'details' | 'gates' | 'devices'>('details');

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setLocation(editing.location || '');
      setOrganizationId(Number(editing.org_id || editing.organization_id || organizations[0]?.id || 1));
    } else {
      setName('');
      setLocation('');
      setOrganizationId(preselectOrganizationId || organizations[0]?.id || 1);
    }
    setDialogTab('details');
  }, [editing, organizations, open, preselectOrganizationId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, location, organizationId });
  };

  const branchGates = editing ? gates.filter(g => g.branch_id === editing.id) : [];
  const branchDevices = editing ? devices.filter(d => d.branch_id === editing?.id) : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Branch' : 'Add New Branch'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Manage branch details, gates, and devices' : 'Create a new branch for your organization'}
          </DialogDescription>
        </DialogHeader>

        {editing && (
          <div className="flex gap-2 border-b border-border pb-2">
            <TabButton
              icon={<Building2 className="w-4 h-4" />}
              label="Branch Details"
              active={dialogTab === 'details'}
              onClick={() => setDialogTab('details')}
            />
            <TabButton
              icon={<DoorOpen className="w-4 h-4" />}
              label={`Gates (${branchGates.length})`}
              active={dialogTab === 'gates'}
              onClick={() => setDialogTab('gates')}
            />
            <TabButton
              icon={<Monitor className="w-4 h-4" />}
              label={`Devices (${branchDevices.length})`}
              active={dialogTab === 'devices'}
              onClick={() => setDialogTab('devices')}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {dialogTab === 'details' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Branch Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Kathmandu Office"
                  required
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., New Road, Kathmandu"
                />
              </div>
              <div>
                <Label>Organization</Label>
                <select
                  value={organizationId}
                  onChange={(e) => setOrganizationId(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit">
                  {editing ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          )}

          {dialogTab === 'gates' && editing && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold">Gates for {editing.name}</h3>
                <Button size="sm" onClick={() => onAddGate(editing?.id)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Gate
                </Button>
              </div>
              {branchGates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DoorOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No gates added yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {branchGates.map(gate => (
                    <div key={gate.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <DoorOpen className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{gate.name}</p>
                          <p className="text-xs text-muted-foreground">{gate.device_count || 0} devices</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditGate(gate)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDeleteGate(gate.id, gate.name)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {dialogTab === 'devices' && editing && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold">Devices for {editing.name}</h3>
                <Button size="sm" onClick={() => onAddDevice(editing.id)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Device
                </Button>
              </div>
              {branchDevices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No devices added yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {branchDevices.map(device => (
                    <div key={device.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Monitor className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{device.name}</p>
                          <p className="text-xs text-muted-foreground">{device.brand} • {device.ip}:{device.port}</p>
                          {device.gate_name && <p className="text-xs text-muted-foreground">Gate: {device.gate_name}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditDevice(device)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDeleteDevice(device.id, device.name)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                Tip: You can also manage devices from the Devices tab for a full view of all devices across branches.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Gate Dialog ─────────────────────────────────────────────────────────────

const OrganizationDialog: React.FC<{
  open: boolean;
  editing: Organization | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    address: string;
    contact_info: string;
    auth_key: string;
    license_expiry: string;
    provider_name: string;
    provider_contact: string;
    payment_term_days: string;
    payment_status: string;
    provider_approved: boolean;
    notes: string;
  }) => void;
}> = ({ open, editing, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [authKey, setAuthKey] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [providerName, setProviderName] = useState('');
  const [providerContact, setProviderContact] = useState('');
  const [paymentTermDays, setPaymentTermDays] = useState('30');
  const [paymentStatus, setPaymentStatus] = useState('Pending');
  const [providerApproved, setProviderApproved] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editing) {
      setName(editing.name || '');
      setAddress(editing.address || '');
      setContactInfo(editing.contact_info || '');
      setAuthKey(editing.auth_key || '');
      setLicenseExpiry(editing.license_expiry || '');
      setProviderName(editing.provider_name || '');
      setProviderContact(editing.provider_contact || '');
      setPaymentTermDays(String(editing.payment_term_days ?? 30));
      setPaymentStatus(editing.payment_status || 'Pending');
      setProviderApproved(Boolean(editing.provider_approved));
      setNotes(editing.notes || '');
    } else {
      setName('');
      setAddress('');
      setContactInfo('');
      setAuthKey('');
      setLicenseExpiry('');
      setProviderName('');
      setProviderContact('');
      setPaymentTermDays('30');
      setPaymentStatus('Pending');
      setProviderApproved(false);
      setNotes('');
    }
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Organization' : 'Create Organization'}</DialogTitle>
          <DialogDescription>
            Keep the company container clean before adding branches and gates.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              name,
              address,
              contact_info: contactInfo,
              auth_key: authKey,
              license_expiry: licenseExpiry,
              provider_name: providerName,
              provider_contact: providerContact,
              payment_term_days: paymentTermDays,
              payment_status: paymentStatus,
              provider_approved: providerApproved,
              notes,
            });
          }}
          className="space-y-4"
        >
          <div>
            <Label>Organization Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., BioBridge Pro HR"
              required
            />
          </div>
          <div>
            <Label>Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., Kathmandu, Nepal"
            />
          </div>
          <div>
            <Label>Contact Info</Label>
            <Input
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Phone or email"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Provider Name</Label>
              <Input
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="Software provider"
              />
            </div>
            <div>
              <Label>Provider Contact</Label>
              <Input
                value={providerContact}
                onChange={(e) => setProviderContact(e.target.value)}
                placeholder="Provider phone/email"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Payment Term (Days)</Label>
              <Input
                type="number"
                min="0"
                value={paymentTermDays}
                onChange={(e) => setPaymentTermDays(e.target.value)}
              />
            </div>
            <div>
              <Label>Payment Status</Label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Auth Key</Label>
            <Input
              value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
              placeholder="Optional auth key"
            />
          </div>
          <div>
            <Label>License Expiry</Label>
            <Input
              type="date"
              value={licenseExpiry}
              onChange={(e) => setLicenseExpiry(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="block">Provider Approved</Label>
              <p className="text-xs text-muted-foreground">Enable this after provider permission is received.</p>
            </div>
            <input
              type="checkbox"
              checked={providerApproved}
              onChange={(e) => setProviderApproved(e.target.checked)}
              className="h-4 w-4"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              placeholder="Payment terms, activation notes, contract remarks..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const OrganizationPreviewDialog: React.FC<{
  open: boolean;
  organization: Organization | null;
  branches: Branch[];
  onClose: () => void;
  onEdit: (organization: Organization) => void;
  onAddBranch: (organizationId: number) => void;
  onViewBranches: (organization: Organization) => void;
  onEditBranch: (branch: Branch) => void;
  onControlSave: (organization: Organization, patch: Partial<Organization> & { license_expiry?: string | null }) => void;
}> = ({ open, organization, branches, onClose, onEdit, onAddBranch, onViewBranches, onEditBranch, onControlSave }) => {
  if (!organization) return null;
  const [grantDays, setGrantDays] = useState(String(organization.payment_term_days ?? 30));

  useEffect(() => {
    setGrantDays(String(organization.payment_term_days ?? 30));
  }, [organization.id, organization.payment_term_days, open]);

  const addDays = (days: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + days);
    return dt.toISOString().split('T')[0];
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {organization.name}
          </DialogTitle>
          <DialogDescription>
            Preview the organization profile and jump to its branches.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Organization</p>
                <p className="font-semibold">{organization.name}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Address</p>
                <p className="text-sm">{organization.address || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Contact</p>
                <p className="text-sm">{organization.contact_info || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">License Expiry</p>
                <p className="text-sm">{organization.license_expiry || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Provider</p>
                <p className="text-sm">{organization.provider_name || '—'}</p>
                <p className="text-xs text-muted-foreground">{organization.provider_contact || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Auth Key</p>
                <p className="text-sm break-all">{organization.auth_key || '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={organization.provider_approved ? 'default' : 'outline'}>
                  {organization.provider_approved ? 'Provider Approved' : 'Provider Pending'}
                </Badge>
                <Badge variant={organization.payment_status === 'Paid' ? 'default' : 'secondary'}>
                  {organization.payment_status || 'Pending'}
                </Badge>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Payment Term</p>
                <p className="text-sm">{organization.payment_term_days ? `${organization.payment_term_days} days` : '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Notes</p>
                <p className="text-sm whitespace-pre-line">{organization.notes || '—'}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase text-amber-700 font-semibold">Control Panel</p>
                    <p className="text-xs text-amber-700">Approve provider and set active permission duration.</p>
                  </div>
                  <Badge variant={organization.provider_approved ? 'default' : 'outline'}>
                    {organization.provider_approved ? 'Approved' : 'Pending'}
                  </Badge>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">Grant Days</Label>
                    <Input
                      type="number"
                      min="1"
                      value={grantDays}
                      onChange={(e) => setGrantDays(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        const days = Math.max(1, Number(grantDays) || 30);
                        onControlSave(organization, {
                          provider_approved: true,
                          payment_status: 'Paid',
                          payment_term_days: days,
                          license_expiry: addDays(days),
                        });
                      }}
                    >
                      Approve + Activate
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const days = Math.max(1, Number(grantDays) || 30);
                      onControlSave(organization, {
                        provider_approved: true,
                        payment_status: organization.payment_status === 'Paid' ? 'Paid' : 'Partial',
                        payment_term_days: days,
                        license_expiry: addDays(days),
                      });
                    }}
                  >
                    Approve Provider
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const days = Math.max(1, Number(grantDays) || 30);
                      onControlSave(organization, {
                        payment_term_days: days,
                        payment_status: organization.payment_status || 'Pending',
                        license_expiry: addDays(days),
                      });
                    }}
                  >
                    Set Period
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase text-muted-foreground">Branches</p>
                <Badge variant="secondary">{branches.length}</Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onAddBranch(organization.id)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Branch
                </Button>
                <Button variant="outline" size="sm" onClick={() => onViewBranches(organization)}>
                  View All Branches
                </Button>
              </div>
              <div className="max-h-56 overflow-auto space-y-2">
                {branches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No branches linked to this organization yet.</p>
                ) : (
                  branches.map(branch => (
                    <div key={branch.id} className="rounded-md border p-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{branch.name}</div>
                        <div className="text-xs text-muted-foreground">{branch.location || '—'}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => onEditBranch(branch)}>
                        Edit
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const days = Math.max(1, Number(grantDays) || 30);
              onControlSave(organization, {
                provider_approved: false,
                payment_status: 'Pending',
                payment_term_days: days,
                license_expiry: organization.license_expiry || null,
              });
            }}
          >
            Pause / Pending
          </Button>
          <Button variant="outline" onClick={() => onViewBranches(organization)}>
            View Branches
          </Button>
          <Button variant="outline" onClick={() => onEdit(organization)}>
            Edit Organization
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const GateDialog: React.FC<{
  open: boolean;
  editing: Gate | null;
  preselectBranch: number | null;
  branchId: number;
  branches: Branch[];
  onClose: () => void;
  onSave: (data: { branchId: number; name: string }) => void;
}> = ({ open, editing, preselectBranch, branchId, branches, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<number>(() => {
    if (editing) return editing.branch_id;
    if (preselectBranch) return preselectBranch;
    if (branchId && branchId !== 0) return branchId;
    return branches[0]?.id || 0;
  });

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setSelectedBranch(editing.branch_id);
    } else {
      setName('');
      setSelectedBranch(preselectBranch || (branchId !== 0 ? branchId : 0) || branches[0]?.id || 0);
    }
  }, [editing, preselectBranch, branchId, branches]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedBranch) return;
    onSave({ branchId: selectedBranch, name });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Gate' : 'Add New Gate'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Update gate details' : 'Create a new gate/entry point for this branch'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Branch</Label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Gate Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Entrance, Back Door"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ── Device Dialog ───────────────────────────────────────────────────────────

const DeviceDialog: React.FC<{
  open: boolean;
  editing: Device | null;
  preselectBranch: number | null;
  preselectGate: number | null;
  branches: Branch[];
  gates: Gate[];
  onClose: () => void;
  onSave: (data: any) => void;
}> = ({ open, editing, preselectBranch, preselectGate, branches, gates, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: '',
    brand: 'ZKTeco',
    ip: '',
    port: 4370,
    comm_key: 0,
    machine_number: 1,
    branch_id: 0,
    gate_id: 0,
    subnet_mask: '255.255.255.0',
    gateway: '192.168.1.1',
    dns: '8.8.8.8',
    dhcp: false,
    server_mode: 'Standalone',
    server_address: '0.0.0.0',
    https_enabled: false,
  });

  useEffect(() => {
    if (editing && editing.name) {
      // Full edit mode
      setForm({
        name: editing.name,
        brand: editing.brand,
        ip: editing.ip,
        port: editing.port,
        comm_key: editing.comm_key,
        machine_number: editing.machine_number,
        branch_id: editing.branch_id,
        gate_id: editing.gate_id || 0,
        subnet_mask: editing.subnet_mask || '255.255.255.0',
        gateway: editing.gateway || '192.168.1.1',
        dns: editing.dns || '8.8.8.8',
        dhcp: editing.dhcp || false,
        server_mode: editing.server_mode || 'Standalone',
        server_address: editing.server_address || '0.0.0.0',
        https_enabled: editing.https_enabled || false,
      });
    } else {
      // New device or preselect branch
      const targetBranchId = preselectBranch || (editing ? editing.branch_id : (branches[0]?.id || 0));
      const targetGateId = preselectGate || 0;
      
      setForm({
        name: '',
        brand: 'ZKTeco',
        ip: '',
        port: 4370,
        comm_key: 0,
        machine_number: 1,
        branch_id: targetBranchId,
        gate_id: targetGateId,
        subnet_mask: '255.255.255.0',
        gateway: '192.168.1.1',
        dns: '8.8.8.8',
        dhcp: false,
        server_mode: 'Standalone',
        server_address: '0.0.0.0',
        https_enabled: false,
      });
    }
  }, [editing, preselectBranch, preselectGate, branches, gates]);

  // Get gates for selected branch
  const selectedBranchGates = gates.filter(g => g.branch_id === form.branch_id);

  // When branch changes, reset gate selection to none
  const handleBranchChange = (branchId: number) => {
    setForm({
      ...form,
      branch_id: branchId,
      gate_id: 0 // No gate selected by default
    });
  };

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
                placeholder="e.g., Main Gate ZKTeco"
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
                onChange={(e) => handleBranchChange(Number(e.target.value))}
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
              <p className="text-xs text-muted-foreground mt-1">
                Devices can be assigned to a gate or work independently
              </p>
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

          {/* Network Settings */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">Network Configuration (Optional)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Subnet Mask</Label>
                <Input
                  value={form.subnet_mask}
                  onChange={(e) => setForm({ ...form, subnet_mask: e.target.value })}
                />
              </div>
              <div>
                <Label>Gateway</Label>
                <Input
                  value={form.gateway}
                  onChange={(e) => setForm({ ...form, gateway: e.target.value })}
                />
              </div>
              <div>
                <Label>DNS</Label>
                <Input
                  value={form.dns}
                  onChange={(e) => setForm({ ...form, dns: e.target.value })}
                />
              </div>
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

// ── Delete Confirm Dialog ───────────────────────────────────────────────────

const DeleteConfirmDialog: React.FC<{
  open: boolean;
  type: string;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ open, type, name, onCancel, onConfirm }) => {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Confirm Delete
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{name}</strong>?
            {type === 'branch' && ' This will also delete all gates and devices under this branch.'}
            {type === 'gate' && ' This will also delete all devices under this gate.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
