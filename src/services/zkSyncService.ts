// ============================================================
// ZKTeco Sync Service (Frontend)
// 
// This service coordinates between:
//  1. Tauri backend (Rust) — pulls logs from ZKTeco device
//  2. Supabase — stores logs
//  3. Browser — shows realtime updates
//
// Flow:
//  startAutoSync() → every 30s → invoke('sync_device_logs')
//                              → saves to Supabase
//                              → Realtime fires → UI updates
// ============================================================
import { supabase } from '@/config/supabase';

interface SyncConfig {
  deviceId: number;
  intervalSeconds: number;
  branchId: number;
  onSync?: (count: number) => void;
  onError?: (err: string) => void;
}

interface SyncResult {
  success: boolean;
  logsCount: number;
  error?: string;
  timestamp: Date;
}

class ZKTecoSyncService {
  private intervalId: NodeJS.Timeout | null = null;
  private isTauriApp: boolean;
  private config: SyncConfig | null = null;
  private lastSync: Date | null = null;
  private syncCount = 0;

  constructor() {
    // Check if running in Tauri desktop app
    this.isTauriApp = typeof window !== 'undefined' && '__TAURI__' in window;
  }

  isDesktopApp(): boolean {
    return this.isTauriApp;
  }

  async startAutoSync(config: SyncConfig): Promise<void> {
    this.config = config;
    this.stopAutoSync();

    if (!this.isTauriApp) {
      console.log('[ZKSync] Running in browser mode — auto sync requires desktop app');
      return;
    }

    // Run immediately
    await this.syncOnce();

    // Then every N seconds
    this.intervalId = setInterval(() => {
      this.syncOnce();
    }, config.intervalSeconds * 1000);

    console.log(`[ZKSync] Auto sync started — every ${config.intervalSeconds}s`);
  }

  stopAutoSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async syncOnce(): Promise<SyncResult> {
    if (!this.config) return { success: false, logsCount: 0, error: 'Not configured', timestamp: new Date() };

    try {
      if (this.isTauriApp) {
        // Use Tauri invoke to pull from ZKTeco device
        const { invoke } = await import('@tauri-apps/api/core');
        const logs = await invoke<any[]>('sync_device_logs', {
          ip: '', // from device config
          port: 4370,
          deviceId: this.config.deviceId,
          brand: 'ZKTeco',
          targetBranchId: this.config.branchId,
          targetGateId: null,
        });

        if (logs && logs.length > 0) {
          // Save to Supabase
          await this.saveLogsToSupabase(logs);
          this.config.onSync?.(logs.length);
          this.syncCount += logs.length;
        }

        this.lastSync = new Date();
        return { success: true, logsCount: logs?.length || 0, timestamp: this.lastSync };
      } else {
        // Browser mode — just check Supabase for pending logs
        const { data } = await supabase
          .from('attendance_logs')
          .select('count')
          .eq('sync_status', 'pending')
          .single();
        return { success: true, logsCount: 0, timestamp: new Date() };
      }
    } catch (err: any) {
      this.config.onError?.(err.message || String(err));
      return { success: false, logsCount: 0, error: err.message, timestamp: new Date() };
    }
  }

  private async saveLogsToSupabase(logs: any[]): Promise<void> {
    const records = logs.map(log => ({
      employee_id: log.employee_id || log.user_id,
      timestamp: new Date(log.timestamp || log.punch_time).toISOString(),
      device_id: this.config?.deviceId,
      sync_status: 'synced',
      organization_id: 2,
    }));

    // Upsert to avoid duplicates
    const { error } = await supabase
      .from('attendance_logs')
      .upsert(records, { onConflict: 'employee_id,timestamp' });

    if (error) console.error('[ZKSync] Failed to save to Supabase:', error);
    else console.log(`[ZKSync] Saved ${records.length} logs to Supabase`);
  }

  getStatus() {
    return {
      isRunning: this.intervalId !== null,
      isDesktopApp: this.isTauriApp,
      lastSync: this.lastSync,
      totalSynced: this.syncCount,
    };
  }
}

// Singleton
export const zkSyncService = new ZKTecoSyncService();

// ─── Manual attendance via Supabase ──────────────────────────

export async function addManualAttendance(employeeId: number, timestamp: Date, deviceId?: number) {
  const { error } = await supabase.from('attendance_logs').insert({
    employee_id: employeeId,
    timestamp: timestamp.toISOString(),
    device_id: deviceId || null,
    sync_status: 'synced',
    organization_id: 2,
  });
  if (error) throw error;
}

// ─── Get today stats ─────────────────────────────────────────

export async function getTodayAttendanceStats() {
  const today = new Date().toISOString().split('T')[0];
  const start = `${today}T00:00:00`;
  const end = `${today}T23:59:59`;

  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('employee_id')
    .gte('timestamp', start)
    .lte('timestamp', end);

  const { data: employees } = await supabase
    .from('employees')
    .select('id')
    .eq('status', 'Active');

  const uniquePresent = new Set((logs || []).map((l: any) => l.employee_id)).size;
  const totalEmployees = employees?.length || 0;

  return {
    totalPunches: logs?.length || 0,
    uniquePresent,
    totalEmployees,
    absent: totalEmployees - uniquePresent,
    attendanceRate: totalEmployees > 0 ? Math.round((uniquePresent / totalEmployees) * 100) : 0,
  };
}
