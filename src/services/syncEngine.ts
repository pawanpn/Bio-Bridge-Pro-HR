import { supabase, SYNC_CONFIG, updateSyncStats, getSyncStats, isSupabaseConfigured, isOnline } from '../config/supabase';

// Sync Queue Item
interface SyncQueueItem {
  id: string;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  priority: string;
  retryCount: number;
  createdAt: string;
  lastAttempt?: string;
}

// Sync Engine Class
class SyncEngine {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  private queue: SyncQueueItem[] = [];
  private listeners: Set<Function> = new Set();

  constructor() {
    // Load queue from localStorage
    this.loadQueue();
    
    // Start sync if online and Supabase configured
    if (isOnline() && isSupabaseConfigured()) {
      this.startSync();
    }
  }

  // Add item to sync queue
  public async enqueue(
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    data: any,
    priority: string = SYNC_CONFIG.PRIORITY.MEDIUM
  ): Promise<void> {
    const item: SyncQueueItem = {
      id: `${table}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      table,
      operation,
      data,
      priority,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.queue.push(item);
    await this.saveQueue();
    this.notifyListeners();

    // If critical priority and online, sync immediately
    if (priority === SYNC_CONFIG.PRIORITY.CRITICAL && isOnline()) {
      await this.syncNow();
    }
  }

  // Sync all pending items
  public async syncNow(): Promise<void> {
    if (this.isSyncing || this.queue.length === 0 || !isOnline() || !isSupabaseConfigured()) {
      return;
    }

    this.isSyncing = true;
    await updateSyncStats({ syncStatus: 'syncing' });
    this.notifyListeners();

    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    // Sort queue by priority
    const priorityOrder = {
      [SYNC_CONFIG.PRIORITY.CRITICAL]: 0,
      [SYNC_CONFIG.PRIORITY.HIGH]: 1,
      [SYNC_CONFIG.PRIORITY.MEDIUM]: 2,
      [SYNC_CONFIG.PRIORITY.LOW]: 3,
    };

    const sortedQueue = [...this.queue].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    // Process in batches
    for (let i = 0; i < sortedQueue.length; i += SYNC_CONFIG.BATCH_SIZE) {
      const batch = sortedQueue.slice(i, i + SYNC_CONFIG.BATCH_SIZE);
      
      for (const item of batch) {
        try {
          const success = await this.syncItem(item);
          if (success) {
            synced++;
            this.removeFromQueue(item.id);
          } else {
            failed++;
            this.markForRetry(item);
          }
        } catch (error: any) {
          if (error.message?.includes('conflict') || error.status === 409) {
            conflicts++;
            await this.handleConflict(item, error);
          } else {
            failed++;
            this.markForRetry(item);
          }
        }
      }
    }

    const stats = await getSyncStats();
    await updateSyncStats({
      lastSync: new Date().toISOString(),
      totalSynced: stats.totalSynced + synced,
      totalFailed: stats.totalFailed + failed,
      conflicts: stats.conflicts + conflicts,
      pendingRecords: this.queue.length,
      syncStatus: this.queue.length === 0 ? 'success' : 'error',
    });

    this.isSyncing = false;
    this.notifyListeners();
  }

  // Sync single item
  private async syncItem(item: SyncQueueItem): Promise<boolean> {
    const { table, operation, data } = item;

    try {
      let response;

      switch (operation) {
        case 'INSERT':
          response = await supabase.from(table).insert(data);
          break;
        case 'UPDATE':
          response = await supabase.from(table).update(data).eq('id', data.id);
          break;
        case 'DELETE':
          response = await supabase.from(table).delete().eq('id', data.id);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      if (response.error) {
        throw response.error;
      }

      return true;
    } catch (error) {
      console.error(`Sync failed for ${table} ${operation}:`, error);
      throw error;
    }
  }

  // Handle conflicts
  private async handleConflict(item: SyncQueueItem, error: any): Promise<void> {
    // Log conflict for manual resolution
    const conflicts = JSON.parse(localStorage.getItem('biobridge_sync_conflicts') || '[]');
    conflicts.push({
      ...item,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem('biobridge_sync_conflicts', JSON.stringify(conflicts));
  }

  // Mark item for retry
  private markForRetry(item: SyncQueueItem): void {
    item.retryCount++;
    item.lastAttempt = new Date().toISOString();

    if (item.retryCount >= SYNC_CONFIG.MAX_RETRIES) {
      // Move to failed queue
      const failed = JSON.parse(localStorage.getItem('biobridge_sync_failed') || '[]');
      failed.push(item);
      localStorage.setItem('biobridge_sync_failed', JSON.stringify(failed));
      this.removeFromQueue(item.id);
    }
  }

  // Remove item from queue
  private removeFromQueue(id: string): void {
    this.queue = this.queue.filter(item => item.id !== id);
    this.saveQueue();
  }

  // Start automatic sync
  public startSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (isOnline() && isSupabaseConfigured() && !this.isSyncing) {
        await this.syncNow();
      }
    }, SYNC_CONFIG.SYNC_INTERVAL_ONLINE);
  }

  // Stop automatic sync
  public stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Load queue from localStorage
  private loadQueue(): void {
    const saved = localStorage.getItem('biobridge_sync_queue');
    if (saved) {
      this.queue = JSON.parse(saved);
    }
  }

  // Save queue to localStorage
  private async saveQueue(): Promise<void> {
    localStorage.setItem('biobridge_sync_queue', JSON.stringify(this.queue));
  }

  // Get queue length
  public getQueueLength(): number {
    return this.queue.length;
  }

  // Get pending records by table
  public getPendingByTable(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.queue.forEach(item => {
      counts[item.table] = (counts[item.table] || 0) + 1;
    });
    return counts;
  }

  // Listen for sync status changes
  public addListener(callback: Function): void {
    this.listeners.add(callback);
  }

  public removeListener(callback: Function): void {
    this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }

  // Force sync all (including low priority)
  public async forceSyncAll(): Promise<void> {
    await this.syncNow();
  }

  // Clear all conflicts
  public clearConflicts(): void {
    localStorage.setItem('biobridge_sync_conflicts', '[]');
  }

  // Get conflicts
  public getConflicts(): any[] {
    return JSON.parse(localStorage.getItem('biobridge_sync_conflicts') || '[]');
  }

  // Retry failed items
  public async retryFailed(): Promise<void> {
    const failed = JSON.parse(localStorage.getItem('biobridge_sync_failed') || '[]');
    if (failed.length === 0) return;

    // Add failed items back to queue
    failed.forEach((item: SyncQueueItem) => {
      item.retryCount = 0;
      this.queue.push(item);
    });

    localStorage.setItem('biobridge_sync_failed', '[]');
    await this.saveQueue();
    await this.syncNow();
  }
}

// Export singleton instance
export const syncEngine = new SyncEngine();

export default syncEngine;
