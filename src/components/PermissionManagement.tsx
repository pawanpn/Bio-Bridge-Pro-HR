import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  Key, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Trash2, 
  CheckCircle2,
  XCircle,
  Search,
  Save,
  Loader2,
  Users,
  GitBranch
} from 'lucide-react';
import { supabase } from '@/config/supabase';

interface Permission {
  id: string;
  module: string;
  permission: string;
  description: string;
  organization_id?: string;
}

interface RolePermission {
  role: string;
  permission_id: string;
  organization_id?: string;
}

interface PermissionModule {
  module: string;
  permissions: Permission[];
}

// Your schema's role types
const ROLE_TYPES = [
  { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full system access', level: 10 },
  { code: 'ADMIN', name: 'Admin', description: 'Administrative access', level: 8 },
  { code: 'MANAGER', name: 'Manager', description: 'Department manager', level: 6 },
  { code: 'SUPERVISOR', name: 'Supervisor', description: 'Team supervisor', level: 4 },
  { code: 'EMPLOYEE', name: 'Employee', description: 'Regular employee', level: 2 },
  { code: 'OPERATOR', name: 'Operator', description: 'Attendance operator', level: 3 },
  { code: 'VIEWER', name: 'Viewer', description: 'Read-only access', level: 1 }
];

export const PermissionManagement: React.FC = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('SUPER_ADMIN');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['hr', 'attendance', 'leave']));
  const [showRoleInfo, setShowRoleInfo] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const { data: permsData, error: permsError } = await supabase
        .from('permissions')
        .select('*')
        .order('module', { ascending: true })
        .order('permission', { ascending: true });

      if (permsError) throw permsError;

      const { data: rolePermsData, error: rolePermsError } = await supabase
        .from('role_permissions')
        .select('*')
        .order('role', { ascending: true });

      if (rolePermsError) throw rolePermsError;

      setPermissions(permsData || []);
      setRolePermissions(rolePermsData || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert('Failed to load permission data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const groupedPermissions: PermissionModule[] = permissions.reduce((acc: PermissionModule[], perm) => {
    const existing = acc.find(m => m.module === perm.module);
    if (existing) {
      existing.permissions.push(perm);
    } else {
      acc.push({ module: perm.module, permissions: [perm] });
    }
    return acc;
  }, []);

  const hasPermission = (permissionId: string) => {
    return rolePermissions.some(
      rp => rp.role === selectedRole && rp.permission_id === permissionId
    );
  };

  const togglePermission = (permissionId: string) => {
    const exists = rolePermissions.some(
      rp => rp.role === selectedRole && rp.permission_id === permissionId
    );

    if (exists) {
      setRolePermissions(prev => 
        prev.filter(rp => !(rp.role === selectedRole && rp.permission_id === permissionId))
      );
    } else {
      setRolePermissions(prev => [
        ...prev,
        { role: selectedRole, permission_id: permissionId }
      ]);
    }
  };

  const toggleModule = (module: string) => {
    const modulePerms = permissions.filter(p => p.module === module);
    const allSelected = modulePerms.every(p => hasPermission(p.id));

    if (allSelected) {
      // Unselect all
      setRolePermissions(prev => 
        prev.filter(rp => 
          !(rp.role === selectedRole && modulePerms.some(p => p.id === rp.permission_id))
        )
      );
    } else {
      // Select all
      const newPerms = modulePerms
        .filter(p => !hasPermission(p.id))
        .map(p => ({ role: selectedRole, permission_id: p.id }));
      setRolePermissions(prev => [...prev, ...newPerms]);
    }
  };

  const toggleModuleExpand = (module: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(module)) {
      newExpanded.delete(module);
    } else {
      newExpanded.add(module);
    }
    setExpandedModules(newExpanded);
  };

  const savePermissions = async () => {
    if (!selectedRole) {
      alert('Please select a role first');
      return;
    }

    try {
      setSaving(true);

      // Delete existing permissions for this role
      const { error: deleteError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role', selectedRole);

      if (deleteError) throw deleteError;

      // Insert new permissions
      const rolePermsToInsert = rolePermissions.filter(rp => rp.role === selectedRole);
      if (rolePermsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('role_permissions')
          .insert(rolePermsToInsert);

        if (insertError) throw insertError;
      }

      alert('Permissions saved successfully!');
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      alert('Failed to save permissions: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetRolePermissions = async (roleCode: string) => {
    if (!confirm(`Reset ${roleCode} permissions to default?`)) return;

    try {
      // Get all permissions
      const { data: allPerms } = await supabase.from('permissions').select('id');
      if (!allPerms) return;

      let permsToAssign: string[] = [];

      // Default assignments based on role
      switch(roleCode) {
        case 'SUPER_ADMIN':
          permsToAssign = allPerms.map(p => p.id);
          break;
        case 'ADMIN':
          permsToAssign = allPerms
            .filter((p: any) => !['delete_employees', 'manage_settings'].includes(p.permission))
            .map((p: any) => p.id);
          break;
        case 'MANAGER':
          permsToAssign = allPerms
            .filter((p: any) => ['view_employees', 'view_attendance', 'approve_attendance', 'view_leaves', 'view_payroll', 'view_reports', 'export_reports'].includes(p.permission))
            .map((p: any) => p.id);
          break;
        case 'EMPLOYEE':
          permsToAssign = allPerms
            .filter((p: any) => ['view_employees', 'apply_leave', 'view_attendance', 'view_reports'].includes(p.permission))
            .map((p: any) => p.id);
          break;
        case 'VIEWER':
          permsToAssign = allPerms
            .filter((p: any) => p.permission.startsWith('view_'))
            .map((p: any) => p.id);
          break;
      }

      // Delete existing
      await supabase.from('role_permissions').delete().eq('role', roleCode);

      // Insert new
      if (permsToAssign.length > 0) {
        await supabase.from('role_permissions')
          .insert(permsToAssign.map(pid => ({ role: roleCode, permission_id: pid })));
      }

      alert(`${roleCode} permissions reset to default!`);
      await loadData();
    } catch (error: any) {
      console.error('Error resetting permissions:', error);
      alert('Failed to reset: ' + error.message);
    }
  };

  const filteredRoles = ROLE_TYPES.filter(role => 
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedRoleInfo = ROLE_TYPES.find(r => r.code === selectedRole);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Role & Permission Management</h2>
          <p className="text-muted-foreground">Configure role-based access control (matches your Supabase schema)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Roles List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield size={20} />
                Roles
              </CardTitle>
              <CardDescription>Your schema uses role VARCHAR field in users table</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Search roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Separator />

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredRoles.map(role => (
                  <div
                    key={role.code}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedRole === role.code
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedRole(role.code)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Key size={16} />
                          <p className="font-semibold">{role.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{role.code}</p>
                        <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Level {role.level}
                      </Badge>
                    </div>
                  </div>
                ))}

                {filteredRoles.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No roles found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Permissions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield size={20} />
                    Permissions
                    {selectedRole && (
                      <Badge variant="outline">
                        {selectedRoleInfo?.name} ({selectedRole})
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {selectedRole 
                      ? `Toggle permissions for ${selectedRoleInfo?.name}`
                      : 'Select a role to manage permissions'
                    }
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => resetRolePermissions(selectedRole)}
                  >
                    Reset to Default
                  </Button>
                  <Button onClick={savePermissions} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedRole ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <Shield size={48} className="mb-4 opacity-50" />
                  <p>Select a role from the left panel to manage permissions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Role Info */}
                  {selectedRoleInfo && (
                    <div className="p-4 bg-muted rounded-lg mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={16} />
                        <h4 className="font-semibold">{selectedRoleInfo.name}</h4>
                        <Badge>{selectedRoleInfo.code}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedRoleInfo.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Authority Level: {selectedRoleInfo.level}/10 | 
                        Users with this role: <strong>users.role = '{selectedRoleInfo.code}'</strong>
                      </p>
                    </div>
                  )}

                  {groupedPermissions.map(module => (
                    <div key={module.module} className="border rounded-lg">
                      <div
                        className="flex items-center justify-between p-4 bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => toggleModuleExpand(module.module)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedModules.has(module.module) ? (
                            <ChevronDown size={18} />
                          ) : (
                            <ChevronRight size={18} />
                          )}
                          <h3 className="font-semibold capitalize">{module.module}</h3>
                          <Badge variant="outline" className="text-xs">
                            {module.permissions.filter(p => hasPermission(p.id)).length}/{module.permissions.length}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleModule(module.module);
                          }}
                        >
                          {module.permissions.every(p => hasPermission(p.id)) ? (
                            <>
                              <XCircle size={14} className="mr-1" />
                              Unselect All
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} className="mr-1" />
                              Select All
                            </>
                          )}
                        </Button>
                      </div>

                      {expandedModules.has(module.module) && (
                        <div className="p-4 space-y-2">
                          {module.permissions.map(perm => (
                            <div
                              key={perm.id}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                                hasPermission(perm.id)
                                  ? 'bg-green-50 border-green-200'
                                  : 'hover:bg-muted'
                              }`}
                              onClick={() => togglePermission(perm.id)}
                            >
                              <div className="flex-1">
                                <p className="font-medium text-sm">{perm.permission.replace(/_/g, ' ')}</p>
                                {perm.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{perm.description}</p>
                                )}
                              </div>
                              {hasPermission(perm.id) ? (
                                <CheckCircle2 size={20} className="text-green-600" />
                              ) : (
                                <XCircle size={20} className="text-muted-foreground opacity-30" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
