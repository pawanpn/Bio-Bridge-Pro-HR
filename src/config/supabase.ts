import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase Configuration
// All tables are in the PUBLIC schema
const PUBLIC_SCHEMA = 'public';

// These will be configured by user in System Settings or Setup Wizard
let SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
let SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
let SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY || '';

const safeLocalStorageGet = (key: string) => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const safeLocalStorageSet = (key: string, value: string) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage errors during boot.
  }
};

// Check if user has completed setup
const isSetupComplete = safeLocalStorageGet('setupComplete') === 'true';

// Override with setup wizard values if available
if (isSetupComplete) {
  SUPABASE_URL = safeLocalStorageGet('supabaseUrl') || SUPABASE_URL;
  SUPABASE_ANON_KEY = safeLocalStorageGet('supabaseAnonKey') || SUPABASE_ANON_KEY;
}

// Create Supabase client (singleton) - all queries target PUBLIC schema
let supabaseClient: SupabaseClient;

export const initializeSupabase = (url: string, anonKey: string): SupabaseClient => {
  SUPABASE_URL = url;
  SUPABASE_ANON_KEY = anonKey;
  safeLocalStorageSet('supabaseUrl', url);
  safeLocalStorageSet('supabaseAnonKey', anonKey);

  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: PUBLIC_SCHEMA },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return supabaseClient;
};

// Initialize with current values - PUBLIC schema
try {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: PUBLIC_SCHEMA },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
} catch (error) {
  console.warn('⚠️ Failed to initialize Supabase client:', error);
  // Create a dummy client that won't crash
  supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder', {
    db: { schema: PUBLIC_SCHEMA },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = supabaseClient;
export { PUBLIC_SCHEMA };

// Export service key for admin operations
export const getServiceKey = () => SUPABASE_SERVICE_KEY;

// Sync Configuration
export const SYNC_CONFIG = {
  // Sync intervals (in milliseconds)
  SYNC_INTERVAL_ONLINE: 30000,      // 30 seconds
  SYNC_INTERVAL_OFFLINE: 60000,     // 1 minute when back online
  BATCH_SIZE: 50,                    // Records per sync batch
  MAX_RETRIES: 3,                    // Max retry attempts
  RETRY_DELAY: 5000,                // 5 seconds between retries
  
  // Data priority levels
  PRIORITY: {
    CRITICAL: 'critical',   // Attendance, Payroll, Financial - sync immediately
    HIGH: 'high',          // Employee updates, Leave requests - sync within 5 min
    MEDIUM: 'medium',      // Inventory, Tasks - sync within 30 min
    LOW: 'low',            // Reports, Analytics - sync on demand
  },
  
  // Conflict resolution strategies
  CONFLICT_STRATEGY: {
    LAST_WRITE_WINS: 'last_write_wins',
    LOCAL_WINS: 'local_wins',
    REMOTE_WINS: 'remote_wins',
    MANUAL: 'manual',
  },
};

// Sync status types
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'conflict';

// Sync statistics
export interface SyncStats {
  lastSync: string | null;
  totalSynced: number;
  totalFailed: number;
  pendingRecords: number;
  conflicts: number;
  syncStatus: SyncStatus;
}

// Helper function to get current sync stats
export const getSyncStats = async (): Promise<SyncStats> => {
  try {
    const stats = safeLocalStorageGet('biobridge_sync_stats');
    if (stats) {
      return JSON.parse(stats);
    }
  } catch {
    // Fall through to default state.
  }

  return {
    lastSync: null,
    totalSynced: 0,
    totalFailed: 0,
    pendingRecords: 0,
    conflicts: 0,
    syncStatus: 'idle',
  };
};

// Helper function to update sync stats
export const updateSyncStats = async (stats: Partial<SyncStats>) => {
  const current = await getSyncStats();
  const updated = { ...current, ...stats };
  safeLocalStorageSet('biobridge_sync_stats', JSON.stringify(updated));
};

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY && 
         SUPABASE_URL !== 'https://your-project.supabase.co' &&
         SUPABASE_ANON_KEY !== 'your-anon-key';
};

// Check internet connectivity
export const isOnline = (): boolean => {
  try {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  } catch {
    return true;
  }
};

// Listen for online/offline events
export const onConnectivityChange = (callback: (online: boolean) => void) => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

export default supabase;
