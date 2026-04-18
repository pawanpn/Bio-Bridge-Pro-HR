import { supabase } from '@/config/supabase';
import { invoke } from '@tauri-apps/api/core';

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface SyncQueueItem {
  id: number;
  table_name: string;
  operation: SyncOperation;
  payload: string; // JSON string
  supabase_id?: string;
  created_at: string;
  synced_at?: string;
  retry_count: number;
  error_message?: string;
}

export interface ConnectivityState {
  isOnline: boolean;
  lastChecked: Date;
  supabaseConnected: boolean;
}

class SyncService {
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private connectivityInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private listeners: Array<(state: ConnectivityState) => void> = [];
  private connectivityState: ConnectivityState = {
    isOnline: navigator.onLine,
    lastChecked: new Date(),
    supabaseConnected: false,
  };

  // Initialize the sync service
  async initialize() {
    console.log('🔄 Initializing Sync Service...');
    
    // Check initial connectivity
    await this.checkConnectivity();
    
    // Start connectivity watcher (every 30 seconds)
    this.startConnectivityWatcher();
    
    // Start sync queue processor (every 60 seconds when online)
    this.startSyncProcessor();
    
    // Listen to browser online/offline events
    window.addEventListener('online', () => this.handleOnlineStatus(true));
    window.addEventListener('offline', () => this.handleOnlineStatus(false));
    
    console.log('✅ Sync Service initialized');
  }

  // Check if Supabase is reachable
  async checkConnectivity(): Promise<boolean> {
    try {
      const { error } = await supabase.from('employees').select('id').limit(1);
      const isConnected = !error;
      
      this.connectivityState = {
        isOnline: navigator.onLine && isConnected,
        lastChecked: new Date(),
        supabaseConnected: isConnected,
      };
      
      this.notifyListeners();
      return isConnected;
    } catch {
      this.connectivityState = {
        isOnline: false,
        lastChecked: new Date(),
        supabaseConnected: false,
      };
      this.notifyListeners();
      return false;
    }
  }

  // Get current connectivity state
  getConnectivityState(): ConnectivityState {
    return { ...this.connectivityState };
  }

  // Subscribe to connectivity changes
  onConnectivityChange(callback: (state: ConnectivityState) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb({ ...this.connectivityState }));
  }

  private handleOnlineStatus(online: boolean) {
    console.log(`🌐 Network status changed: ${online ? 'ONLINE' : 'OFFLINE'}`);
    this.connectivityState.isOnline = online;
    this.notifyListeners();
    
    if (online) {
      this.checkConnectivity();
      this.processSyncQueue(); // Process queue immediately when back online
    }
  }

  // Start connectivity watcher
  private startConnectivityWatcher() {
    this.connectivityInterval = setInterval(async () => {
      await this.checkConnectivity();
    }, 30000); // Every 30 seconds
  }

  // Start sync queue processor
  private startSyncProcessor() {
    this.syncInterval = setInterval(async () => {
      if (this.connectivityState.isOnline && !this.isSyncing) {
        await this.processSyncQueue();
      }
    }, 60000); // Every 60 seconds
  }

  // Add item to sync queue (offline-first)
  async queueOperation(
    tableName: string,
    operation: SyncOperation,
    payload: any,
    supabaseId?: string
  ): Promise<void> {
    try {
      await invoke('add_to_sync_queue', {
        tableName,
        operation,
        payload: JSON.stringify(payload),
        supabaseId,
      });
      console.log(`📦 Queued ${operation} for ${tableName}`);
    } catch (error) {
      console.error('Failed to queue operation:', error);
    }
  }

  // Process sync queue - push pending items to Supabase
  async processSyncQueue(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      console.log('🔄 Processing sync queue...');
      
      // Get pending items from SQLite
      const pendingItems: SyncQueueItem[] = await invoke('get_pending_sync_items');
      
      if (pendingItems.length === 0) {
        console.log('✅ Sync queue is empty');
        return;
      }

      console.log(`📤 Syncing ${pendingItems.length} pending items...`);

      let successCount = 0;
      let failCount = 0;

      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to sync item ${item.id}:`, error);
          failCount++;
          
          // Update retry count
          await invoke('update_sync_retry', {
            id: item.id,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
      }

      console.log(`✅ Sync complete: ${successCount} succeeded, ${failCount} failed`);
      
      // Update connectivity state
      await this.checkConnectivity();
      
    } catch (error) {
      console.error('Sync queue processing failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Sync a single item to Supabase
  private async syncItem(item: SyncQueueItem): Promise<void> {
    const payload = JSON.parse(item.payload);

    switch (item.table_name) {
      case 'employees':
        await this.syncEmployee(item, payload);
        break;
      case 'attendance_logs':
        await this.syncAttendance(item, payload);
        break;
      case 'leave_requests':
        await this.syncLeaveRequest(item, payload);
        break;
      default:
        console.warn(`Unknown table: ${item.table_name}`);
    }

    // Mark as synced
    await invoke('mark_sync_complete', { id: item.id });
  }

  // Sync employee to Supabase - uses UPSERT to prevent duplicates
  private async syncEmployee(item: SyncQueueItem, payload: any): Promise<void> {
    switch (item.operation) {
      case 'INSERT':
        // Use upsert instead of insert to prevent duplicate key errors
        await supabase
          .from('employees')
          .upsert(payload, { 
            onConflict: 'employee_code',
            ignoreDuplicates: false 
          });
        break;
      case 'UPDATE':
        if (item.supabase_id) {
          await supabase.from('employees').update(payload).eq('id', item.supabase_id);
        }
        break;
      case 'DELETE':
        if (item.supabase_id) {
          await supabase.from('employees').delete().eq('id', item.supabase_id);
        }
        break;
    }
  }

  // Sync attendance to Supabase - uses upsert to prevent duplicate punches
  private async syncAttendance(item: SyncQueueItem, payload: any): Promise<void> {
    await supabase
      .from('attendance_logs')
      .upsert(payload, { 
        onConflict: 'employee_id,timestamp',
        ignoreDuplicates: true 
      });
  }

  // Sync leave request to Supabase - uses upsert
  private async syncLeaveRequest(item: SyncQueueItem, payload: any): Promise<void> {
    switch (item.operation) {
      case 'INSERT':
        await supabase.from('leave_requests').upsert(payload, {
          onConflict: 'id',
          ignoreDuplicates: false
        });
        break;
      case 'UPDATE':
        if (item.supabase_id) {
          await supabase.from('leave_requests').update(payload).eq('id', item.supabase_id);
        }
        break;
    }
  }

  // Setup Supabase realtime listeners with cloud-to-local priority
  async setupRealtimeListeners(onUpdate: (table: string, data: any) => void) {
    // Listen to employees table changes
    supabase
      .channel('employees_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        async (payload) => {
          console.log('📡 Employee change detected:', payload.eventType);
          onUpdate('employees', payload.new || payload.old);
          
          // CLOUD-TO-LOCAL PRIORITY: Check timestamps before updating local DB
          try {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const cloudData = payload.new;
              const cloudUpdatedAt = cloudData?.updated_at || cloudData?.created_at;
              
              // Fetch local record to compare timestamps
              const localData = await invoke('get_employee_by_code', {
                employeeCode: cloudData?.employee_code || '',
              });
              
              if (localData) {
                // Cloud wins if it's newer than local
                const localUpdatedAt = (localData as any)?.updated_at || (localData as any)?.created_at;
                const cloudIsNewer = !localUpdatedAt || !cloudUpdatedAt || cloudUpdatedAt >= localUpdatedAt;
                
                if (cloudIsNewer) {
                  console.log('☁️ Cloud data is newer, updating local...');
                  await invoke('upsert_employee_from_cloud', {
                    employeeData: JSON.stringify(cloudData),
                  });
                } else {
                  console.log('💻 Local data is newer, skipping cloud update...');
                }
              } else {
                // No local record, insert from cloud
                console.log('📥 New cloud employee, inserting locally...');
                await invoke('upsert_employee_from_cloud', {
                  employeeData: JSON.stringify(cloudData),
                });
              }
            } else if (payload.eventType === 'DELETE') {
              // CONFLICT RESOLUTION: Cloud delete wins (cloud is master)
              console.log('🗑️ Cloud deleted employee, removing locally...');
              await invoke('delete_employee_by_id', {
                employeeCode: payload.old?.employee_code || payload.old?.id,
              });
            }
          } catch (error) {
            console.error('Failed to sync realtime update to local DB:', error);
          }
        }
      )
      .subscribe();

    // Listen to attendance_logs changes
    supabase
      .channel('attendanceChanges')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_logs' },
        async (payload) => {
          console.log('📡 New attendance log detected');
          onUpdate('attendance_logs', payload.new);
          
          // Attendance is append-only, no conflict possible - just insert
          try {
            await invoke('insert_attendance_from_cloud', {
              attendanceData: JSON.stringify(payload.new),
            });
          } catch (error) {
            console.error('Failed to sync attendance to local DB:', error);
          }
        }
      )
      .subscribe();

    // Listen to leave_requests changes
    supabase
      .channel('leaveChanges')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_requests' },
        async (payload) => {
          console.log('📡 Leave request change detected:', payload.eventType);
          onUpdate('leave_requests', payload.new || payload.old);
          
          // CONFLICT RESOLUTION: Cloud is master for leave requests
          try {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              await invoke('upsert_leave_from_cloud', {
                leaveData: JSON.stringify(payload.new),
              });
            } else if (payload.eventType === 'DELETE') {
              await invoke('delete_leave_by_id', {
                leaveId: payload.old?.id,
              });
            }
          } catch (error) {
            console.error('Failed to sync leave to local DB:', error);
          }
        }
      )
      .subscribe();

    console.log('📡 Realtime listeners activated with cloud-priority conflict resolution');
  }

  // Stop all listeners and intervals
  destroy() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.connectivityInterval) clearInterval(this.connectivityInterval);
    this.listeners = [];
    console.log('🛑 Sync Service destroyed');
  }
}

// Singleton instance
export const syncService = new SyncService();
