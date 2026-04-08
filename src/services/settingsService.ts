import { supabase } from '@/config/supabase';

export interface SystemSetting {
  id?: string;
  setting_key: string;
  setting_value: string;
  setting_type: 'string' | 'number' | 'boolean' | 'json';
  category: string;
  description: string;
  is_public: boolean;
}

class SettingsService {
  private cache: Map<string, any> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get a setting value by key
   * @param key Setting key
   * @param defaultValue Default value if not found
   * @returns Setting value or default
   */
  async getSetting<T = string>(key: string, defaultValue?: T): Promise<T | undefined> {
    // Check cache first
    if (this.isCacheValid() && this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value, setting_type')
        .eq('setting_key', key)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found, return default
          return defaultValue;
        }
        throw error;
      }

      // Parse value based on type
      let value: any = data.setting_value;
      switch (data.setting_type) {
        case 'number':
          value = parseFloat(value);
          break;
        case 'boolean':
          value = value === 'true';
          break;
        case 'json':
          try {
            value = JSON.parse(value);
          } catch (e) {
            console.error(`Failed to parse JSON for setting ${key}:`, e);
          }
          break;
      }

      // Update cache
      this.cache.set(key, value);
      
      return value as T;
    } catch (error) {
      console.error(`Error fetching setting ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Get multiple settings by keys
   * @param keys Array of setting keys
   * @returns Object with key-value pairs
   */
  async getSettings(keys: string[]): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    // Check cache for all keys
    const missingKeys: string[] = [];
    keys.forEach(key => {
      if (this.isCacheValid() && this.cache.has(key)) {
        result[key] = this.cache.get(key);
      } else {
        missingKeys.push(key);
      }
    });

    if (missingKeys.length === 0) {
      return result;
    }

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value, setting_type')
        .in('setting_key', missingKeys);

      if (error) throw error;

      data?.forEach(setting => {
        let value: any = setting.setting_value;
        switch (setting.setting_type) {
          case 'number':
            value = parseFloat(value);
            break;
          case 'boolean':
            value = value === 'true';
            break;
          case 'json':
            try {
              value = JSON.parse(value);
            } catch (e) {
              console.error(`Failed to parse JSON for setting ${setting.setting_key}:`, e);
            }
            break;
        }

        result[setting.setting_key] = value;
        this.cache.set(setting.setting_key, value);
      });

      return result;
    } catch (error) {
      console.error('Error fetching settings:', error);
      return result;
    }
  }

  /**
   * Get all settings in a category
   * @param category Category name
   * @returns Array of settings
   */
  async getCategorySettings(category: string): Promise<SystemSetting[]> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('category', category)
        .order('setting_key');

      if (error) throw error;

      // Parse values
      const settings = data?.map(setting => ({
        ...setting,
        setting_value: this.parseSettingValue(setting.setting_value, setting.setting_type)
      })) || [];

      return settings;
    } catch (error) {
      console.error(`Error fetching category settings ${category}:`, error);
      return [];
    }
  }

  /**
   * Set a setting value
   * @param key Setting key
   * @param value Setting value
   * @param options Additional options
   */
  async setSetting(
    key: string, 
    value: any, 
    options?: {
      category?: string;
      description?: string;
      setting_type?: 'string' | 'number' | 'boolean' | 'json';
      is_public?: boolean;
    }
  ): Promise<boolean> {
    try {
      const settingType = options?.setting_type || this.detectType(value);
      const stringValue = this.stringifyValue(value, settingType);

      // Check if setting exists
      const existing = await this.getSetting(key);
      
      if (existing !== undefined) {
        // Update
        const { error } = await supabase
          .from('system_settings')
          .update({
            setting_value: stringValue,
            setting_type: settingType,
            updated_at: new Date().toISOString()
          })
          .eq('setting_key', key);

        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('system_settings')
          .insert({
            setting_key: key,
            setting_value: stringValue,
            setting_type: settingType,
            category: options?.category || 'general',
            description: options?.description || '',
            is_public: options?.is_public !== false
          });

        if (error) throw error;
      }

      // Update cache
      this.cache.set(key, value);

      return true;
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a setting
   * @param key Setting key
   */
  async deleteSetting(key: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('system_settings')
        .delete()
        .eq('setting_key', key);

      if (error) throw error;

      // Remove from cache
      this.cache.delete(key);

      return true;
    } catch (error) {
      console.error(`Error deleting setting ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamp = 0;
  }

  /**
   * Refresh all settings from database
   */
  async refresh() {
    this.clearCache();
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.CACHE_TTL;
  }

  /**
   * Detect setting type from value
   */
  private detectType(value: any): 'string' | 'number' | 'boolean' | 'json' {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'object') return 'json';
    return 'string';
  }

  /**
   * Stringify value for storage
   */
  private stringifyValue(value: any, type: string): string {
    if (type === 'json' && typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Parse setting value based on type
   */
  private parseSettingValue(value: string, type: string): any {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value === 'true';
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }
}

export const settingsService = new SettingsService();
