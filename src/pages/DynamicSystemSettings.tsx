import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DeviceManagement } from '@/components/DeviceManagement';
import {
  Settings,
  Save,
  Plus,
  Trash2,
  Globe,
  Bell,
  Shield,
  Clock,
  Database,
  DollarSign,
  Building2,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/config/supabase';

interface SystemSetting {
  id?: string;
  setting_key: string;
  setting_value: string;
  setting_type: 'string' | 'number' | 'boolean' | 'json';
  category: string;
  description: string;
  is_public: boolean;
}

interface SettingCategory {
  category: string;
  icon: React.ElementType;
  description: string;
  settings: SystemSetting[];
}

export const DynamicSystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAddSetting, setShowAddSetting] = useState(false);
  const [newSetting, setNewSetting] = useState<SystemSetting>({
    setting_key: '',
    setting_value: '',
    setting_type: 'string',
    category: 'general',
    description: '',
    is_public: true
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const categories: SettingCategory[] = [
    {
      category: 'general',
      icon: Settings,
      description: 'General system configuration',
      settings: settings.filter(s => s.category === 'general')
    },
    {
      category: 'company',
      icon: Building2,
      description: 'Company information and branding',
      settings: settings.filter(s => s.category === 'company')
    },
    {
      category: 'localization',
      icon: Globe,
      description: 'Regional settings and calendar',
      settings: settings.filter(s => s.category === 'localization')
    },
    {
      category: 'security',
      icon: Shield,
      description: 'Authentication and security policies',
      settings: settings.filter(s => s.category === 'security')
    },
    {
      category: 'notifications',
      icon: Bell,
      description: 'Email, SMS and push notifications',
      settings: settings.filter(s => s.category === 'notifications')
    },
    {
      category: 'attendance',
      icon: Clock,
      description: 'Attendance tracking configuration',
      settings: settings.filter(s => s.category === 'attendance')
    },
    {
      category: 'payroll',
      icon: DollarSign,
      description: 'Payroll and compensation settings',
      settings: settings.filter(s => s.category === 'payroll')
    },
    {
      category: 'database',
      icon: Database,
      description: 'Database and sync configuration',
      settings: settings.filter(s => s.category === 'database')
    }
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('category', 'setting_key');

      if (error) throw error;
      setSettings(data || []);
    } catch (error: any) {
      console.error('Error loading settings:', error);
      setErrorMessage('Failed to load settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (id: string | undefined, setting: SystemSetting) => {
    try {
      setSaving(true);
      setSuccessMessage('');
      setErrorMessage('');

      if (id) {
        // Update existing
        const { error } = await supabase
          .from('system_settings')
          .update({
            setting_value: setting.setting_value,
            setting_type: setting.setting_type,
            description: setting.description,
            is_public: setting.is_public,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (error) throw error;
        setSuccessMessage('Setting updated successfully');
      } else {
        // Create new
        const { error } = await supabase
          .from('system_settings')
          .insert({
            setting_key: setting.setting_key,
            setting_value: setting.setting_value,
            setting_type: setting.setting_type,
            category: setting.category,
            description: setting.description,
            is_public: setting.is_public
          });

        if (error) throw error;
        setSuccessMessage('Setting created successfully');
        setShowAddSetting(false);
        setNewSetting({
          setting_key: '',
          setting_value: '',
          setting_type: 'string',
          category: 'general',
          description: '',
          is_public: true
        });
      }

      // Reload settings
      await loadSettings();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Error saving setting:', error);
      setErrorMessage('Failed to save setting: ' + error.message);
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const deleteSetting = async (id: string) => {
    if (!confirm('Are you sure you want to delete this setting?')) return;

    try {
      const { error } = await supabase
        .from('system_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage('Setting deleted successfully');
      await loadSettings();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Error deleting setting:', error);
      setErrorMessage('Failed to delete setting: ' + error.message);
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const renderSettingInput = (setting: SystemSetting) => {
    switch (setting.setting_type) {
      case 'boolean':
        return (
          <select
            className="w-full px-3 py-2 border rounded-md"
            value={setting.setting_value}
            onChange={(e) => {
              const updated = { ...setting, setting_value: e.target.value };
              updateSetting(setting.id, updated);
            }}
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={setting.setting_value}
            onChange={(e) => {
              const updated = { ...setting, setting_value: e.target.value };
              updateSetting(setting.id, updated);
            }}
          />
        );
      
      case 'json':
        return (
          <textarea
            className="w-full px-3 py-2 border rounded-md font-mono text-sm"
            rows={4}
            value={setting.setting_value}
            onChange={(e) => {
              const updated = { ...setting, setting_value: e.target.value };
              updateSetting(setting.id, updated);
            }}
          />
        );
      
      default:
        return (
          <Input
            type="text"
            value={setting.setting_value}
            onChange={(e) => {
              const updated = { ...setting, setting_value: e.target.value };
              updateSetting(setting.id, updated);
            }}
          />
        );
    }
  };

  const filteredCategories = activeCategory === 'all' 
    ? categories 
    : categories.filter(c => c.category === activeCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">System Settings</h2>
          <p className="text-muted-foreground">Configure and manage all system settings dynamically</p>
        </div>
        {activeCategory !== 'attendance' && (
          <Button onClick={() => setShowAddSetting(true)}>
            <Plus size={16} />
            Add Setting
          </Button>
        )}
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle2 size={20} className="text-green-600" />
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} className="text-red-600" />
          <p className="text-sm text-red-800">{errorMessage}</p>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={activeCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveCategory('all')}
        >
          All
        </Button>
        {categories.map(cat => {
          const Icon = cat.icon;
          return (
            <Button
              key={cat.category}
              variant={activeCategory === cat.category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(cat.category)}
              className="whitespace-nowrap"
            >
              <Icon size={14} className="mr-1" />
              {cat.category.charAt(0).toUpperCase() + cat.category.slice(1)}
            </Button>
          );
        })}
      </div>

      {/* Settings by Category */}
      <div className="space-y-6">
        {/* Special handling for Attendance category - show Device Management */}
        {activeCategory === 'attendance' ? (
          <DeviceManagement />
        ) : (
          filteredCategories.map(cat => {
            const Icon = cat.icon;
            return (
              <Card key={cat.category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon size={20} />
                    {cat.category.charAt(0).toUpperCase() + cat.category.slice(1)} Settings
                  </CardTitle>
                  <CardDescription>{cat.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {cat.settings.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No settings configured yet. Click "Add Setting" to create one.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {cat.settings.map(setting => (
                        <div key={setting.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{setting.setting_key}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {setting.setting_type}
                                </Badge>
                                {setting.is_public && (
                                  <Badge variant="secondary" className="text-xs">
                                    Public
                                  </Badge>
                                )}
                              </div>
                              {setting.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {setting.description}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => deleteSetting(setting.id!)}
                            >
                              <Trash2 size={16} className="text-red-500" />
                            </Button>
                          </div>
                          {renderSettingInput(setting)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add Setting Dialog */}
      {showAddSetting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Add New Setting</CardTitle>
              <CardDescription>Create a new dynamic system setting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Setting Key *</label>
                <Input
                  value={newSetting.setting_key}
                  onChange={(e) => setNewSetting({ ...newSetting, setting_key: e.target.value })}
                  placeholder="e.g., max_login_attempts"
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier (lowercase with underscores)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Setting Value *</label>
                {newSetting.setting_type === 'boolean' ? (
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={newSetting.setting_value}
                    onChange={(e) => setNewSetting({ ...newSetting, setting_value: e.target.value })}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                ) : newSetting.setting_type === 'json' ? (
                  <textarea
                    className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                    rows={4}
                    value={newSetting.setting_value}
                    onChange={(e) => setNewSetting({ ...newSetting, setting_value: e.target.value })}
                    placeholder='{"key": "value"}'
                  />
                ) : (
                  <Input
                    type={newSetting.setting_type === 'number' ? 'number' : 'text'}
                    value={newSetting.setting_value}
                    onChange={(e) => setNewSetting({ ...newSetting, setting_value: e.target.value })}
                    placeholder="Enter value"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={newSetting.setting_type}
                    onChange={(e) => setNewSetting({ ...newSetting, setting_type: e.target.value as any })}
                  >
                    <option value="string">String (Text)</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean (Yes/No)</option>
                    <option value="json">JSON</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={newSetting.category}
                    onChange={(e) => setNewSetting({ ...newSetting, category: e.target.value })}
                  >
                    <option value="general">General</option>
                    <option value="company">Company</option>
                    <option value="localization">Localization</option>
                    <option value="security">Security</option>
                    <option value="notifications">Notifications</option>
                    <option value="attendance">Attendance</option>
                    <option value="payroll">Payroll</option>
                    <option value="database">Database</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={newSetting.description}
                  onChange={(e) => setNewSetting({ ...newSetting, description: e.target.value })}
                  placeholder="What is this setting for?"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={newSetting.is_public}
                  onChange={(e) => setNewSetting({ ...newSetting, is_public: e.target.checked })}
                />
                <label htmlFor="is_public" className="text-sm">
                  Public (accessible via API)
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAddSetting(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={() => updateSetting(undefined, newSetting)}
                  disabled={!newSetting.setting_key || !newSetting.setting_value}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Create Setting
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
