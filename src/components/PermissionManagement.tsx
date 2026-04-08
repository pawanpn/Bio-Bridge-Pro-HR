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
  Loader2
} from 'lucide-react';
import { supabase } from '@/config/supabase';

interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  level: number;
  parent_role_id?: string;
  is_active: boolean;
}

interface Permission {
  id: string;
  module: string;
  permission: string;
  description: string;
}

interface RolePermission {
  role_id: string;
  permission_id: string;
}

interface PermissionModule {
  module: string;
  permissions: Permission[];
}

export const PermissionManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['hr', 'attendance', 'leave']));
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', code: '', description: '', level: 1, parent_role_id: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('level', { ascending: false });

      if (rolesError) throw rolesError;

      const { data: permsData, error: permsError } = await supabase
        .from('permissions')
        .select('*')
        .order('module', 'permission');

      if (permsError) throw permsError;

      const { data: rolePermsData, error: rolePermsError } = await supabase
        .from('role_permissions')
        .select('*');

      if (rolePermsError) throw rolePermsError;

      setRoles(rolesData || []);
      setPermissions(permsData || []);
      setRolePermissions(rolePermsData || []);

      if (rolesData && rolesData.length > 0) {
        setSelectedRoleId(rolesData[0].id);
      }
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
      rp => rp.role_id === selectedRoleId && rp.permission_id === permissionId
    );
  };

  const togglePermission = (permissionId: string) => {
    const exists = rolePermissions.some(
      rp => rp.role_id === selectedRoleId && rp.permission_id === permissionId
    );

    if (exists) {
      setRolePermissions(prev => 
        prev.filter(rp => !(rp.role_id === selectedRoleId && rp.permission_id === permissionId))
      );
    } else {
      setRolePermissions(prev => [
        ...prev,
        { role_id: selectedRoleId, permission_id: permissionId }
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
          !(rp.role_id === selectedRoleId && modulePerms.some(p => p.id === rp.permission_id))
        )
      );
    } else {
      // Select all
      const newPerms = modulePerms
        .filter(p => !hasPermission(p.id))
        .map(p => ({ role_id: selectedRoleId, permission_id: p.id }));
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
    if (!selectedRoleId) {
      alert('Please select a role first');
      return;
    }

    try {
      setSaving(true);

      // Delete existing permissions for this role
      const { error: deleteError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', selectedRoleId);

      if (deleteError) throw deleteError;

      // Insert new permissions
      if (rolePermissions.filter(rp => rp.role_id === selectedRoleId).length > 0) {
        const { error: insertError } = await supabase
          .from('role_permissions')
          .insert(rolePermissions.filter(rp => rp.role_id === selectedRoleId));

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

  const createRole = async () => {
    if (!newRole.name || !newRole.code) {
      alert('Role name and code are required');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('roles')
        .insert({
          name: newRole.name,
          code: newRole.code,
          description: newRole.description,
          level: newRole.level,
          parent_role_id: newRole.parent_role_id || null,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      setRoles([...roles, data]);
      setShowAddRole(false);
      setNewRole({ name: '', code: '', description: '', level: 1, parent_role_id: '' });
      alert('Role created successfully!');
    } catch (error: any) {
      console.error('Error creating role:', error);
      alert('Failed to create role: ' + error.message);
    }
  };

  const deleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role? This cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('roles')
        .update({ is_active: false })
        .eq('id', roleId);

      if (error) throw error;

      setRoles(roles.filter(r => r.id !== roleId));
      if (selectedRoleId === roleId) {
        setSelectedRoleId('');
      }
      alert('Role deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting role:', error);
      alert('Failed to delete role: ' + error.message);
    }
  };

  const filteredRoles = roles.filter(role => 
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <p className="text-muted-foreground">Configure role-based access control and permissions</p>
        </div>
        <Button onClick={() => setShowAddRole(true)}>
          <Plus size={16} />
          Add Role
        </Button>
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
              <CardDescription>Select a role to manage permissions</CardDescription>
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
                    key={role.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedRoleId === role.id
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedRoleId(role.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Key size={16} />
                          <p className="font-semibold">{role.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{role.code}</p>
                        {role.description && (
                          <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          Level {role.level}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRole(role.id);
                          }}
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </Button>
                      </div>
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
                    {selectedRoleId && (
                      <Badge variant="outline">
                        {roles.find(r => r.id === selectedRoleId)?.name}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {selectedRoleId 
                      ? 'Toggle permissions for the selected role'
                      : 'Select a role to manage permissions'
                    }
                  </CardDescription>
                </div>
                {selectedRoleId && (
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
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedRoleId ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <Shield size={48} className="mb-4 opacity-50" />
                  <p>Select a role from the left panel to manage permissions</p>
                </div>
              ) : (
                <div className="space-y-4">
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

      {/* Add Role Dialog */}
      {showAddRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create New Role</CardTitle>
              <CardDescription>Add a new role with custom permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Role Name *</label>
                <Input
                  value={newRole.name}
                  onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  placeholder="e.g., Department Manager"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Role Code *</label>
                <Input
                  value={newRole.code}
                  onChange={(e) => setNewRole({ ...newRole, code: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                  placeholder="e.g., DEPT_MANAGER"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={newRole.description}
                  onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                  placeholder="Role description"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Level (Hierarchy)</label>
                <Input
                  type="number"
                  value={newRole.level}
                  onChange={(e) => setNewRole({ ...newRole, level: parseInt(e.target.value) })}
                  min="1"
                  max="10"
                />
                <p className="text-xs text-muted-foreground">Higher level = more authority (1-10)</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Parent Role (Optional)</label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={newRole.parent_role_id}
                  onChange={(e) => setNewRole({ ...newRole, parent_role_id: e.target.value })}
                >
                  <option value="">None</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAddRole(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={createRole}>
                  Create Role
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
