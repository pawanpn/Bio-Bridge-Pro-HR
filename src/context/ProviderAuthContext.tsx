import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, getServiceKey } from '@/config/supabase';
import { createClient } from '@supabase/supabase-js';

let _serviceClient: ReturnType<typeof createClient> | null = null;
const getServiceClient = () => {
  if (_serviceClient) return _serviceClient;
  const url = localStorage.getItem('supabaseUrl') || '';
  const key = import.meta.env.VITE_SUPABASE_SERVICE_KEY || localStorage.getItem('supabaseServiceKey') || getServiceKey() || '';
  if (!url || !key) return null;
  _serviceClient = createClient(url, key, { db: { schema: 'public' } });
  return _serviceClient;
};

export type ProviderRole = 'PROVIDER_OWNER' | 'PROVIDER_ADMIN' | 'PROVIDER_BILLING' | 'PROVIDER_SUPPORT' | 'PROVIDER_MONITOR';

export const PROVIDER_MODULES = [
  'dashboard', 'organizations', 'users', 'billing', 'crm', 'monitoring', 'staff', 'roles', 'setup'
] as const;
export type ProviderModule = typeof PROVIDER_MODULES[number];

export interface ProviderUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: ProviderRole;
}

interface ProviderAuthContextType {
  providerUser: ProviderUser | null;
  loading: boolean;
  permissions: ProviderModule[];
  providerLogin: (username: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  providerLogout: (reason?: string) => Promise<void>;
  canAccess: (module: ProviderModule) => boolean;
  isProviderPinSet: () => boolean;
  setProviderPin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  refreshPermissions: () => Promise<void>;
}

const SESSION_KEY = 'biobridge_provider_session';
const DEFAULT_PIN_KEY = 'biobridge_provider_pin';

const ProviderAuthContext = createContext<ProviderAuthContextType | undefined>(undefined);

export const ProviderAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [providerUser, setProviderUser] = useState<ProviderUser | null>(null);
  const [permissions, setPermissions] = useState<ProviderModule[]>([]);
  const [loading, setLoading] = useState(true);
  const LOGOUT_REASON_KEY = 'biobridge_provider_logout_reason';

  const loadPermissions = async (role: ProviderRole) => {
    try {
      const client = supabase;
      let { data, error } = await client.from('provider_roles').select('permissions').eq('role_name', role).single();

      if (error && (error.message?.includes('permission denied') || error.message?.includes('does not exist'))) {
        const svc = getServiceClient();
        if (svc) {
          const res = await svc.from('provider_roles').select('permissions').eq('role_name', role).single();
          if (!res.error) { data = res.data; error = null; }
          else { error = res.error; }
        }
      }

      if (data?.permissions && Array.isArray(data.permissions)) {
        setPermissions(data.permissions as ProviderModule[]);
        return;
      }
    } catch {}
    // fallback
    const fallback: Record<ProviderRole, ProviderModule[]> = {
      PROVIDER_OWNER: ['dashboard','organizations','users','billing','crm','monitoring','staff','roles','setup'],
      PROVIDER_ADMIN: ['dashboard','organizations','users','billing','crm','monitoring','staff'],
      PROVIDER_BILLING: ['dashboard','billing'],
      PROVIDER_SUPPORT: ['dashboard','crm'],
      PROVIDER_MONITOR: ['dashboard','monitoring'],
    };
    setPermissions(fallback[role] || ['dashboard']);
  };

  const getDefaultPin = (): string => {
    return localStorage.getItem(DEFAULT_PIN_KEY) || 'provider123';
  };

  const isProviderPinSet = (): boolean => !!localStorage.getItem(DEFAULT_PIN_KEY);

  const setProviderPinFunc = async (currentPin: string, newPin: string) => {
    const stored = getDefaultPin();
    if (stored !== currentPin) return { success: false, error: 'Current PIN is incorrect' };
    if (newPin.length < 6) return { success: false, error: 'PIN must be at least 6 characters' };
    localStorage.setItem(DEFAULT_PIN_KEY, newPin);
    if (providerUser) {
      await supabase.from('provider_users').update({ pin: newPin }).eq('username', providerUser.username);
    }
    return { success: true };
  };

  const providerLogout = async (reason?: string) => {
    setProviderUser(null);
    setPermissions([]);
    localStorage.removeItem(SESSION_KEY);
    if (reason) localStorage.setItem(LOGOUT_REASON_KEY, reason);
  };

  const queryProviderUser = async (username: string) => {
    const client = supabase;
    let { data, error } = await client
      .from('provider_users')
      .select('id, username, full_name, email, role, pin, is_active')
      .eq('username', username)
      .maybeSingle();

    if (error && (error.message?.includes('permission denied') || error.message?.includes('does not exist'))) {
      const svc = getServiceClient();
      if (svc) {
        const res = await svc.from('provider_users')
          .select('id, username, full_name, email, role, pin, is_active')
          .eq('username', username)
          .maybeSingle();
        if (!res.error) return res;
      }
    }
    return { data, error };
  };

  const providerLogin = async (username: string, pin: string) => {
    // Step 1: try Supabase provider_users table
    const { data, error } = await queryProviderUser(username);

    if (data && !data.is_active) {
      // allow default PIN even for disabled master account
      const defaultPin = getDefaultPin();
      if (pin !== defaultPin || username !== 'provider') {
        return { success: false, error: 'Account is disabled. Contact super provider.' };
      }
    }

    if (data && data.pin === pin) {
      const user: ProviderUser = {
        id: String(data.id),
        username: data.username,
        email: data.email || '',
        full_name: data.full_name || data.username,
        role: data.role as ProviderRole,
      };
      setProviderUser(user);
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      localStorage.removeItem(LOGOUT_REASON_KEY);
      await loadPermissions(user.role);
      return { success: true };
    }

    // Step 2: fallback — default PIN login (works even if Supabase table missing / RLS blocked)
    const defaultPin = getDefaultPin();
    if (pin === defaultPin) {
      const user: ProviderUser = {
        id: 'local-provider',
        username: 'provider',
        email: 'provider@biobridge.com',
        full_name: 'System Provider',
        role: 'PROVIDER_OWNER',
      };
      setProviderUser(user);
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      localStorage.removeItem(LOGOUT_REASON_KEY);
      setPermissions(['dashboard','organizations','users','billing','crm','monitoring','staff','roles','setup']);
      return { success: true };
    }

    if (error && !error.message?.includes('does not exist') && !error.message?.includes('permission denied')) {
      return { success: false, error: error.message };
    }

    return { success: false, error: 'Invalid username or PIN' };
  };

  // Periodic session validation — auto-logout if disabled, refresh if role changed
  useEffect(() => {
    if (!providerUser || providerUser.id === 'local-provider') return;
    const validate = async () => {
      try {
        const client = supabase;
        let { data, error } = await client
          .from('provider_users')
          .select('role, is_active')
          .eq('username', providerUser.username)
          .maybeSingle();

        if (error && (error.message?.includes('permission denied') || error.message?.includes('does not exist'))) {
          const svc = getServiceClient();
          if (svc) {
            const res = await svc.from('provider_users')
              .select('role, is_active')
              .eq('username', providerUser.username)
              .maybeSingle();
            if (!res.error) { data = res.data; error = null; }
          }
        }

        if (!data) return;
        if (!data.is_active) {
          providerLogout('Your account has been disabled. Contact super provider.');
          return;
        }
        if (data.role !== providerUser.role) {
          const updated = { ...providerUser, role: data.role as ProviderRole };
          setProviderUser(updated);
          localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
          await loadPermissions(data.role as ProviderRole);
        }
      } catch { /* ignore network errors */ }
    };
    const interval = setInterval(validate, 15000);
    return () => clearInterval(interval);
  }, [providerUser]);

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.id && parsed.role) {
            setProviderUser(parsed);
            await loadPermissions(parsed.role);
          }
        } catch {}
      }
      setLoading(false);
    };
    init();
  }, []);

  const canAccess = (module: ProviderModule) => permissions.includes(module);

  const refreshPermissions = async () => {
    if (providerUser) await loadPermissions(providerUser.role);
  };

  return (
    <ProviderAuthContext.Provider value={{
      providerUser, loading, permissions, providerLogin, providerLogout,
      canAccess, isProviderPinSet, setProviderPin: setProviderPinFunc, refreshPermissions,
    }}>
      {children}
    </ProviderAuthContext.Provider>
  );
};

export const useProviderAuth = () => {
  const context = useContext(ProviderAuthContext);
  if (!context) throw new Error('useProviderAuth must be used within ProviderAuthProvider');
  return context;
};
