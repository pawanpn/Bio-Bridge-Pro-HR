import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
// These will be configured by user in System Settings
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create Supabase client (singleton)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
  const stats = localStorage.getItem('biobridge_sync_stats');
  if (stats) {
    return JSON.parse(stats);
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
  localStorage.setItem('biobridge_sync_stats', JSON.stringify(updated));
};

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY && 
         SUPABASE_URL !== 'https://your-project.supabase.co' &&
         SUPABASE_ANON_KEY !== 'your-anon-key';
};

// Check internet connectivity
export const isOnline = (): boolean => {
  return navigator.onLine;
};

// Listen for online/offline events
export const onConnectivityChange = (callback: (online: boolean) => void) => {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
  
  // Return cleanup function
  return () => {
    window.removeEventListener('online', () => callback(true));
    window.removeEventListener('offline', () => callback(false));
  };
};

export default supabase;
