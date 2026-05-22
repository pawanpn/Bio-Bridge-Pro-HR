import { createClient } from '@supabase/supabase-js';

const PUBLIC_SCHEMA = 'public';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: PUBLIC_SCHEMA },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

export const initializeSupabase = () => supabase;
export const getServiceKey = () => SUPABASE_SERVICE_KEY;
export const PUBLIC_SCHEMA_EXPORT = PUBLIC_SCHEMA;

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'conflict';

export interface SyncStats {
  lastSync: string | null;
  totalSynced: number;
  totalFailed: number;
  pendingRecords: number;
  conflicts: number;
  syncStatus: SyncStatus;
}

export const getSyncStats = async (): Promise<SyncStats> => {
  const stats = localStorage.getItem('biobridge_sync_stats');
  if (stats) return JSON.parse(stats);
  return { lastSync: null, totalSynced: 0, totalFailed: 0, pendingRecords: 0, conflicts: 0, syncStatus: 'idle' };
};

export const updateSyncStats = async (stats: Partial<SyncStats>) => {
  const current = await getSyncStats();
  localStorage.setItem('biobridge_sync_stats', JSON.stringify({ ...current, ...stats }));
};

export const isSupabaseConfigured = (): boolean => {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY &&
    SUPABASE_URL !== 'https://your-project.supabase.co' &&
    SUPABASE_ANON_KEY !== 'your-anon-key';
};

export const isOnline = (): boolean => navigator.onLine;

export const onConnectivityChange = (callback: (online: boolean) => void) => {
  const on = () => callback(true);
  const off = () => callback(false);
  window.addEventListener('online', on);
  window.addEventListener('offline', off);
  return () => {
    window.removeEventListener('online', on);
    window.removeEventListener('offline', off);
  };
};

export const SYNC_CONFIG = {
  SYNC_INTERVAL_ONLINE: 30000,
  SYNC_INTERVAL_OFFLINE: 60000,
  BATCH_SIZE: 50,
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000,
  PRIORITY: {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
  },
  CONFLICT_STRATEGY: {
    LAST_WRITE_WINS: 'last_write_wins',
    LOCAL_WINS: 'local_wins',
    REMOTE_WINS: 'remote_wins',
    MANUAL: 'manual',
  },
};

export default supabase;
