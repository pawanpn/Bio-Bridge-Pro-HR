import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { syncService, ConnectivityState } from '@/services/syncService';

export function useConnectivity() {
  const [state, setState] = useState<ConnectivityState>(syncService.getConnectivityState());
  
  useEffect(() => {
    const unsubscribe = syncService.onConnectivityChange(setState);
    return unsubscribe;
  }, []);
  
  return state;
}

export function useRealtimeSync(onUpdate?: (table: string, data: any) => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  
  useEffect(() => {
    let active = true;
    
    syncService.setupRealtimeListeners((table, data) => {
      if (active && onUpdateRef.current) {
        onUpdateRef.current(table, data);
      }
    });
    
    return () => {
      active = false;
    };
  }, []);
}

export function useSyncQueue() {
  const processQueue = async () => {
    await syncService.processSyncQueue();
  };
  
  const getQueueCount = async (): Promise<number> => {
    try {
      const items = await invoke('get_pending_sync_items') as unknown[];
      return items.length;
    } catch {
      return 0;
    }
  };
  
  return { processQueue, getQueueCount };
}
